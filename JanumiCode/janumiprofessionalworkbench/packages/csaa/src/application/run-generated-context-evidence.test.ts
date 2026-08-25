import {
	existsSync,
	linkSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	symlinkSync,
	unlinkSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	GENERATED_CONTEXT_EXECUTION_MANIFEST_SCHEMA_VERSION,
	type GeneratedContextEvidenceRecord,
	type GeneratedContextExecutionManifest
} from '../contracts/subject.js';
import { canonicalJson, compareText, sha256 } from '../inventory/canonical.js';
import { generatedContextExecutionManifestDigest } from '../subject/svelte-kit-execution-closure.js';
import * as publicApi from '../index.js';
import {
	RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH,
	RPH_DEMO_GENERATED_CONTEXT_PATH,
	SVELTE_KIT_SYNC_GENERATOR_ID,
	type SvelteKitSyncGeneratorObservation
} from '../subject/svelte-kit-generator.js';
import { runGeneratedContextEvidenceForTest } from './run-generated-context-evidence.js';

const roots: string[] = [];
const INTEGRITY = `sha512-${'A'.repeat(86)}==`;

function write(root: string, path: string, contents: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, contents, 'utf8');
}

function fixture(): string {
	const root = mkdtempSync(join(tmpdir(), 'csaa-generated-context-'));
	roots.push(root);
	write(
		root,
		'package.json',
		JSON.stringify({ name: 'fixture', private: true, workspaces: ['apps/*'] })
	);
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
	write(
		root,
		'apps/rph-demo/package.json',
		JSON.stringify({ name: '@fixture/rph-demo', private: true })
	);
	write(root, 'apps/rph-demo/svelte.config.js', 'export default {};\n');
	write(root, 'apps/rph-demo/vite.config.ts', 'export default {};\n');
	write(root, 'apps/rph-demo/src/index.ts', 'export const value = 1;\n');
	write(root, 'apps/rph-demo/src/page.svelte', '<script lang="ts">let value = 1;</script>\n');
	write(
		root,
		'apps/rph-demo/tsconfig.json',
		JSON.stringify({ extends: './.svelte-kit/tsconfig.json' })
	);
	write(
		root,
		RPH_DEMO_GENERATED_CONTEXT_PATH,
		JSON.stringify({
			compilerOptions: { noEmit: true },
			include: ['../src/**/*.ts', '../src/**/*.svelte', './types/**/$types.d.ts']
		})
	);
	write(
		root,
		'apps/rph-demo/.svelte-kit/types/route/$types.d.ts',
		'export type RouteParams = Record<string, never>;\n'
	);
	return root;
}

function testObservation(root: string): SvelteKitSyncGeneratorObservation {
	const manifestText = readFileSync(
		join(root, 'node_modules', '@sveltejs', 'kit', 'package.json'),
		'utf8'
	);
	const installed = JSON.parse(manifestText) as { readonly name: string; readonly version: string };
	const lockText = readFileSync(join(root, 'bun.lock'), 'utf8');
	if (!lockText.includes(`@sveltejs/kit@${installed.version}`))
		throw new Error('Installed and lockfile-resolved @sveltejs/kit versions differ.');
	const executionManifest: GeneratedContextExecutionManifest = {
		containmentPolicy:
			'node-permission-declared-input-absence-and-bound-package-read-empty-generated-and-scratch-read-write-bound-addons-and-child-process/2.0.0',
		configurationEntrypoints: [
			{
				imports: [],
				path: 'apps/rph-demo/svelte.config.js',
				sha256: sha256(readFileSync(join(root, 'apps/rph-demo/svelte.config.js')))
			},
			{
				imports: [],
				path: 'apps/rph-demo/vite.config.ts',
				sha256: sha256(readFileSync(join(root, 'apps/rph-demo/vite.config.ts')))
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
			path: 'apps/rph-demo/.svelte-kit',
			replay: 'RESET_TO_EMPTY_BEFORE_EACH_SYNCHRONIZATION'
		},
		invocation: ['svelte-kit.js', 'sync', '--mode', 'production'],
		lockfile: { path: 'bun.lock', sha256: sha256(lockText) },
		missingOptionalPackages: [],
		packages: [
			{
				bytes: Buffer.byteLength(manifestText),
				fileCount: 2,
				integrity: INTEGRITY,
				locator: 'node_modules/@sveltejs/kit',
				lockKey: '@sveltejs/kit',
				manifestSha256: sha256(manifestText),
				name: installed.name,
				treeSha256: sha256(
					`${manifestText}\0${readFileSync(join(root, 'node_modules/@sveltejs/kit/svelte-kit.js'), 'utf8')}`
				),
				version: installed.version
			},
			{
				bytes: 1,
				fileCount: 1,
				integrity: INTEGRITY,
				locator: 'node_modules/typescript',
				lockKey: 'typescript',
				manifestSha256: 'c'.repeat(64),
				name: 'typescript',
				treeSha256: 'd'.repeat(64),
				version: '5.9.2'
			},
			{
				bytes: 1,
				fileCount: 1,
				integrity: INTEGRITY,
				locator: 'node_modules/vite',
				lockKey: 'vite',
				manifestSha256: 'e'.repeat(64),
				name: 'vite',
				treeSha256: 'f'.repeat(64),
				version: '7.1.5'
			}
		],
		readGrantProfile: 'svelte-kit-sync-project-defaults/1.0.0',
		repositoryReadGrants: [
			...[
				'apps/rph-demo/.env',
				'apps/rph-demo/.env.local',
				'apps/rph-demo/.env.production',
				'apps/rph-demo/.env.production.local',
				'apps/rph-demo/static',
				'apps/rph-demo/svelte.config.ts',
				'apps/rph-demo/vite.config.cjs',
				'apps/rph-demo/vite.config.cts',
				'apps/rph-demo/vite.config.js',
				'apps/rph-demo/vite.config.mjs',
				'apps/rph-demo/vite.config.mts'
			].map((path) => ({ kind: 'ABSENT_PATH' as const, path })),
			...[
				'apps/rph-demo/package.json',
				'apps/rph-demo/svelte.config.js',
				'apps/rph-demo/tsconfig.json',
				'apps/rph-demo/vite.config.ts',
				'bun.lock',
				'package.json'
			].map((path) => ({ kind: 'FILE' as const, path })),
			{ kind: 'DIRECTORY' as const, path: 'apps/rph-demo/src' },
			{ kind: 'DIRECTORY' as const, path: 'node_modules/@sveltejs/kit' },
			{ kind: 'DIRECTORY' as const, path: 'node_modules/typescript' },
			{ kind: 'DIRECTORY' as const, path: 'node_modules/vite' }
		].sort((left, right) => compareText(left.path, right.path)),
		runtime: {
			architecture: 'x64',
			engine: 'node',
			executableBytes: 1,
			executableSha256: 'a'.repeat(64),
			platform: 'linux',
			version: 'v24.0.0',
			versionsDigest: 'b'.repeat(64)
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
		entryPath: join(root, 'node_modules/@sveltejs/kit/svelte-kit.js'),
		executionManifest,
		generator: {
			id: SVELTE_KIT_SYNC_GENERATOR_ID,
			implementationDigest: generatedContextExecutionManifestDigest(executionManifest),
			version: installed.version
		},
		nodeExecutable: process.execPath
	};
}

function run(
	root: string,
	mode: 'check' | 'write',
	hooks: { readonly afterCommit?: () => void; readonly beforeCommit?: () => void } = {}
) {
	return runGeneratedContextEvidenceForTest({
		...hooks,
		mode,
		observeGenerator: testObservation,
		repositoryRoot: root,
		synchronize: () => undefined
	});
}

function rewriteExecutionManifest(
	root: string,
	transform: (manifest: GeneratedContextExecutionManifest) => GeneratedContextExecutionManifest
): void {
	const absolute = join(root, ...RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH.split('/'));
	const recorded = JSON.parse(readFileSync(absolute, 'utf8')) as GeneratedContextEvidenceRecord;
	const executionManifest = transform(recorded.executionManifest);
	const executionManifestDigest = generatedContextExecutionManifestDigest(executionManifest);
	writeFileSync(
		absolute,
		canonicalJson({
			...recorded,
			executionManifest,
			executionManifestDigest,
			generator: { ...recorded.generator, implementationDigest: executionManifestDigest }
		}),
		'utf8'
	);
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe('generated-context evidence runner', () => {
	it('writes canonical self-excluding evidence and converges with check mode', () => {
		const root = fixture();
		expect(() => run(root, 'check')).toThrow('Required generated-context evidence is absent.');

		const written = run(root, 'write');
		const absolute = join(root, ...RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH.split('/'));
		const bytes = readFileSync(absolute, 'utf8');
		expect(bytes).toBe(canonicalJson(written.record));
		expect(written.record.inputManifest.map((entry) => entry.path)).not.toContain(
			RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH
		);
		expect(written.record.generatedOutputManifest.map((entry) => entry.path)).toEqual([
			RPH_DEMO_GENERATED_CONTEXT_PATH,
			'apps/rph-demo/.svelte-kit/types/route/$types.d.ts'
		]);
		const checked = run(root, 'check');
		expect(checked).toMatchObject({ difference: null, ok: true, subjectId: written.subjectId });
	});

	it('keeps check mode observational and never observes or executes the current generator', () => {
		const root = fixture();
		run(root, 'write');
		let synchronizations = 0;
		const checked = runGeneratedContextEvidenceForTest({
			mode: 'check',
			observeGenerator: () => {
				throw new Error('check mode observed the current generator');
			},
			repositoryRoot: root,
			synchronize: () => {
				synchronizations += 1;
			}
		});
		expect(checked.ok).toBe(true);
		expect(synchronizations).toBe(0);
	});

	it('detects authored and generated-output drift while preserving historical generator evidence', () => {
		const root = fixture();
		run(root, 'write');
		write(root, 'apps/rph-demo/src/index.ts', 'export const value = 2;\n');
		expect(run(root, 'check').ok).toBe(false);
		run(root, 'write');
		write(
			root,
			'apps/rph-demo/.svelte-kit/types/route/$types.d.ts',
			'export type RouteParams = { changed: true };\n'
		);
		expect(run(root, 'check').ok).toBe(false);
		run(root, 'write');
		const absolute = join(root, ...RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH.split('/'));
		const beforeGeneratorUpdate = readFileSync(absolute, 'utf8');
		write(root, 'node_modules/@sveltejs/kit/svelte-kit.js', 'export const changed = true;\n');
		expect(run(root, 'check').ok).toBe(true);
		run(root, 'write');
		expect(readFileSync(absolute, 'utf8')).not.toBe(beforeGeneratorUpdate);
	});

	it('checks historical runtime evidence independently of the current host profile', () => {
		const root = fixture();
		run(root, 'write');
		const absolute = join(root, ...RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH.split('/'));
		const recorded = JSON.parse(readFileSync(absolute, 'utf8')) as GeneratedContextEvidenceRecord;
		const executionManifest: GeneratedContextExecutionManifest = {
			...recorded.executionManifest,
			runtime: {
				...recorded.executionManifest.runtime,
				architecture: 'arm64',
				executableSha256: 'c'.repeat(64),
				platform: 'linux',
				version: 'v99.1.2',
				versionsDigest: 'd'.repeat(64)
			}
		};
		const executionManifestDigest = generatedContextExecutionManifestDigest(executionManifest);
		const rewritten: GeneratedContextEvidenceRecord = {
			...recorded,
			executionManifest,
			executionManifestDigest,
			generator: {
				...recorded.generator,
				implementationDigest: executionManifestDigest
			}
		};
		writeFileSync(absolute, canonicalJson(rewritten), 'utf8');
		const checked = runGeneratedContextEvidenceForTest({
			mode: 'check',
			observeGenerator: () => {
				throw new Error('check mode observed the current host profile');
			},
			repositoryRoot: root,
			synchronize: () => {
				throw new Error('check mode executed the historical profile');
			}
		});
		expect(checked.ok).toBe(true);
		expect(checked.record.executionManifest.runtime).toMatchObject({
			architecture: 'arm64',
			platform: 'linux',
			version: 'v99.1.2'
		});
	});

	it('rejects execution configuration evidence that does not reconcile with bound inputs', () => {
		const root = fixture();
		run(root, 'write');
		const absolute = join(root, ...RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH.split('/'));
		const recorded = JSON.parse(readFileSync(absolute, 'utf8')) as GeneratedContextEvidenceRecord;
		const executionManifest: GeneratedContextExecutionManifest = {
			...recorded.executionManifest,
			configurationEntrypoints: recorded.executionManifest.configurationEntrypoints.map(
				(entry, index) => (index === 0 ? { ...entry, sha256: 'c'.repeat(64) } : entry)
			)
		};
		const executionManifestDigest = generatedContextExecutionManifestDigest(executionManifest);
		writeFileSync(
			absolute,
			canonicalJson({
				...recorded,
				executionManifest,
				executionManifestDigest,
				generator: { ...recorded.generator, implementationDigest: executionManifestDigest }
			}),
			'utf8'
		);
		expect(() => run(root, 'check')).toThrow(
			'Generation record execution configuration does not reconcile with its input manifest.'
		);
	});

	it('rejects a rebound execution manifest with an incomplete declared read closure', () => {
		const root = fixture();
		run(root, 'write');
		const absolute = join(root, ...RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH.split('/'));
		const recorded = JSON.parse(readFileSync(absolute, 'utf8')) as GeneratedContextEvidenceRecord;
		const executionManifest: GeneratedContextExecutionManifest = {
			...recorded.executionManifest,
			repositoryReadGrants: [{ kind: 'FILE', path: 'package.json' }]
		};
		const executionManifestDigest = generatedContextExecutionManifestDigest(executionManifest);
		writeFileSync(
			absolute,
			canonicalJson({
				...recorded,
				executionManifest,
				executionManifestDigest,
				generator: { ...recorded.generator, implementationDigest: executionManifestDigest }
			}),
			'utf8'
		);
		expect(() => run(root, 'check')).toThrow(
			'Generation record execution configuration does not have an exact file-read grant.'
		);
	});

	it('rejects every rebound omission from the exact synchronization profile', () => {
		for (const mutation of [
			(manifest: GeneratedContextExecutionManifest): GeneratedContextExecutionManifest => ({
				...manifest,
				repositoryReadGrants: manifest.repositoryReadGrants.filter(
					(grant) => grant.path !== 'apps/rph-demo/static'
				)
			}),
			(manifest: GeneratedContextExecutionManifest): GeneratedContextExecutionManifest => ({
				...manifest,
				repositoryReadGrants: manifest.repositoryReadGrants.filter(
					(grant) => grant.path !== 'apps/rph-demo/package.json'
				)
			}),
			(manifest: GeneratedContextExecutionManifest): GeneratedContextExecutionManifest => ({
				...manifest,
				configurationEntrypoints: manifest.configurationEntrypoints.filter(
					(entry) => entry.path !== 'apps/rph-demo/vite.config.ts'
				)
			})
		]) {
			const root = fixture();
			run(root, 'write');
			rewriteExecutionManifest(root, mutation);
			expect(() => run(root, 'check')).toThrow(
				'Generation record repository read grants do not match its exact synchronization profile.'
			);
		}
	});

	it('rejects rebound package-seed, configuration-import, and lock-key gaps', () => {
		const missingSeed = fixture();
		run(missingSeed, 'write');
		rewriteExecutionManifest(missingSeed, (manifest) => ({
			...manifest,
			packages: manifest.packages.filter((record) => record.name !== 'typescript'),
			repositoryReadGrants: manifest.repositoryReadGrants.filter(
				(grant) => grant.path !== 'node_modules/typescript'
			)
		}));
		expect(() => run(missingSeed, 'check')).toThrow(
			'Generation record execution package closure omits a fixed synchronization seed.'
		);

		const missingImport = fixture();
		run(missingImport, 'write');
		rewriteExecutionManifest(missingImport, (manifest) => ({
			...manifest,
			configurationEntrypoints: manifest.configurationEntrypoints.map((entry, index) =>
				index === 0 ? { ...entry, imports: ['missing-adapter'] } : entry
			)
		}));
		expect(() => run(missingImport, 'check')).toThrow(
			'Generation record execution configuration import is absent from its package closure.'
		);

		for (const unsupportedImport of ['./local.js', 'node:fs']) {
			const root = fixture();
			run(root, 'write');
			rewriteExecutionManifest(root, (manifest) => ({
				...manifest,
				configurationEntrypoints: manifest.configurationEntrypoints.map((entry, index) =>
					index === 0 ? { ...entry, imports: [unsupportedImport] } : entry
				)
			}));
			expect(() => run(root, 'check')).toThrow(
				'Generation record has an invalid execution manifest.'
			);
		}

		const wrongLockKey = fixture();
		run(wrongLockKey, 'write');
		rewriteExecutionManifest(wrongLockKey, (manifest) => ({
			...manifest,
			packages: manifest.packages.map((record, index) =>
				index === 0 ? { ...record, lockKey: 'wrong' } : record
			)
		}));
		expect(() => run(wrongLockKey, 'check')).toThrow(
			'Generation record has an invalid execution manifest.'
		);
	});

	it('rejects a rebound manifest that violates the closed execution environment', () => {
		const root = fixture();
		run(root, 'write');
		const absolute = join(root, ...RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH.split('/'));
		const recorded = JSON.parse(readFileSync(absolute, 'utf8')) as GeneratedContextEvidenceRecord;
		const executionManifest: GeneratedContextExecutionManifest = {
			...recorded.executionManifest,
			environment: recorded.executionManifest.environment.map((entry) =>
				entry.name === 'CI' ? { ...entry, value: '0' } : entry
			)
		};
		const executionManifestDigest = generatedContextExecutionManifestDigest(executionManifest);
		writeFileSync(
			absolute,
			canonicalJson({
				...recorded,
				executionManifest,
				executionManifestDigest,
				generator: { ...recorded.generator, implementationDigest: executionManifestDigest }
			}),
			'utf8'
		);
		expect(() => run(root, 'check')).toThrow(
			'Generation record has an invalid execution manifest.'
		);
	});

	it('rejects a generator version that does not reconcile with the bound SvelteKit package', () => {
		const root = fixture();
		run(root, 'write');
		const absolute = join(root, ...RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH.split('/'));
		const recorded = JSON.parse(readFileSync(absolute, 'utf8')) as GeneratedContextEvidenceRecord;
		writeFileSync(
			absolute,
			canonicalJson({
				...recorded,
				generator: { ...recorded.generator, version: '2.70.0' }
			}),
			'utf8'
		);
		expect(() => run(root, 'check')).toThrow(
			'Generation record generator version does not reconcile with its SvelteKit package.'
		);
	});

	it('rejects a package identity rebound to a different install locator', () => {
		const root = fixture();
		run(root, 'write');
		const absolute = join(root, ...RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH.split('/'));
		const recorded = JSON.parse(readFileSync(absolute, 'utf8')) as GeneratedContextEvidenceRecord;
		const executionManifest: GeneratedContextExecutionManifest = {
			...recorded.executionManifest,
			packages: recorded.executionManifest.packages.map((record) => ({
				...record,
				locator: 'node_modules/not-kit'
			}))
		};
		const executionManifestDigest = generatedContextExecutionManifestDigest(executionManifest);
		writeFileSync(
			absolute,
			canonicalJson({
				...recorded,
				executionManifest,
				executionManifestDigest,
				generator: { ...recorded.generator, implementationDigest: executionManifestDigest }
			}),
			'utf8'
		);
		expect(() => run(root, 'check')).toThrow(
			'Generation record has an invalid execution manifest.'
		);
	});

	it('rejects lock/install mismatch and generator mutation during synchronization', () => {
		const mismatch = fixture();
		write(
			mismatch,
			'node_modules/@sveltejs/kit/package.json',
			JSON.stringify({ name: '@sveltejs/kit', version: '2.70.0' })
		);
		expect(() => run(mismatch, 'write')).toThrow(
			'Installed and lockfile-resolved @sveltejs/kit versions differ.'
		);

		const changed = fixture();
		expect(() =>
			runGeneratedContextEvidenceForTest({
				mode: 'write',
				observeGenerator: testObservation,
				repositoryRoot: changed,
				synchronize: () =>
					write(changed, 'node_modules/@sveltejs/kit/svelte-kit.js', 'export const changed = 1;\n')
			})
		).toThrow('SvelteKit generator identity changed during synchronization.');
	});

	it('refuses an active publication lock without breaking it', () => {
		const root = fixture();
		const lock = join(root, ...`${RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH}.lock`.split('/'));
		write(root, `${RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH}.lock`, 'active writer');
		expect(() => run(root, 'write')).toThrow(
			'Generated-context evidence publication lock is unavailable'
		);
		expect(readFileSync(lock, 'utf8')).toBe('active writer');
	});

	it('starts both synchronization passes from empty generated roots', () => {
		const root = fixture();
		write(root, 'apps/rph-demo/.svelte-kit/stale-only.txt', 'must not be an input\n');
		let attempts = 0;
		const result = runGeneratedContextEvidenceForTest({
			isolateGeneratedOutput: true,
			mode: 'write',
			observeGenerator: testObservation,
			repositoryRoot: root,
			synchronize: () => {
				attempts += 1;
				expect(readdirSync(join(root, 'apps/rph-demo/.svelte-kit'))).toEqual([]);
				write(
					root,
					RPH_DEMO_GENERATED_CONTEXT_PATH,
					JSON.stringify({ compilerOptions: { noEmit: true } })
				);
				write(
					root,
					'apps/rph-demo/.svelte-kit/types/route/$types.d.ts',
					'export type RouteParams = Record<string, never>;\n'
				);
			}
		});
		expect(attempts).toBe(2);
		expect(result.ok).toBe(true);
		expect(existsSync(join(root, 'apps/rph-demo/.svelte-kit/stale-only.txt'))).toBe(false);
	});

	it('starts both passes from empty scratch and restores the exact prior scratch tree', () => {
		const root = fixture();
		write(root, 'node_modules/.vite-temp/prior-marker.txt', 'preserve scratch\n');
		let attempts = 0;
		const result = runGeneratedContextEvidenceForTest({
			isolateGeneratedOutput: true,
			mode: 'write',
			observeGenerator: testObservation,
			repositoryRoot: root,
			synchronize: () => {
				attempts += 1;
				expect(readdirSync(join(root, 'node_modules/.vite-temp'))).toEqual([]);
				write(root, 'node_modules/.vite-temp/pass-marker.txt', `pass ${String(attempts)}\n`);
				write(root, RPH_DEMO_GENERATED_CONTEXT_PATH, '{"generated":true}\n');
				write(
					root,
					'apps/rph-demo/.svelte-kit/types/route/$types.d.ts',
					'export type RouteParams = { generated: true };\n'
				);
			}
		});
		expect(attempts).toBe(2);
		expect(result.cleanup).toEqual({ retainedPaths: [], state: 'COMPLETE' });
		expect(readdirSync(join(root, 'node_modules/.vite-temp'))).toEqual(['prior-marker.txt']);
		expect(readFileSync(join(root, 'node_modules/.vite-temp/prior-marker.txt'), 'utf8')).toBe(
			'preserve scratch\n'
		);
		expect(
			readdirSync(join(root, 'node_modules')).filter((name) =>
				name.startsWith('.csaa-generated-context-')
			)
		).toEqual([]);
	});

	it('refuses a one-time authored mutation instead of blessing it as the replay baseline', () => {
		const root = fixture();
		write(root, RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH, 'prior evidence\n');
		let attempts = 0;
		expect(() =>
			runGeneratedContextEvidenceForTest({
				isolateGeneratedOutput: true,
				mode: 'write',
				observeGenerator: testObservation,
				repositoryRoot: root,
				synchronize: () => {
					attempts += 1;
					if (attempts === 1)
						write(root, 'apps/rph-demo/src/index.ts', 'export const value = 99;\n');
					write(root, RPH_DEMO_GENERATED_CONTEXT_PATH, '{"generated":true}\n');
					write(
						root,
						'apps/rph-demo/.svelte-kit/types/route/$types.d.ts',
						'export type RouteParams = { generated: true };\n'
					);
				}
			})
		).toThrow('Generated-context authored inputs changed during synchronization.');
		expect(
			readFileSync(join(root, ...RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH.split('/')), 'utf8')
		).toBe('prior evidence\n');
	});

	it('binds the evidence preimage before synchronization begins', () => {
		const root = fixture();
		write(root, RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH, 'prior evidence\n');
		const concurrent = '{"concurrent":"during-sync"}\n';
		let attempts = 0;
		expect(() =>
			runGeneratedContextEvidenceForTest({
				mode: 'write',
				observeGenerator: testObservation,
				repositoryRoot: root,
				synchronize: () => {
					attempts += 1;
					if (attempts === 1) write(root, RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH, concurrent);
				}
			})
		).toThrow('Generated-context evidence target changed before publication.');
		expect(
			readFileSync(join(root, ...RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH.split('/')), 'utf8')
		).toBe(concurrent);
	});

	it('restores the exact prior generated tree when an isolated replay fails', () => {
		const root = fixture();
		write(root, 'apps/rph-demo/.svelte-kit/prior-only.txt', 'preserve me\n');
		const previous = readFileSync(join(root, ...RPH_DEMO_GENERATED_CONTEXT_PATH.split('/')));
		let attempts = 0;
		expect(() =>
			runGeneratedContextEvidenceForTest({
				isolateGeneratedOutput: true,
				mode: 'write',
				observeGenerator: testObservation,
				repositoryRoot: root,
				synchronize: () => {
					attempts += 1;
					if (attempts === 2) throw new Error('injected isolated replay failure');
					write(root, RPH_DEMO_GENERATED_CONTEXT_PATH, '{"generated":true}\n');
					write(
						root,
						'apps/rph-demo/.svelte-kit/types/route/$types.d.ts',
						'export type RouteParams = { generated: true };\n'
					);
				}
			})
		).toThrow('injected isolated replay failure');
		expect(readFileSync(join(root, ...RPH_DEMO_GENERATED_CONTEXT_PATH.split('/')))).toEqual(
			previous
		);
		expect(readFileSync(join(root, 'apps/rph-demo/.svelte-kit/prior-only.txt'), 'utf8')).toBe(
			'preserve me\n'
		);
	});

	it('atomically restores prior evidence, generated output, and scratch on isolated failures', () => {
		for (const failure of ['SECOND_PASS', 'AFTER_COMMIT', 'PREPARE_SCRATCH'] as const) {
			const root = fixture();
			run(root, 'write');
			const evidence = join(root, ...RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH.split('/'));
			const priorEvidence = readFileSync(evidence);
			write(root, 'apps/rph-demo/.svelte-kit/prior-only.txt', 'prior generated\n');
			write(root, 'node_modules/.vite-temp/prior-only.txt', 'prior scratch\n');
			const priorGenerated = readFileSync(
				join(root, ...RPH_DEMO_GENERATED_CONTEXT_PATH.split('/'))
			);
			let attempts = 0;
			expect(() =>
				runGeneratedContextEvidenceForTest({
					afterCommit:
						failure === 'AFTER_COMMIT'
							? () => {
									throw new Error('injected after-commit failure');
								}
							: undefined,
					beforeTransactionPrepareRestore:
						failure === 'PREPARE_SCRATCH'
							? () => {
									throw new Error('injected scratch-restore failure');
								}
							: undefined,
					isolateGeneratedOutput: true,
					mode: 'write',
					observeGenerator: testObservation,
					repositoryRoot: root,
					synchronize: () => {
						attempts += 1;
						if (failure === 'SECOND_PASS' && attempts === 2)
							throw new Error('injected second-pass failure');
						write(root, RPH_DEMO_GENERATED_CONTEXT_PATH, '{"generated":true}\n');
						write(
							root,
							'apps/rph-demo/.svelte-kit/types/route/$types.d.ts',
							'export type RouteParams = { generated: true };\n'
						);
					}
				})
			).toThrow('injected');
			expect(readFileSync(evidence)).toEqual(priorEvidence);
			expect(readFileSync(join(root, ...RPH_DEMO_GENERATED_CONTEXT_PATH.split('/')))).toEqual(
				priorGenerated
			);
			expect(readFileSync(join(root, 'apps/rph-demo/.svelte-kit/prior-only.txt'), 'utf8')).toBe(
				'prior generated\n'
			);
			expect(readFileSync(join(root, 'node_modules/.vite-temp/prior-only.txt'), 'utf8')).toBe(
				'prior scratch\n'
			);
			expect(
				readdirSync(join(root, 'node_modules')).filter((name) =>
					name.startsWith('.csaa-generated-context-')
				)
			).toEqual([]);
		}
	});

	it('reports post-commit cleanup as pending without turning a committed result into failure', () => {
		const root = fixture();
		write(root, 'node_modules/.vite-temp/prior-only.txt', 'prior scratch\n');
		const result = runGeneratedContextEvidenceForTest({
			beforeTransactionCleanup: () => {
				throw new Error('injected cleanup failure');
			},
			isolateGeneratedOutput: true,
			mode: 'write',
			observeGenerator: testObservation,
			repositoryRoot: root,
			synchronize: () => {
				write(root, RPH_DEMO_GENERATED_CONTEXT_PATH, '{"generated":true}\n');
				write(
					root,
					'apps/rph-demo/.svelte-kit/types/route/$types.d.ts',
					'export type RouteParams = { generated: true };\n'
				);
			}
		});
		expect(result.ok).toBe(true);
		expect(result.cleanup.state).toBe('PENDING');
		expect(result.cleanup.retainedPaths.length).toBeGreaterThan(0);
		expect(readFileSync(join(root, 'node_modules/.vite-temp/prior-only.txt'), 'utf8')).toBe(
			'prior scratch\n'
		);
	});

	it('refuses a hard-linked exact file grant before spawning synchronization', () => {
		const root = fixture();
		const outside = mkdtempSync(join(tmpdir(), 'csaa-generated-context-hardlink-input-'));
		roots.unshift(outside);
		const outsideFile = join(outside, 'shared-config.js');
		writeFileSync(outsideFile, 'export default {};\n', 'utf8');
		const config = join(root, 'apps/rph-demo/svelte.config.js');
		unlinkSync(config);
		linkSync(outsideFile, config);
		expect(() =>
			runGeneratedContextEvidenceForTest({
				isolateGeneratedOutput: true,
				mode: 'write',
				observeGenerator: testObservation,
				repositoryRoot: root
			})
		).toThrow('Generated-context file read grant is not a private physical file');
		expect(readFileSync(outsideFile, 'utf8')).toBe('export default {};\n');
	});

	it('refuses a hard-linked generated file before synchronization', () => {
		const root = fixture();
		const outside = mkdtempSync(join(tmpdir(), 'csaa-generated-context-hardlink-'));
		roots.unshift(outside);
		const outsideFile = join(outside, 'shared-tsconfig.json');
		writeFileSync(outsideFile, '{"outside":true}\n', 'utf8');
		const generatedConfig = join(root, ...RPH_DEMO_GENERATED_CONTEXT_PATH.split('/'));
		unlinkSync(generatedConfig);
		linkSync(outsideFile, generatedConfig);
		expect(() =>
			runGeneratedContextEvidenceForTest({
				isolateGeneratedOutput: true,
				mode: 'write',
				observeGenerator: testObservation,
				repositoryRoot: root,
				synchronize: () => undefined
			})
		).toThrow('contains a hard-linked file escape');
		expect(readFileSync(outsideFile, 'utf8')).toBe('{"outside":true}\n');
	});

	it('refuses an evidence-parent link before creating a lock or writing outside the repository', () => {
		const root = fixture();
		const outside = mkdtempSync(join(tmpdir(), 'csaa-generated-context-outside-'));
		roots.unshift(outside);
		mkdirSync(join(root, 'verif'), { recursive: true });
		symlinkSync(
			outside,
			join(root, 'verif', 'csaa'),
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		expect(() => run(root, 'write')).toThrow(
			'Generated-context evidence target parent contains a link or non-directory entry.'
		);
		expect(existsSync(join(outside, 'rph-demo.svelte-kit.generated-context.evidence.json'))).toBe(
			false
		);
		expect(
			existsSync(join(outside, 'rph-demo.svelte-kit.generated-context.evidence.json.lock'))
		).toBe(false);
	});

	it('uses compare-and-swap before commit and preserves a concurrent target', () => {
		const root = fixture();
		run(root, 'write');
		const absolute = join(root, ...RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH.split('/'));
		const concurrent = '{"concurrent":"before-commit"}\n';
		expect(() =>
			run(root, 'write', {
				beforeCommit: () => writeFileSync(absolute, concurrent, 'utf8')
			})
		).toThrow('Generated-context evidence target changed before publication.');
		expect(readFileSync(absolute, 'utf8')).toBe(concurrent);
	});

	it('does not clobber a concurrent target written after commit', () => {
		const root = fixture();
		run(root, 'write');
		const absolute = join(root, ...RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH.split('/'));
		const concurrent = '{"concurrent":"after-commit"}\n';
		expect(() =>
			run(root, 'write', {
				afterCommit: () => {
					writeFileSync(absolute, concurrent, 'utf8');
					throw new Error('concurrent writer injected');
				}
			})
		).toThrow('newer bytes were preserved');
		expect(readFileSync(absolute, 'utf8')).toBe(concurrent);
	});

	it('refuses nondeterministic replay and releases its publication lock', () => {
		const root = fixture();
		let attempt = 0;
		expect(() =>
			runGeneratedContextEvidenceForTest({
				mode: 'write',
				observeGenerator: testObservation,
				repositoryRoot: root,
				synchronize: () => {
					attempt += 1;
					write(
						root,
						'apps/rph-demo/.svelte-kit/types/route/$types.d.ts',
						`export type RouteParams = { attempt: ${String(attempt)} };\n`
					);
				}
			})
		).toThrow('did not reproduce identical bound manifests');
		expect(
			existsSync(join(root, ...`${RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH}.lock`.split('/')))
		).toBe(false);
	});

	it('rolls back the previous exact evidence bytes after a synchronous publication failure', () => {
		const root = fixture();
		run(root, 'write');
		const absolute = join(root, ...RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH.split('/'));
		const previous = readFileSync(absolute, 'utf8');
		write(root, 'apps/rph-demo/src/index.ts', 'export const value = 3;\n');
		expect(() =>
			run(root, 'write', {
				afterCommit: () => {
					throw new Error('injected publication failure');
				}
			})
		).toThrow('injected publication failure');
		expect(readFileSync(absolute, 'utf8')).toBe(previous);
	});

	it('rolls back evidence when a bound subject input changes after commit', () => {
		const root = fixture();
		run(root, 'write');
		const absolute = join(root, ...RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH.split('/'));
		const previous = readFileSync(absolute, 'utf8');
		expect(() =>
			run(root, 'write', {
				afterCommit: () => {
					write(root, 'apps/rph-demo/src/index.ts', 'export const value = 99;\n');
				}
			})
		).toThrow('Generated-context authored inputs changed after publication.');
		expect(readFileSync(absolute, 'utf8')).toBe(previous);
	});

	it('refuses an oversized existing evidence target before reading it', () => {
		const root = fixture();
		write(root, RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH, 'x'.repeat(16 * 1024 * 1024 + 1));
		expect(() => run(root, 'check')).toThrow(
			'Generated-context evidence target exceeds its byte limit.'
		);
	});

	it('rejects invalid UTF-8 bytes before canonical parsing or comparison', () => {
		const root = fixture();
		run(root, 'write');
		const absolute = join(root, ...RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH.split('/'));
		const recorded = JSON.parse(readFileSync(absolute, 'utf8')) as GeneratedContextEvidenceRecord;
		const executionManifest: GeneratedContextExecutionManifest = {
			...recorded.executionManifest,
			environment: [
				...recorded.executionManifest.environment,
				{ name: 'SystemRoot', value: 'C:\\\uFFFD' },
				{ name: 'WINDIR', value: 'C:\\\uFFFD' }
			].sort((left, right) => compareText(left.name, right.name)),
			runtime: { ...recorded.executionManifest.runtime, platform: 'win32' }
		};
		const executionManifestDigest = generatedContextExecutionManifestDigest(executionManifest);
		const rewritten: GeneratedContextEvidenceRecord = {
			...recorded,
			executionManifest,
			executionManifestDigest,
			generator: {
				...recorded.generator,
				implementationDigest: executionManifestDigest
			}
		};
		const valid = Buffer.from(canonicalJson(rewritten), 'utf8');
		const replacement = Buffer.from('\uFFFD', 'utf8');
		const offset = valid.indexOf(replacement);
		expect(offset).toBeGreaterThanOrEqual(0);
		const invalid = Buffer.concat([
			valid.subarray(0, offset),
			Buffer.from([0xff]),
			valid.subarray(offset + replacement.byteLength)
		]);
		writeFileSync(absolute, invalid);
		expect(() => run(root, 'check')).toThrow('Generation record is not valid UTF-8.');
	});

	it('does not expose test-only generated-context seams from the package root', () => {
		expect('runGeneratedContextEvidenceForTest' in publicApi).toBe(false);
	});
});
