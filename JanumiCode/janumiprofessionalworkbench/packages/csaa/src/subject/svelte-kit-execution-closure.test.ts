import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { observeSvelteKitSyncGenerator } from './svelte-kit-generator.js';

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

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe('SvelteKit synchronization execution closure', () => {
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
});
