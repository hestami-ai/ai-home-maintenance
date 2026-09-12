import { createHash } from 'node:crypto';
import {
	mkdtempSync,
	mkdirSync,
	readFileSync,
	realpathSync,
	renameSync,
	rmSync,
	statSync,
	symlinkSync,
	writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canonicalSemanticJsonWitness } from '../../semantic/canonical.js';
import {
	ARROW_COMMAND_CENSUS_EXTERNAL_MODULE_CONTENT_PROFILE,
	ARROW_COMMAND_CENSUS_EXTERNAL_MODULE_NAMES,
	ArrowCommandCensusExecutorEnvironmentError,
	resolveArrowCommandCensusExecutorEnvironment
} from './executor-environment.js';

type RuntimeFunction = (...args: unknown[]) => unknown;

const filesystemFaults = vi.hoisted(() => ({
	hooks: new Map<string, (actualFunction: RuntimeFunction, args: readonly unknown[]) => unknown>()
}));

const childProcessFaults = vi.hoisted(() => ({
	spawnSync: null as null | ((actualFunction: RuntimeFunction, args: readonly unknown[]) => unknown)
}));

vi.mock('node:fs', async (importOriginal) => {
	const actual = await importOriginal<typeof import('node:fs')>();
	const invoke = (
		name: string,
		actualFunction: RuntimeFunction,
		args: readonly unknown[]
	): unknown => {
		const hook = filesystemFaults.hooks.get(name);
		return hook === undefined
			? Reflect.apply(actualFunction, undefined, args)
			: hook(actualFunction, args);
	};
	const realpath = Object.assign(
		(...args: unknown[]) =>
			invoke('realpathSync', actual.realpathSync as unknown as RuntimeFunction, args),
		{
			native: (...args: unknown[]) =>
				invoke(
					'realpathSync.native',
					actual.realpathSync.native as unknown as RuntimeFunction,
					args
				)
		}
	);
	return {
		...actual,
		fstatSync: (...args: unknown[]) =>
			invoke('fstatSync', actual.fstatSync as unknown as RuntimeFunction, args),
		lstatSync: (...args: unknown[]) =>
			invoke('lstatSync', actual.lstatSync as unknown as RuntimeFunction, args),
		openSync: (...args: unknown[]) =>
			invoke('openSync', actual.openSync as unknown as RuntimeFunction, args),
		readSync: (...args: unknown[]) =>
			invoke('readSync', actual.readSync as unknown as RuntimeFunction, args),
		readdirSync: (...args: unknown[]) =>
			invoke('readdirSync', actual.readdirSync as unknown as RuntimeFunction, args),
		realpathSync: realpath
	};
});

vi.mock('node:child_process', async (importOriginal) => {
	const actual = await importOriginal<typeof import('node:child_process')>();
	return {
		...actual,
		spawnSync: (...args: unknown[]) =>
			childProcessFaults.spawnSync === null
				? Reflect.apply(actual.spawnSync as unknown as RuntimeFunction, undefined, args)
				: childProcessFaults.spawnSync(actual.spawnSync as unknown as RuntimeFunction, args)
	};
});

const roots: string[] = [];

interface FixtureModule {
	readonly index: string;
	readonly manifest: string;
	readonly root: string;
	readonly version: string;
}

interface EnvironmentFixture {
	readonly modules: Readonly<Record<'typescript' | 'ulid' | 'zod', FixtureModule>>;
	readonly root: string;
	readonly workerPath: string;
}

function writeModule(root: string, name: 'typescript' | 'ulid' | 'zod'): FixtureModule {
	const moduleRoot = join(root, 'node_modules', name);
	mkdirSync(moduleRoot, { recursive: true });
	const version = `1.2.${name.length}`;
	const manifest = JSON.stringify({ name, version });
	const index = `export const moduleName = ${JSON.stringify(name)};\n`;
	writeFileSync(join(moduleRoot, 'package.json'), manifest);
	writeFileSync(join(moduleRoot, 'index.js'), index);
	return { index, manifest, root: realpathSync.native(moduleRoot), version };
}

function fixture(): EnvironmentFixture {
	const root = mkdtempSync(join(tmpdir(), 'jan-csaa-executor-environment-'));
	roots.push(root);
	const workerPath = join(root, 'worker.ts');
	writeFileSync(workerPath, 'export {};\n');
	return {
		modules: {
			typescript: writeModule(root, 'typescript'),
			ulid: writeModule(root, 'ulid'),
			zod: writeModule(root, 'zod')
		},
		root,
		workerPath
	};
}

function generousRequest(workerPath: string) {
	return {
		maxExternalModuleBytes: 1_000_000,
		maxExternalModuleFiles: 100,
		workerPath
	};
}

function installBunResolver(
	subject: EnvironmentFixture,
	resolver: (specifier: string, from: string) => string = (specifier) =>
		join(subject.root, 'node_modules', ...specifier.split('/'))
): string[] {
	const resolutions: string[] = [];
	vi.stubGlobal('Bun', {
		resolveSync(specifier: string, from: string): string {
			resolutions.push(`${specifier}\0${from}`);
			return resolver(specifier, from);
		},
		version: '1.3.14-test'
	});
	return resolutions;
}

function sha256(bytes: string | Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function callActual(actualFunction: RuntimeFunction, args: readonly unknown[]): unknown {
	return Reflect.apply(actualFunction, undefined, args);
}

function trackOpenedDescriptor(targetPath: string): { descriptor: number | undefined } {
	const tracker: { descriptor: number | undefined } = { descriptor: undefined };
	filesystemFaults.hooks.set('openSync', (actual, args) => {
		const descriptor = callActual(actual, args) as number;
		if (String(args[0]) === targetPath) tracker.descriptor = descriptor;
		return descriptor;
	});
	return tracker;
}

function alteredStat(stat: unknown, overrides: Readonly<Record<string, unknown>>): object {
	if (stat === null || typeof stat !== 'object')
		throw new Error('Expected filesystem stat object.');
	return new Proxy(stat, {
		get(target, property, receiver) {
			return typeof property === 'string' && Object.hasOwn(overrides, property)
				? overrides[property]
				: Reflect.get(target, property, receiver);
		}
	});
}

afterEach(() => {
	filesystemFaults.hooks.clear();
	childProcessFaults.spawnSync = null;
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe('arrow-command census executor environment', () => {
	it('keeps canonical executor identity stable across different private installation roots', () => {
		const firstSubject = fixture();
		installBunResolver(firstSubject);
		const first = resolveArrowCommandCensusExecutorEnvironment(
			generousRequest(firstSubject.workerPath)
		);
		const secondSubject = fixture();
		installBunResolver(secondSubject);
		const second = resolveArrowCommandCensusExecutorEnvironment(
			generousRequest(secondSubject.workerPath)
		);

		expect(secondSubject.root).not.toBe(firstSubject.root);
		expect(second.identity).toEqual(first.identity);
		expect(second.moduleRoots).not.toEqual(first.moduleRoots);
		expect(second.workerPath).not.toBe(first.workerPath);
	});

	it('binds Bun, the exact worker, and exactly the supported external modules deterministically', () => {
		const subject = fixture();
		const resolutions = installBunResolver(subject);
		const first = resolveArrowCommandCensusExecutorEnvironment(generousRequest(subject.workerPath));
		const second = resolveArrowCommandCensusExecutorEnvironment(
			generousRequest(subject.workerPath)
		);

		expect(ARROW_COMMAND_CENSUS_EXTERNAL_MODULE_NAMES).toEqual(['typescript', 'ulid', 'zod']);
		expect(second).toEqual(first);
		expect(first.identity.runtime).toBe('bun');
		expect(first.identity.runtimeVersion).toBe('1.3.14-test');
		expect(first.executable).toBe(realpathSync.native(process.execPath));
		expect(first.identity.executableBytes).toBe(statSync(process.execPath).size);
		expect(first.identity.executableSha256).toBe(sha256(readFileSync(process.execPath)));
		expect(first.identity.worker).toEqual({
			bytes: Buffer.byteLength('export {};\n'),
			sha256: sha256('export {};\n')
		});
		expect(first.workerPath).toBe(realpathSync.native(subject.workerPath));
		expect(JSON.stringify(first.identity)).not.toContain(subject.root);
		expect(JSON.stringify(first.identity)).not.toContain(realpathSync.native(process.execPath));
		expect(first.identity.externalModules.map((module) => module.name)).toEqual([
			'typescript',
			'ulid',
			'zod'
		]);
		expect(first.moduleRoots).toEqual({
			typescript: subject.modules.typescript.root,
			ulid: subject.modules.ulid.root,
			zod: subject.modules.zod.root
		});
		expect(resolutions).toEqual(
			['typescript', 'ulid', 'zod', 'typescript', 'ulid', 'zod'].map(
				(name) => `${name}/package.json\0${realpathSync.native(subject.workerPath)}`
			)
		);

		for (const moduleName of ARROW_COMMAND_CENSUS_EXTERNAL_MODULE_NAMES) {
			const expected = subject.modules[moduleName];
			const identity = first.identity.externalModules.find((module) => module.name === moduleName)!;
			const files = [
				{
					bytes: Buffer.byteLength(expected.index),
					path: 'index.js',
					sha256: sha256(expected.index)
				},
				{
					bytes: Buffer.byteLength(expected.manifest),
					path: 'package.json',
					sha256: sha256(expected.manifest)
				}
			];
			expect(identity).toEqual({
				bytes: files.reduce((total, file) => total + file.bytes, 0),
				contentDigest: canonicalSemanticJsonWitness({
					canonicalProfile: ARROW_COMMAND_CENSUS_EXTERNAL_MODULE_CONTENT_PROFILE,
					files,
					name: moduleName,
					version: expected.version
				}).sha256,
				files: 2,
				name: moduleName,
				version: expected.version
			});
		}
	});

	it('enforces the caller file budget cumulatively without a provider default', () => {
		const subject = fixture();
		installBunResolver(subject);
		expect(() =>
			resolveArrowCommandCensusExecutorEnvironment({
				...generousRequest(subject.workerPath),
				maxExternalModuleFiles: 1
			})
		).toThrowError(
			expect.objectContaining({
				code: 'BUDGET_EXHAUSTED',
				moduleName: 'typescript'
			})
		);
	});

	it('enforces the caller byte budget cumulatively without a provider default', () => {
		const subject = fixture();
		installBunResolver(subject);
		expect(() =>
			resolveArrowCommandCensusExecutorEnvironment({
				...generousRequest(subject.workerPath),
				maxExternalModuleBytes: 1
			})
		).toThrowError(
			expect.objectContaining({
				code: 'BUDGET_EXHAUSTED',
				moduleName: 'typescript'
			})
		);
	});

	it('fails closed when a package manifest claims the wrong name', () => {
		const subject = fixture();
		installBunResolver(subject);
		writeFileSync(
			join(subject.modules.typescript.root, 'package.json'),
			JSON.stringify({ name: 'not-typescript', version: '1.0.0' })
		);
		expect(() =>
			resolveArrowCommandCensusExecutorEnvironment(generousRequest(subject.workerPath))
		).toThrowError(
			expect.objectContaining({
				code: 'EXTERNAL_MODULE_MANIFEST_INVALID',
				moduleName: 'typescript'
			})
		);
	});

	it('rejects a symlinked module-tree entry instead of following or omitting it', () => {
		const subject = fixture();
		installBunResolver(subject);
		const target = join(subject.root, 'link-target');
		mkdirSync(target);
		symlinkSync(target, join(subject.modules.typescript.root, 'linked'), 'junction');
		expect(() =>
			resolveArrowCommandCensusExecutorEnvironment(generousRequest(subject.workerPath))
		).toThrowError(
			expect.objectContaining({
				code: 'EXTERNAL_MODULE_TREE_INVALID',
				moduleName: 'typescript'
			})
		);
	});

	it('rejects a non-regular module-tree entry', () => {
		const subject = fixture();
		installBunResolver(subject);
		const unusualPath = join(subject.modules.typescript.root, 'unusual-entry');
		writeFileSync(unusualPath, 'fixture');
		filesystemFaults.hooks.set('lstatSync', (actual, args) => {
			const stat = callActual(actual, args);
			return String(args[0]) === unusualPath
				? alteredStat(stat, { isDirectory: () => false, isFile: () => false })
				: stat;
		});
		expect(() =>
			resolveArrowCommandCensusExecutorEnvironment(generousRequest(subject.workerPath))
		).toThrowError(
			expect.objectContaining({ code: 'EXTERNAL_MODULE_TREE_INVALID', moduleName: 'typescript' })
		);
	});

	it('rejects a PATH-discovered Bun when its version probe is not stable', () => {
		const subject = fixture();
		const bin = join(subject.root, 'bin');
		mkdirSync(bin);
		writeFileSync(join(bin, process.platform === 'win32' ? 'bun.exe' : 'bun'), 'fixture');
		vi.stubEnv('PATH', bin);
		for (const result of [
			{ error: undefined, status: 1, stderr: '', stdout: '' },
			{ error: undefined, status: 0, stderr: 'warning', stdout: '1.3.14\n' },
			{ error: new Error('probe failed'), status: 0, stderr: '', stdout: '1.3.14\n' }
		]) {
			childProcessFaults.spawnSync = () => result;
			expect(() =>
				resolveArrowCommandCensusExecutorEnvironment(generousRequest(subject.workerPath))
			).toThrowError(expect.objectContaining({ code: 'BUN_REQUIRED' }));
		}
	});

	it('uses a stable PATH-discovered Bun through the worker-local resolver', () => {
		const subject = fixture();
		const bin = join(subject.root, 'bin');
		mkdirSync(bin);
		const executable = join(bin, process.platform === 'win32' ? 'bun.exe' : 'bun');
		writeFileSync(executable, 'fixture executable');
		vi.stubEnv('PATH', bin);
		childProcessFaults.spawnSync = () => ({
			error: undefined,
			status: 0,
			stderr: '',
			stdout: '9.9.9\n'
		});

		const result = resolveArrowCommandCensusExecutorEnvironment(
			generousRequest(subject.workerPath)
		);

		expect(result.executable).toBe(realpathSync.native(executable));
		expect(result.identity.runtimeVersion).toBe('9.9.9');
		expect(result.identity.externalModules.map(({ name }) => name)).toEqual([
			'typescript',
			'ulid',
			'zod'
		]);
	});

	it('converts a post-realpath worker inspection failure into WORKER_INVALID', () => {
		const subject = fixture();
		installBunResolver(subject);
		filesystemFaults.hooks.set('lstatSync', (actual, args) => {
			if (String(args[0]) === subject.workerPath) throw new Error('worker disappeared');
			return callActual(actual, args);
		});
		expect(() =>
			resolveArrowCommandCensusExecutorEnvironment(generousRequest(subject.workerPath))
		).toThrowError(expect.objectContaining({ code: 'WORKER_INVALID' }));
	});

	it('rejects a file that becomes non-regular between enumeration and capture', () => {
		const subject = fixture();
		installBunResolver(subject);
		const target = join(subject.modules.typescript.root, 'index.js');
		let targetCalls = 0;
		filesystemFaults.hooks.set('lstatSync', (actual, args) => {
			const stat = callActual(actual, args);
			if (String(args[0]) !== target) return stat;
			targetCalls += 1;
			return targetCalls === 2 ? alteredStat(stat, { isFile: () => false }) : stat;
		});
		expect(() =>
			resolveArrowCommandCensusExecutorEnvironment(generousRequest(subject.workerPath))
		).toThrowError(
			expect.objectContaining({ code: 'EXTERNAL_MODULE_TREE_INVALID', moduleName: 'typescript' })
		);
	});

	it('rejects an unsupported descriptor identity during module capture', () => {
		const subject = fixture();
		installBunResolver(subject);
		const target = join(subject.modules.typescript.root, 'index.js');
		const tracker = trackOpenedDescriptor(target);
		filesystemFaults.hooks.set('fstatSync', (actual, args) => {
			const stat = callActual(actual, args);
			return args[0] === tracker.descriptor ? alteredStat(stat, { isFile: () => false }) : stat;
		});
		expect(() =>
			resolveArrowCommandCensusExecutorEnvironment(generousRequest(subject.workerPath))
		).toThrowError(
			expect.objectContaining({ code: 'EXTERNAL_MODULE_TREE_INVALID', moduleName: 'typescript' })
		);
	});

	it('rejects short, trailing, and identity-changing reads during module capture', () => {
		for (const mode of ['SHORT', 'TRAILING', 'IDENTITY'] as const) {
			const subject = fixture();
			installBunResolver(subject);
			const target = join(subject.modules.typescript.root, 'index.js');
			const tracker = trackOpenedDescriptor(target);
			if (mode === 'IDENTITY') {
				let fstatCalls = 0;
				filesystemFaults.hooks.set('fstatSync', (actual, args) => {
					const stat = callActual(actual, args);
					if (args[0] !== tracker.descriptor) return stat;
					fstatCalls += 1;
					if (fstatCalls !== 2) return stat;
					const mtimeMs = (stat as { readonly mtimeMs: number }).mtimeMs;
					return alteredStat(stat, { mtimeMs: mtimeMs + 1 });
				});
			} else {
				filesystemFaults.hooks.set('readSync', (actual, args) => {
					if (args[0] !== tracker.descriptor) return callActual(actual, args);
					const position = args[4];
					if (mode === 'SHORT' && position === 0) return 0;
					if (
						mode === 'TRAILING' &&
						position === Buffer.byteLength(subject.modules.typescript.index)
					)
						return 1;
					return callActual(actual, args);
				});
			}
			expect(() =>
				resolveArrowCommandCensusExecutorEnvironment(generousRequest(subject.workerPath))
			).toThrowError(
				expect.objectContaining({
					code: 'IDENTITY_CHANGED_DURING_CAPTURE',
					moduleName: 'typescript'
				})
			);
			filesystemFaults.hooks.clear();
		}
	});

	it('wraps an unexpected module open failure as a tree failure', () => {
		const subject = fixture();
		installBunResolver(subject);
		const target = join(subject.modules.typescript.root, 'index.js');
		filesystemFaults.hooks.set('openSync', (actual, args) => {
			if (String(args[0]) === target) throw new Error('open failed');
			return callActual(actual, args);
		});
		expect(() =>
			resolveArrowCommandCensusExecutorEnvironment(generousRequest(subject.workerPath))
		).toThrowError(
			expect.objectContaining({ code: 'EXTERNAL_MODULE_TREE_INVALID', moduleName: 'typescript' })
		);
	});

	it('rejects escaped, unreadable, and changing module enumeration entries', () => {
		for (const mode of ['ESCAPE', 'UNREADABLE', 'CHANGED'] as const) {
			const subject = fixture();
			installBunResolver(subject);
			const moduleRoot = subject.modules.typescript.root;
			if (mode === 'ESCAPE') {
				writeFileSync(join(subject.root, 'escaped.txt'), 'escaped');
				filesystemFaults.hooks.set('readdirSync', (actual, args) =>
					String(args[0]) === moduleRoot ? ['../../escaped.txt'] : callActual(actual, args)
				);
			} else if (mode === 'UNREADABLE') {
				filesystemFaults.hooks.set('readdirSync', (actual, args) => {
					if (String(args[0]) === moduleRoot) throw new Error('unreadable');
					return callActual(actual, args);
				});
			} else {
				const target = join(moduleRoot, 'index.js');
				filesystemFaults.hooks.set('lstatSync', (actual, args) => {
					if (String(args[0]) === target) throw new Error('entry changed');
					return callActual(actual, args);
				});
			}
			expect(() =>
				resolveArrowCommandCensusExecutorEnvironment(generousRequest(subject.workerPath))
			).toThrowError(expect.objectContaining({ code: 'EXTERNAL_MODULE_TREE_INVALID' }));
			filesystemFaults.hooks.clear();
		}
	});

	it('rejects canonical manifest-parent drift and manifest omission during enumeration', () => {
		for (const mode of ['PARENT_DRIFT', 'OMITTED'] as const) {
			const subject = fixture();
			installBunResolver(subject);
			const moduleRoot = subject.modules.typescript.root;
			const manifestPath = join(moduleRoot, 'package.json');
			if (mode === 'PARENT_DRIFT') {
				filesystemFaults.hooks.set('realpathSync.native', (actual, args) =>
					String(args[0]) === manifestPath
						? join(subject.root, 'different-parent', 'package.json')
						: callActual(actual, args)
				);
			} else {
				filesystemFaults.hooks.set('readdirSync', (actual, args) =>
					String(args[0]) === moduleRoot ? ['index.js'] : callActual(actual, args)
				);
			}
			expect(() =>
				resolveArrowCommandCensusExecutorEnvironment(generousRequest(subject.workerPath))
			).toThrowError(
				expect.objectContaining({
					code:
						mode === 'PARENT_DRIFT'
							? 'EXTERNAL_MODULE_RESOLUTION_FAILED'
							: 'EXTERNAL_MODULE_MANIFEST_INVALID',
					moduleName: 'typescript'
				})
			);
			filesystemFaults.hooks.clear();
		}
	});

	it('enumerates nested regular files recursively', () => {
		const subject = fixture();
		installBunResolver(subject);
		const nested = join(subject.modules.typescript.root, 'nested');
		mkdirSync(nested);
		writeFileSync(join(nested, 'entry.txt'), 'nested content');
		const result = resolveArrowCommandCensusExecutorEnvironment(
			generousRequest(subject.workerPath)
		);
		expect(result.identity.externalModules[0]).toMatchObject({ files: 3, name: 'typescript' });
	});

	it('rejects malformed package manifest encodings, JSON values, and versions', () => {
		const subject = fixture();
		installBunResolver(subject);
		const manifestPath = join(subject.modules.typescript.root, 'package.json');
		for (const manifest of [
			Uint8Array.of(0xff),
			'{',
			'[]',
			JSON.stringify({ name: 'typescript' }),
			JSON.stringify({ name: 'typescript', version: '' }),
			JSON.stringify({ name: 'typescript', version: 'bad\0version' })
		]) {
			writeFileSync(manifestPath, manifest);
			expect(() =>
				resolveArrowCommandCensusExecutorEnvironment(generousRequest(subject.workerPath))
			).toThrowError(
				expect.objectContaining({
					code: 'EXTERNAL_MODULE_MANIFEST_INVALID',
					moduleName: 'typescript'
				})
			);
		}
	});

	it('fails closed over Bun resolution failures and malformed resolutions', () => {
		const subject = fixture();
		const packageJsonDirectory = join(subject.root, 'not-a-manifest', 'package.json');
		mkdirSync(packageJsonDirectory, { recursive: true });
		const cases: readonly (() => string)[] = [
			() => {
				throw new Error('resolution failed');
			},
			() => 'relative/package.json',
			() => 'file:%',
			() => join(subject.root, 'missing', 'package.json'),
			() => packageJsonDirectory
		];
		for (const resolver of cases) {
			installBunResolver(subject, resolver);
			expect(() =>
				resolveArrowCommandCensusExecutorEnvironment(generousRequest(subject.workerPath))
			).toThrowError(
				expect.objectContaining({
					code: 'EXTERNAL_MODULE_RESOLUTION_FAILED',
					moduleName: 'typescript'
				})
			);
		}
	});

	it('rejects a symlinked package root before enumerating it', () => {
		const subject = fixture();
		const lexicalRoot = join(subject.root, 'node_modules', 'typescript');
		const targetRoot = join(subject.root, 'typescript-target');
		renameSync(lexicalRoot, targetRoot);
		symlinkSync(targetRoot, lexicalRoot, 'junction');
		installBunResolver(subject);
		expect(() =>
			resolveArrowCommandCensusExecutorEnvironment(generousRequest(subject.workerPath))
		).toThrowError(
			expect.objectContaining({
				code: 'EXTERNAL_MODULE_TREE_INVALID',
				moduleName: 'typescript'
			})
		);
	});

	it('rejects missing and non-file worker paths', () => {
		const subject = fixture();
		installBunResolver(subject);
		for (const workerPath of [join(subject.root, 'missing-worker.ts'), subject.root]) {
			expect(() =>
				resolveArrowCommandCensusExecutorEnvironment({
					...generousRequest(subject.workerPath),
					workerPath
				})
			).toThrowError(expect.objectContaining({ code: 'WORKER_INVALID' }));
		}
	});

	it('rejects invalid budgets and non-absolute worker paths with its typed local error', () => {
		const subject = fixture();
		for (const request of [
			{ ...generousRequest(subject.workerPath), maxExternalModuleBytes: 0 },
			{ ...generousRequest(subject.workerPath), maxExternalModuleFiles: 0 },
			{ ...generousRequest(subject.workerPath), workerPath: 'worker.ts' }
		]) {
			try {
				resolveArrowCommandCensusExecutorEnvironment(request);
				expect.fail('request should have failed');
			} catch (error) {
				expect(error).toBeInstanceOf(ArrowCommandCensusExecutorEnvironmentError);
				expect(error).toMatchObject({ code: 'REQUEST_INVALID' });
			}
		}
	});

	it('fails closed with BUN_REQUIRED when no Bun runtime is present', () => {
		const subject = fixture();
		vi.stubEnv('PATH', '');
		expect(() =>
			resolveArrowCommandCensusExecutorEnvironment(generousRequest(subject.workerPath))
		).toThrowError(expect.objectContaining({ code: 'BUN_REQUIRED' }));
	});

	it('rejects non-object requests and wraps an unexpected request-boundary failure', () => {
		for (const request of [null, []]) {
			expect(() =>
				resolveArrowCommandCensusExecutorEnvironment(
					request as unknown as Parameters<typeof resolveArrowCommandCensusExecutorEnvironment>[0]
				)
			).toThrowError(expect.objectContaining({ code: 'REQUEST_INVALID' }));
		}
		const hostile = new Proxy(generousRequest('C:\\absolute\\worker.ts'), {
			get() {
				throw new Error('hostile request');
			}
		});
		expect(() => resolveArrowCommandCensusExecutorEnvironment(hostile)).toThrowError(
			expect.objectContaining({ code: 'ENVIRONMENT_CAPTURE_FAILED' })
		);
	});
});
