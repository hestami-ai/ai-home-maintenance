import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { svelteKitSyncEnvironment } from './svelte-kit-execution-closure.js';
import {
	observeDirectSvelteKitPackageIdentity,
	observeSvelteKitSyncGenerator,
	SVELTE_KIT_SYNC_GENERATOR_ID
} from './svelte-kit-generator.js';

const roots: string[] = [];
const INTEGRITY = `sha512-${'A'.repeat(86)}==`;

function write(root: string, path: string, content: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, content, 'utf8');
}

function packageTuple(name: string, version: string): readonly [string, string, object, string] {
	return [`${name}@${version}`, '', {}, INTEGRITY];
}

function fixture(): string {
	const root = mkdtempSync(join(tmpdir(), 'csaa-svelte-closure-'));
	roots.push(root);
	write(root, 'package.json', JSON.stringify({ name: 'fixture', private: true }));
	write(
		root,
		'bun.lock',
		JSON.stringify({
			lockfileVersion: 1,
			packages: {
				'@sveltejs/kit': packageTuple('@sveltejs/kit', '2.69.2'),
				'fixture-dep': packageTuple('fixture-dep', '1.0.0'),
				typescript: packageTuple('typescript', '5.9.3'),
				vite: packageTuple('vite', '7.3.6')
			}
		})
	);
	write(
		root,
		'node_modules/@sveltejs/kit/package.json',
		JSON.stringify({
			dependencies: { 'fixture-dep': '1.0.0' },
			name: '@sveltejs/kit',
			version: '2.69.2'
		})
	);
	write(root, 'node_modules/@sveltejs/kit/svelte-kit.js', 'export {};\n');
	write(
		root,
		'node_modules/fixture-dep/package.json',
		JSON.stringify({ name: 'fixture-dep', version: '1.0.0' })
	);
	write(root, 'node_modules/fixture-dep/index.js', 'export default 1;\n');
	write(
		root,
		'node_modules/typescript/package.json',
		JSON.stringify({ name: 'typescript', version: '5.9.3' })
	);
	write(root, 'node_modules/typescript/index.js', 'export {};\n');
	write(root, 'node_modules/vite/package.json', JSON.stringify({ name: 'vite', version: '7.3.6' }));
	write(root, 'node_modules/vite/index.js', 'export {};\n');
	write(root, 'apps/rph-demo/package.json', JSON.stringify({ name: '@fixture/demo' }));
	write(
		root,
		'apps/rph-demo/svelte.config.js',
		"import dependency from 'fixture-dep';\nexport default { dependency };\n"
	);
	write(root, 'apps/rph-demo/vite.config.ts', 'export default {};\n');
	write(root, 'apps/rph-demo/static/fixture.txt', 'asset\n');
	return root;
}

function directIdentityFixture(): string {
	const root = mkdtempSync(join(tmpdir(), 'csaa-svelte-direct-'));
	roots.push(root);
	write(
		root,
		'bun.lock',
		`    "@sveltejs/kit": ["@sveltejs/kit@2.69.2", "", {}, "${INTEGRITY}"],\n`
	);
	write(
		root,
		'node_modules/@sveltejs/kit/package.json',
		JSON.stringify({ name: '@sveltejs/kit', version: '2.69.2' })
	);
	write(root, 'node_modules/@sveltejs/kit/svelte-kit.js', 'export {};\n');
	write(root, 'node_modules/@sveltejs/kit/runtime/internal.js', 'export const runtime = 1;\n');
	return root;
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe('SvelteKit synchronization execution closure', () => {
	it('binds the direct installed package identity to canonical package-tree and lockfile bytes', () => {
		const root = directIdentityFixture();
		const first = observeDirectSvelteKitPackageIdentity(root);
		const replay = observeDirectSvelteKitPackageIdentity(root);

		expect(replay).toEqual(first);
		expect(first).toMatchObject({
			generator: { id: SVELTE_KIT_SYNC_GENERATOR_ID, version: '2.69.2' },
			lockIntegrity: INTEGRITY,
			packageFileCount: 3
		});
		expect(first.entryPath).toBe(join(root, 'node_modules/@sveltejs/kit/svelte-kit.js'));
		expect(first.generator.implementationDigest).toMatch(/^[a-f0-9]{64}$/u);
		expect(first.packageTreeDigest).toMatch(/^[a-f0-9]{64}$/u);

		write(root, 'node_modules/@sveltejs/kit/runtime/internal.js', 'export const runtime = 2;\n');
		const changed = observeDirectSvelteKitPackageIdentity(root);
		expect(changed.packageTreeDigest).not.toBe(first.packageTreeDigest);
		expect(changed.generator.implementationDigest).not.toBe(first.generator.implementationDigest);
	});

	it('refuses malformed, ambiguous, mismatched, and entry-incomplete direct package identities', () => {
		const malformed = directIdentityFixture();
		write(malformed, 'node_modules/@sveltejs/kit/package.json', '{');
		expect(() => observeDirectSvelteKitPackageIdentity(malformed)).toThrow(
			'package manifest is malformed'
		);

		const invalidShape = directIdentityFixture();
		write(invalidShape, 'node_modules/@sveltejs/kit/package.json', '[]');
		expect(() => observeDirectSvelteKitPackageIdentity(invalidShape)).toThrow(
			'package manifest has an invalid shape'
		);

		const invalidIdentity = directIdentityFixture();
		write(
			invalidIdentity,
			'node_modules/@sveltejs/kit/package.json',
			JSON.stringify({ name: '@sveltejs/not-kit', version: '2.69.2' })
		);
		expect(() => observeDirectSvelteKitPackageIdentity(invalidIdentity)).toThrow(
			'package identity is invalid'
		);

		const ambiguousLock = directIdentityFixture();
		write(
			ambiguousLock,
			'bun.lock',
			`    "@sveltejs/kit": ["@sveltejs/kit@2.69.2", "", {}, "${INTEGRITY}"],\n` +
				`    "@sveltejs/kit": ["@sveltejs/kit@2.69.2", "", {}, "${INTEGRITY}"],\n`
		);
		expect(() => observeDirectSvelteKitPackageIdentity(ambiguousLock)).toThrow(
			'exactly one closed @sveltejs/kit package resolution'
		);

		const mismatch = directIdentityFixture();
		write(
			mismatch,
			'node_modules/@sveltejs/kit/package.json',
			JSON.stringify({ name: '@sveltejs/kit', version: '2.70.0' })
		);
		expect(() => observeDirectSvelteKitPackageIdentity(mismatch)).toThrow(
			'Installed and lockfile-resolved @sveltejs/kit versions differ'
		);

		const missingEntry = directIdentityFixture();
		rmSync(join(missingEntry, 'node_modules/@sveltejs/kit/svelte-kit.js'));
		expect(() => observeDirectSvelteKitPackageIdentity(missingEntry)).toThrow(
			'package entry is absent from its package tree'
		);
	});

	it('binds real Node, a closed environment, config imports, and transitive package bytes', () => {
		const root = fixture();
		const before = observeSvelteKitSyncGenerator(root);
		expect(basename(before.nodeExecutable)).toMatch(/^node(?:\.exe)?$/iu);
		expect(before.executionManifest.runtime).toMatchObject({ engine: 'node' });
		expect(before.executionManifest.environment.map((entry) => entry.name)).not.toEqual(
			expect.arrayContaining(['NODE_OPTIONS', 'PATH', 'SECRET_CANARY'])
		);
		expect(before.executionManifest.configurationEntrypoints[0]).toMatchObject({
			imports: ['fixture-dep'],
			path: 'apps/rph-demo/svelte.config.js'
		});
		expect(before.executionManifest.packages.map((record) => record.name).sort()).toEqual([
			'@sveltejs/kit',
			'fixture-dep',
			'typescript',
			'vite'
		]);

		write(root, 'node_modules/fixture-dep/index.js', 'export default 2;\n');
		const after = observeSvelteKitSyncGenerator(root);
		expect(after.generator.implementationDigest).not.toBe(before.generator.implementationDigest);
		expect(
			after.executionManifest.packages.find((record) => record.name === 'fixture-dep')?.treeSha256
		).not.toBe(
			before.executionManifest.packages.find((record) => record.name === 'fixture-dep')?.treeSha256
		);
	}, 60_000);

	it('refuses unbound environment files, nonliteral loads, and installed/lock mismatch', () => {
		const environmentRoot = fixture();
		write(environmentRoot, 'apps/rph-demo/.env.production', 'SECRET_CANARY=do-not-read\n');
		expect(() => observeSvelteKitSyncGenerator(environmentRoot)).toThrow(
			'refuses unbound .env input files'
		);

		const nonliteralRoot = fixture();
		write(
			nonliteralRoot,
			'apps/rph-demo/svelte.config.js',
			"const selected = 'fixture-dep';\nexport default await import(selected);\n"
		);
		expect(() => observeSvelteKitSyncGenerator(nonliteralRoot)).toThrow('nonliteral module load');

		const mismatchRoot = fixture();
		write(
			mismatchRoot,
			'node_modules/fixture-dep/package.json',
			JSON.stringify({ name: 'fixture-dep', version: '2.0.0' })
		);
		expect(() => observeSvelteKitSyncGenerator(mismatchRoot)).toThrow(
			'does not have an unambiguous bun.lock tuple'
		);

		const nestedRoot = fixture();
		write(
			nestedRoot,
			'node_modules/fixture-dep/node_modules/unlisted/index.js',
			'export default "unbound";\n'
		);
		expect(() => observeSvelteKitSyncGenerator(nestedRoot)).toThrow(
			'contains an unbound nested node_modules directory'
		);
	}, 30_000);

	it('requires true absence and the exact flat bun.lock key', () => {
		const danglingRoot = fixture();
		symlinkSync(
			join(danglingRoot, 'missing-config-target'),
			join(danglingRoot, 'apps/rph-demo/vite.config.mjs'),
			process.platform === 'win32' ? 'junction' : 'file'
		);
		expect(() => observeSvelteKitSyncGenerator(danglingRoot)).toThrow(
			'Generated-context synchronization requires path to be absent: apps/rph-demo/vite.config.mjs'
		);

		const wrongKeyRoot = fixture();
		write(
			wrongKeyRoot,
			'bun.lock',
			JSON.stringify({
				lockfileVersion: 1,
				packages: {
					'@sveltejs/kit': packageTuple('@sveltejs/kit', '2.69.2'),
					'wrong-fixture-dep-key': packageTuple('fixture-dep', '1.0.0'),
					typescript: packageTuple('typescript', '5.9.3'),
					vite: packageTuple('vite', '7.3.6')
				}
			})
		);
		expect(() => observeSvelteKitSyncGenerator(wrongKeyRoot)).toThrow(
			'Installed package fixture-dep@1.0.0 does not have an unambiguous bun.lock tuple.'
		);
	}, 30_000);

	it('closes indirect require, computed-global, and dynamic-code configuration bypasses', () => {
		const requireRoot = fixture();
		write(
			requireRoot,
			'apps/rph-demo/vite.config.ts',
			"import { createRequire } from 'node:module';\nconst r = createRequire(import.meta.url);\nexport default r('undeclared-pkg');\n"
		);
		expect(() => observeSvelteKitSyncGenerator(requireRoot)).toThrow(
			'Required generated-context package undeclared-pkg is not installed'
		);
		const indirectRequireRoot = fixture();
		write(
			indirectRequireRoot,
			'apps/rph-demo/vite.config.ts',
			"import { createRequire } from 'node:module';\nconst r = createRequire(import.meta.url);\nconst load = r;\nexport default load('undeclared-pkg');\n"
		);
		expect(() => observeSvelteKitSyncGenerator(indirectRequireRoot)).toThrow(
			'indirect createRequire alias flow'
		);

		const computedRoot = fixture();
		write(
			computedRoot,
			'apps/rph-demo/vite.config.ts',
			"globalThis['fetch']('https://example.invalid');\nexport default {};\n"
		);
		expect(() => observeSvelteKitSyncGenerator(computedRoot)).toThrow(
			'uses unsupported computed access'
		);

		const functionRoot = fixture();
		write(
			functionRoot,
			'apps/rph-demo/vite.config.ts',
			"Function('return process')();\nexport default {};\n"
		);
		expect(() => observeSvelteKitSyncGenerator(functionRoot)).toThrow(
			'uses forbidden ambient Function'
		);

		const reflectionRoot = fixture();
		write(
			reflectionRoot,
			'apps/rph-demo/vite.config.ts',
			"Reflect.get(() => {}, 'constructor')('return process')();\nexport default {};\n"
		);
		expect(() => observeSvelteKitSyncGenerator(reflectionRoot)).toThrow(
			'outside the admitted syntax profile'
		);

		const traversalRoot = fixture();
		write(
			traversalRoot,
			'node_modules/@sveltejs/kit/package.json',
			JSON.stringify({
				dependencies: { '../escape': '1.0.0' },
				name: '@sveltejs/kit',
				version: '2.69.2'
			})
		);
		expect(() => observeSvelteKitSyncGenerator(traversalRoot)).toThrow(
			'has an invalid dependency declaration'
		);
	}, 30_000);

	it.each([
		{
			message: 'uses a namespace import outside the admitted syntax profile',
			name: 'namespace imports',
			source: "import * as dependency from 'fixture-dep';\nexport default { dependency };\n"
		},
		{
			message: 'uses a binding pattern outside the admitted syntax profile',
			name: 'destructured bindings',
			source: 'const { value } = {};\nexport default {};\n'
		},
		{
			message: 'uses ambient identifier ambientValue outside the admitted syntax profile',
			name: 'ambient identifiers',
			source: 'export default ambientValue;\n'
		},
		{
			message: 'uses an array form outside the admitted syntax profile',
			name: 'array spreads',
			source: 'const value = 1;\nexport default [value, ...[value]];\n'
		},
		{
			message: 'uses an object member outside the admitted syntax profile',
			name: 'object methods',
			source: 'export default { method() { return 1; } };\n'
		},
		{
			message: 'uses a call outside the admitted syntax profile',
			name: 'unbound calls',
			source: 'const value = 1;\nexport default Math.abs(value);\n'
		},
		{
			message: 'uses a spread call outside the admitted syntax profile',
			name: 'spread calls',
			source:
				"import dependency from 'fixture-dep';\nconst values = [];\nexport default dependency(...values);\n"
		},
		{
			message: 'uses syntax outside the admitted execution profile',
			name: 'function-valued bindings',
			source: 'const value = () => 1;\nexport default value;\n'
		},
		{
			message: 'uses a mutable binding outside the admitted syntax profile',
			name: 'mutable bindings',
			source: 'let value = 1;\nexport default value;\n'
		},
		{
			message: 'has an uninitialized binding outside the admitted syntax profile',
			name: 'uninitialized bindings',
			source: 'const value: unknown;\nexport default value;\n'
		},
		{
			message: 'has a statement outside the admitted syntax profile',
			name: 'function declarations',
			source: 'export function config() { return {}; }\n'
		},
		{
			message: 'is malformed',
			name: 'parse-invalid configuration',
			source: 'export default {\n'
		},
		{
			message: 'has an unsupported node:module binding',
			name: 'default node:module bindings',
			source: "import module, { createRequire } from 'node:module';\nexport default {};\n"
		},
		{
			message: 'has an unsupported createRequire binding',
			name: 'mutable createRequire bindings',
			source:
				"import { createRequire } from 'node:module';\nlet loader = createRequire(import.meta.url);\nexport default {};\n"
		},
		{
			message: 'has an indirect createRequire factory flow',
			name: 'indirect createRequire factories',
			source:
				"import { createRequire } from 'node:module';\nconst factory = createRequire;\nexport default {};\n"
		},
		{
			message: 'uses forbidden constructor access',
			name: 'constructor property access',
			source: 'const value = {};\nexport default value.constructor;\n'
		},
		{
			message: 'has an unsupported relative import',
			name: 'relative imports',
			source: "import value from './local.js';\nexport default { value };\n"
		},
		{
			message: 'imports forbidden runtime module node:fs',
			name: 'forbidden Node runtime modules',
			source: "import fileSystem from 'node:fs';\nexport default { fileSystem };\n"
		},
		{
			message: 'contains an invalid package name',
			name: 'invalid scoped package names',
			source: "import value from '@invalid';\nexport default { value };\n"
		},
		{
			message: 'contains an unsupported module specifier',
			name: 'absolute Windows module specifiers',
			source: "import value from 'C:/escape';\nexport default { value };\n"
		},
		{
			message: 'has an unsupported createRequire call',
			name: 'unbound createRequire calls',
			source:
				"import { createRequire } from 'node:module';\ncreateRequire(import.meta.url);\nexport default {};\n"
		},
		{
			message: 'uses an unbound require loader',
			name: 'ambient require calls',
			source: "export default require('fixture-dep');\n"
		}
	] satisfies readonly {
		readonly message: string;
		readonly name: string;
		readonly source: string;
	}[])(
		'refuses $name through the execution-closure boundary',
		({ message, source }) => {
			const root = fixture();
			write(root, 'apps/rph-demo/vite.config.ts', source);
			expect(() => observeSvelteKitSyncGenerator(root)).toThrow(message);
		},
		30_000
	);

	it('admits direct and resolved module loads with inert expression wrappers', () => {
		const root = fixture();
		write(
			root,
			'apps/rph-demo/vite.config.ts',
			"import dependency from 'fixture-dep';\n" +
				"import { createRequire as makeRequire } from 'node:module';\n" +
				'const loader = makeRequire(import.meta.url);\n' +
				"const resolved = loader.resolve('fixture-dep');\n" +
				'const called = dependency(resolved);\n' +
				'const values = [dependency, resolved, 1, true, false, null, /fixture/u];\n' +
				'const options = { dependency: (dependency), called, resolved, values };\n' +
				'export default ((options as unknown) satisfies unknown)!;\n'
		);
		const observation = observeSvelteKitSyncGenerator(root);
		expect(
			observation.executionManifest.configurationEntrypoints.find(
				(entry) => entry.path === 'apps/rph-demo/vite.config.ts'
			)?.imports
		).toEqual(['fixture-dep', 'node:module']);
	}, 30_000);

	it('requires an absolute Windows runtime environment', () => {
		const original = process.env.SystemRoot;
		try {
			delete process.env.SystemRoot;
			expect(() => svelteKitSyncEnvironment('win32')).toThrow(
				'Required Windows runtime environment SystemRoot is unavailable'
			);
		} finally {
			if (original === undefined) delete process.env.SystemRoot;
			else process.env.SystemRoot = original;
		}
	});

	it.each([
		{
			message: 'bun.lock is not a valid JSON-with-comments object',
			name: 'a malformed lockfile',
			mutate(root: string) {
				write(root, 'bun.lock', '{');
			}
		},
		{
			message: 'bun.lock packages table is unavailable',
			name: 'a missing lockfile package table',
			mutate(root: string) {
				write(root, 'bun.lock', JSON.stringify({ lockfileVersion: 1 }));
			}
		},
		{
			message: 'bun.lock contains an invalid package tuple',
			name: 'a malformed lockfile package tuple',
			mutate(root: string) {
				write(root, 'bun.lock', JSON.stringify({ lockfileVersion: 1, packages: { invalid: {} } }));
			}
		},
		{
			message: 'Installed package @sveltejs/kit@2.69.2 does not have an unambiguous bun.lock tuple',
			name: 'a lockfile tuple without bounded integrity',
			mutate(root: string) {
				write(
					root,
					'bun.lock',
					JSON.stringify({
						lockfileVersion: 1,
						packages: {
							'@sveltejs/kit': ['@sveltejs/kit@2.69.2', '', {}, 'invalid'],
							'fixture-dep': packageTuple('fixture-dep', '1.0.0'),
							typescript: packageTuple('typescript', '5.9.3'),
							vite: packageTuple('vite', '7.3.6')
						}
					})
				);
			}
		},
		{
			message: '@sveltejs/kit has an invalid dependency table',
			name: 'a non-record dependency table',
			mutate(root: string) {
				write(
					root,
					'node_modules/@sveltejs/kit/package.json',
					JSON.stringify({ dependencies: [], name: '@sveltejs/kit', version: '2.69.2' })
				);
			}
		},
		{
			message: '@sveltejs/kit has invalid peer dependency metadata',
			name: 'non-record peer dependency metadata',
			mutate(root: string) {
				write(
					root,
					'node_modules/@sveltejs/kit/package.json',
					JSON.stringify({
						name: '@sveltejs/kit',
						peerDependenciesMeta: [],
						version: '2.69.2'
					})
				);
			}
		},
		{
			message: 'Installed package @sveltejs/kit has an invalid identity',
			name: 'a mismatched installed package identity',
			mutate(root: string) {
				write(
					root,
					'node_modules/@sveltejs/kit/package.json',
					JSON.stringify({ name: '@sveltejs/not-kit', version: '2.69.2' })
				);
			}
		},
		{
			message: 'Installed package fixture-dep is not a regular directory',
			name: 'an installed package represented by a file',
			mutate(root: string) {
				const dependencyRoot = join(root, 'node_modules/fixture-dep');
				rmSync(dependencyRoot, { force: true, recursive: true });
				write(root, 'node_modules/fixture-dep', 'not a directory\n');
			}
		},
		{
			message: 'Installed dependency closure contains a symbolic link',
			name: 'a symlink in an installed package tree',
			mutate(root: string) {
				write(root, 'shared-target/value.js', 'export default 1;\n');
				symlinkSync(
					join(root, 'shared-target'),
					join(root, 'node_modules/fixture-dep/link'),
					process.platform === 'win32' ? 'junction' : 'dir'
				);
			}
		},
		{
			message: 'apps/rph-demo/vite.config.ts is not a regular file',
			name: 'a symlinked configuration entrypoint',
			mutate(root: string) {
				const configuration = join(root, 'apps/rph-demo/vite.config.ts');
				rmSync(configuration);
				write(root, 'shared-config/index.ts', 'export default {};\n');
				symlinkSync(
					join(root, 'shared-config'),
					configuration,
					process.platform === 'win32' ? 'junction' : 'dir'
				);
			}
		},
		{
			message: 'apps/rph-demo/vite.config.ts exceeds its byte limit',
			name: 'an oversized configuration entrypoint',
			mutate(root: string) {
				write(root, 'apps/rph-demo/vite.config.ts', ' '.repeat(2 * 1024 * 1024 + 1));
			}
		},
		{
			message: 'Generated-context environment-file scan exceeded its depth limit',
			name: 'an over-deep repository scan',
			mutate(root: string) {
				write(root, `${Array.from({ length: 66 }, () => 'd').join('/')}/value.txt`, 'x');
			}
		},
		{
			message: 'Installed dependency package tree exceeded its depth limit',
			name: 'an over-deep installed package tree',
			mutate(root: string) {
				write(
					root,
					`node_modules/fixture-dep/${Array.from({ length: 66 }, () => 'd').join('/')}/value.js`,
					'export default 1;\n'
				);
			}
		}
	] satisfies readonly {
		readonly message: string;
		readonly name: string;
		readonly mutate: (root: string) => void;
	}[])(
		'refuses $name through the execution-closure boundary',
		({ message, mutate }) => {
			const root = fixture();
			mutate(root);
			expect(() => observeSvelteKitSyncGenerator(root)).toThrow(message);
		},
		30_000
	);

	it('records absent optional packages, ignores optional peers, and recurses package trees', () => {
		const root = fixture();
		write(
			root,
			'node_modules/@sveltejs/kit/package.json',
			JSON.stringify({
				dependencies: { 'fixture-dep': '1.0.0' },
				name: '@sveltejs/kit',
				optionalDependencies: {
					'another-missing': '1.0.0',
					'optional-missing': '1.0.0'
				},
				peerDependencies: { 'optional-peer': '1.0.0' },
				peerDependenciesMeta: { 'optional-peer': { optional: true } },
				version: '2.69.2'
			})
		);
		write(root, 'node_modules/fixture-dep/runtime/internal.js', 'export const internal = 1;\n');
		rmSync(join(root, 'apps/rph-demo/static'), { force: true, recursive: true });

		const observation = observeSvelteKitSyncGenerator(root);
		expect(observation.executionManifest.missingOptionalPackages).toEqual([
			{ issuer: 'node_modules/@sveltejs/kit', name: 'another-missing' },
			{ issuer: 'node_modules/@sveltejs/kit', name: 'optional-missing' }
		]);
		expect(observation.executionManifest.missingOptionalPackages).not.toEqual(
			expect.arrayContaining([{ issuer: expect.any(String), name: 'optional-peer' }])
		);
		expect(observation.executionManifest.repositoryReadGrants).toContainEqual({
			kind: 'ABSENT_PATH',
			path: 'apps/rph-demo/static'
		});
		expect(
			observation.executionManifest.packages.find(({ name }) => name === 'fixture-dep')?.fileCount
		).toBe(3);
	}, 30_000);

	it('refuses additional direct-package filesystem and identity boundary violations', () => {
		const manifestDirectory = directIdentityFixture();
		const manifestPath = join(manifestDirectory, 'node_modules/@sveltejs/kit/package.json');
		rmSync(manifestPath);
		mkdirSync(manifestPath);
		expect(() => observeDirectSvelteKitPackageIdentity(manifestDirectory)).toThrow(
			'package manifest is not a regular file'
		);

		const invalidLock = directIdentityFixture();
		write(
			invalidLock,
			'bun.lock',
			`    "@sveltejs/kit": ["@sveltejs/kit@-invalid", "", {}, "${INTEGRITY}"],\n`
		);
		expect(() => observeDirectSvelteKitPackageIdentity(invalidLock)).toThrow(
			'invalid @sveltejs/kit package resolution'
		);

		const linkedTree = directIdentityFixture();
		symlinkSync(
			join(linkedTree, 'node_modules/@sveltejs/kit/runtime'),
			join(linkedTree, 'node_modules/@sveltejs/kit/linked-runtime'),
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		expect(() => observeDirectSvelteKitPackageIdentity(linkedTree)).toThrow(
			'package tree contains a symbolic link'
		);

		const deepTree = directIdentityFixture();
		write(
			deepTree,
			`node_modules/@sveltejs/kit/${Array.from({ length: 66 }, () => 'd').join('/')}/value.js`,
			'export default 1;\n'
		);
		expect(() => observeDirectSvelteKitPackageIdentity(deepTree)).toThrow(
			'package tree exceeds its depth limit'
		);
	});

	it('enforces direct-package and repository-scan duration boundaries', () => {
		const directRoot = directIdentityFixture();
		let clock = vi
			.spyOn(Date, 'now')
			.mockReturnValueOnce(0)
			.mockReturnValue(Number.MAX_SAFE_INTEGER);
		try {
			expect(() => observeDirectSvelteKitPackageIdentity(directRoot)).toThrow(
				'package traversal exceeded its duration limit'
			);
		} finally {
			clock.mockRestore();
		}

		const closureRoot = fixture();
		clock = vi.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValue(Number.MAX_SAFE_INTEGER);
		try {
			expect(() => observeSvelteKitSyncGenerator(closureRoot)).toThrow(
				'environment-file scan exceeded its duration limit'
			);
		} finally {
			clock.mockRestore();
		}
	});

	it('rejects a nonliteral call through an admitted require alias', () => {
		const root = fixture();
		write(
			root,
			'apps/rph-demo/vite.config.ts',
			"import { createRequire } from 'node:module';\n" +
				'const loader = createRequire(import.meta.url);\n' +
				"const selected = 'fixture-dep';\n" +
				'export default loader(selected);\n'
		);
		expect(() => observeSvelteKitSyncGenerator(root)).toThrow('nonliteral module load');
	});
});
