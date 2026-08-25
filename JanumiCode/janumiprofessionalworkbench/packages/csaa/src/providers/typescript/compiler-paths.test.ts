import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type {
	CapturedArtifactRecord,
	FrozenSubject,
	WorkspaceExportRecord,
	WorkspaceSubjectRecord
} from '../../contracts/subject.js';
import { CompilerPathError, FrozenCompilerPathResolver } from './compiler-paths.js';

const temporaryRoots: string[] = [];
const DIGEST = 'a'.repeat(64);

afterEach(() => {
	for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

function temporaryRoot(prefix = 'csaa-compiler-paths-'): string {
	const root = mkdtempSync(join(tmpdir(), prefix));
	temporaryRoots.push(root);
	return root;
}

function write(root: string, path: string, content = ''): string {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, content, 'utf8');
	return absolute;
}

function artifact(
	path: string,
	primaryClass: CapturedArtifactRecord['primaryClass'] = 'PRODUCTION_SOURCE'
): CapturedArtifactRecord {
	return {
		bytes: 0,
		canonicalPathKey: path.toLowerCase(),
		disposition: 'ANALYZED',
		path,
		primaryClass,
		reason: 'compiler-path fixture',
		roles: [],
		sha256: DIGEST
	};
}

function workspace(
	name: string,
	path: string,
	exports: readonly WorkspaceExportRecord[] = []
): WorkspaceSubjectRecord {
	return {
		exports,
		kind: 'PACKAGE',
		manifestPath: `${path}/package.json`,
		name,
		path,
		private: true,
		provenance: [],
		workspacePatterns: []
	};
}

function project(
	compilerOptions: Readonly<Record<string, unknown>>
): FrozenSubject['projects'][number] {
	return { programRecipe: { compilerOptions } } as unknown as FrozenSubject['projects'][number];
}

function generatedContext(
	path: string,
	selectedInput: boolean,
	sha256 = DIGEST
): FrozenSubject['generatedContexts'][number] {
	return {
		consumerProject: 'tsconfig.json',
		freshness: 'CURRENT',
		freshnessBasis: 'fixture',
		freshnessEvidence: [],
		generator: null,
		outputManifestDigest: DIGEST,
		outputPaths: [path],
		path,
		selectedInput,
		sha256
	};
}

function subject(
	artifacts: readonly CapturedArtifactRecord[] = [],
	overrides: Partial<Pick<FrozenSubject, 'generatedContexts' | 'projects' | 'workspaces'>> = {}
): FrozenSubject {
	return {
		artifacts,
		descriptor: { subjectId: DIGEST },
		diagnostics: [],
		excludedArtifacts: [],
		generatedContexts: overrides.generatedContexts ?? [],
		population: {
			analyzed: artifacts.length,
			discovered: artifacts.length,
			excluded: 0,
			failed: 0,
			included: artifacts.length,
			inventoryOnly: 0,
			reconciles: true
		},
		projects: overrides.projects ?? [],
		request: {},
		workspaces: overrides.workspaces ?? []
	} as unknown as FrozenSubject;
}

function expectPathError(action: () => unknown, code: CompilerPathError['code']): void {
	try {
		action();
		throw new Error('Expected compiler path operation to fail.');
	} catch (error) {
		expect(error).toBeInstanceOf(CompilerPathError);
		expect((error as CompilerPathError).code).toBe(code);
	}
}

describe('FrozenCompilerPathResolver', () => {
	it('derives every artifact origin and declaration-output origin from frozen authority', () => {
		const root = temporaryRoot();
		const originCases = [
			['tests/example.ts', 'TEST_SOURCE', 'TEST'],
			['verif/check.ts', 'VERIFICATION', 'VERIFICATION'],
			['scripts/tool.ts', 'SCRIPT', 'SCRIPT'],
			['generators/build.ts', 'GENERATOR_SOURCE', 'GENERATOR'],
			['generated/runtime.ts', 'GENERATED_SOURCE', 'GENERATED'],
			['generated/runtime.d.ts', 'GENERATED_SOURCE', 'GENERATED_DECLARATION'],
			['generated/config.json', 'GENERATED_CONFIGURATION', 'CONFIGURATION'],
			['src/index.ts', 'PRODUCTION_SOURCE', 'AUTHORED']
		] as const;
		const exports: readonly WorkspaceExportRecord[] = [
			{ conditions: ['types'], exportName: '.', target: './types/index.d.ts' },
			{ conditions: [], exportName: './legacy', target: './legacy/index.d.cts' },
			{ conditions: [], exportName: './runtime', target: './runtime/index.js' },
			{ conditions: ['types'], exportName: './absent', target: null },
			{ conditions: ['types'], exportName: './empty', target: '' },
			{ conditions: ['types'], exportName: './backslash', target: '.\\escape.d.ts' },
			{ conditions: ['types'], exportName: './absolute', target: '/escape.d.ts' },
			{ conditions: ['types'], exportName: './drive', target: 'C:/escape.d.ts' }
		];
		const resolver = new FrozenCompilerPathResolver(
			subject(
				originCases.map(([path, primaryClass]) => artifact(path, primaryClass)),
				{
					projects: [
						project({ declarationDir: 'global-types', outDir: '.' }),
						project({ outDir: 'packages/shared/dist' })
					],
					workspaces: [workspace('@fixture/shared', 'packages/shared', exports)]
				}
			),
			root,
			true
		);

		for (const [path, , expected] of originCases) expect(resolver.origin(path)).toBe(expected);
		expect(resolver.isWorkspaceBuildOutput('packages/shared/dist/index.d.ts')).toBe(true);
		expect(resolver.isWorkspaceBuildOutput('packages/shared/types/ambient.d.ts')).toBe(true);
		expect(resolver.isWorkspaceBuildOutput('packages/shared/legacy/ambient.d.cts')).toBe(true);
		expect(resolver.isWorkspaceBuildOutput('packages/shared/runtime/index.js')).toBe(false);
		expect(resolver.origin('packages/shared/dist/index.d.ts')).toBe('WORKSPACE_BUILD_DECLARATION');
		expect(resolver.origin('global-types/index.d.ts')).toBe('GENERATED_DECLARATION');
		expect(resolver.origin('node_modules/pkg/index.d.mts')).toBe('EXTERNAL_DECLARATION');
		expect(resolver.origin('@toolchain/typescript/lib/lib.d.ts')).toBe('TOOLCHAIN_LIBRARY');
		expect(resolver.origin('unselected/package.json')).toBe('CONFIGURATION');
		expect(resolver.origin('unselected/file.ts')).toBe('UNKNOWN');
	});

	it('projects a present workspace alias and enumerates its complete virtual topology', () => {
		const root = temporaryRoot();
		const targetFile = 'packages/shared/src/index.ts';
		const aliasRoot = 'node_modules/@fixture/shared';
		const aliasFile = `${aliasRoot}/src/index.ts`;
		write(root, targetFile, 'export const shared = true;\n');
		write(root, 'top.ts', 'export {};\n');
		write(root, 'generated/context.d.ts', 'export {};\n');
		mkdirSync(join(root, 'packages/empty'), { recursive: true });
		mkdirSync(join(root, 'node_modules/@fixture'), { recursive: true });
		symlinkSync(
			join(root, 'packages/shared'),
			join(root, aliasRoot),
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		symlinkSync(
			join(root, 'packages/empty'),
			join(root, 'node_modules/@fixture/empty'),
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		const frozen = subject([artifact(targetFile), artifact('top.ts')], {
			generatedContexts: [
				generatedContext('selected/ignored.d.ts', true, 'not-a-digest'),
				generatedContext('generated/context.d.ts', false)
			],
			workspaces: [
				workspace('@fixture/shared', 'packages/shared'),
				workspace('@fixture/empty', 'packages/empty')
			]
		});
		const resolver = new FrozenCompilerPathResolver(frozen, root, false);

		expect(resolver.workspaceAliasRoots()).toEqual(['node_modules/@fixture/empty', aliasRoot]);
		expect(resolver.workspaceAliasResolvedTarget(aliasRoot)).toBe('packages/shared');
		expect(resolver.workspaceAliasResolvedTarget(aliasFile)).toBeUndefined();
		expect(resolver.frozenArtifact(aliasFile)?.path).toBe(targetFile);
		expect(resolver.resolvedFrozenLogical(aliasRoot)).toBe('packages/shared');
		expect(resolver.resolvedFrozenLogical(aliasFile)).toBe(targetFile);
		expect(resolver.resolvedFrozenLogical('missing.ts')).toBeUndefined();
		expect(resolver.origin(aliasFile)).toBe('AUTHORED');
		expect(resolver.toAbsolute(aliasFile)).toBe(resolve(root, targetFile));
		expect(resolver.toRecordedAbsolute(aliasFile)).toBe(resolve(root, targetFile));
		expect(resolver.toLogical(join(root, ...aliasFile.split('/')))).toBe(aliasFile);
		expect(resolver.toRecordedLogical(join(root, ...aliasFile.split('/')))).toBe(aliasFile);
		expect(resolver.canonicalLogical('PACKAGES/SHARED/SRC/INDEX.TS')).toBe(targetFile);
		expect(resolver.canonicalRecordedLogical('NODE_MODULES/@FIXTURE/SHARED/SRC/INDEX.TS')).toBe(
			aliasFile
		);
		expect(resolver.isExplicitContextFile('generated/context.d.ts')).toBe(true);
		expect(resolver.explicitContextDigest('generated/context.d.ts')).toBe(DIGEST);

		const directories = [...resolver.virtualDirectoryCandidates('.')].sort();
		expect(directories).toEqual(
			expect.arrayContaining([
				'generated',
				'node_modules',
				'node_modules/@fixture',
				'node_modules/@fixture/empty',
				aliasRoot,
				`${aliasRoot}/src`,
				'packages',
				'packages/shared',
				'packages/shared/src'
			])
		);
		expect(directories).not.toContain('.');
		expect([...resolver.virtualDirectoryCandidates(aliasRoot)]).toEqual([`${aliasRoot}/src`]);
		expect([...resolver.virtualDirectoryCandidates('absent')]).toEqual([]);
		expect([...resolver.virtualFileCandidates('.')].sort()).toEqual(
			expect.arrayContaining([aliasFile, 'generated/context.d.ts', targetFile, 'top.ts'])
		);
		expect([...resolver.virtualFileCandidates(aliasRoot)]).toEqual([aliasFile]);
		expect([...resolver.virtualFileCandidates('absent')]).toEqual([]);
		expect(resolver.virtualChildren('node_modules/@fixture/empty')).toEqual([]);
		expect(resolver.virtualChildren('absent')).toEqual([]);
	});

	it('rejects malformed frozen identities, roots, aliases, and public path escapes with typed errors', () => {
		const root = temporaryRoot();
		const outside = temporaryRoot('csaa-compiler-paths-outside-');
		const missingRoot = join(root, 'missing-root');
		const fileRoot = write(root, 'not-a-directory', 'file');
		expectPathError(
			() => new FrozenCompilerPathResolver(subject(), 'relative-root', true),
			'PATH_ESCAPE'
		);
		expectPathError(() => new FrozenCompilerPathResolver(subject(), fileRoot, true), 'PATH_ESCAPE');
		expectPathError(
			() => new FrozenCompilerPathResolver(subject(), missingRoot, true),
			'PATH_ESCAPE'
		);
		expectPathError(
			() => new FrozenCompilerPathResolver(subject([artifact('../escape.ts')]), root, true),
			'PATH_ESCAPE'
		);
		expectPathError(
			() =>
				new FrozenCompilerPathResolver(
					subject([artifact('Src/A.ts'), artifact('src/a.ts')]),
					root,
					false
				),
			'PATH_ESCAPE'
		);
		expectPathError(
			() =>
				new FrozenCompilerPathResolver(
					subject([], {
						generatedContexts: [generatedContext('generated/a.d.ts', false, 'invalid')]
					}),
					root,
					true
				),
			'PATH_ESCAPE'
		);
		expectPathError(
			() =>
				new FrozenCompilerPathResolver(
					subject([artifact('generated/a.d.ts')], {
						generatedContexts: [generatedContext('generated/a.d.ts', false)]
					}),
					root,
					true
				),
			'PATH_ESCAPE'
		);
		expectPathError(
			() =>
				new FrozenCompilerPathResolver(
					subject([], {
						generatedContexts: [
							generatedContext('generated/A.d.ts', false),
							generatedContext('generated/a.d.ts', false)
						]
					}),
					root,
					false
				),
			'PATH_ESCAPE'
		);
		expectPathError(
			() =>
				new FrozenCompilerPathResolver(
					subject([], {
						workspaces: [
							workspace('@fixture/pkg', 'packages/a'),
							workspace('@FIXTURE/PKG', 'packages/b')
						]
					}),
					root,
					false
				),
			'PATH_ESCAPE'
		);
		expectPathError(
			() =>
				new FrozenCompilerPathResolver(
					subject([], { projects: [project({ outDir: '../escape' })] }),
					root,
					true
				),
			'PATH_ESCAPE'
		);

		mkdirSync(join(root, 'packages/dangling'), { recursive: true });
		mkdirSync(join(root, 'node_modules/@fixture'), { recursive: true });
		symlinkSync(
			join(root, 'packages/dangling'),
			join(root, 'node_modules/@fixture/dangling'),
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		rmSync(join(root, 'packages/dangling'), { force: true, recursive: true });
		expectPathError(
			() =>
				new FrozenCompilerPathResolver(
					subject([], { workspaces: [workspace('@fixture/dangling', 'packages/dangling')] }),
					root,
					true
				),
			'PATH_ESCAPE'
		);

		const resolver = new FrozenCompilerPathResolver(
			subject([artifact('src/index.ts')]),
			root,
			true
		);
		for (const value of [
			'',
			'src/../escape.ts',
			'/absolute.ts',
			'C:/drive.ts',
			'src\\backslash.ts'
		]) {
			expectPathError(() => resolver.canonicalLogical(value), 'PATH_ESCAPE');
		}
		for (const child of ['', '.', '..', 'nested/child', 'nested\\child']) {
			expectPathError(() => resolver.enumeratedChildIdentity('.', child), 'PATH_ESCAPE');
		}
		expectPathError(
			() => resolver.toAbsolute('@toolchain/typescript/lib/../typescript.js'),
			'PATH_ESCAPE'
		);
		expectPathError(() => resolver.toLogical(join(outside, 'escaped.ts')), 'PATH_ESCAPE');
		expectPathError(() => resolver.toRecordedLogical(join(outside, 'escaped.ts')), 'PATH_ESCAPE');
		expectPathError(
			() => resolver.assertLiveFilePermitted('src/unselected.ts'),
			'CONTEXT_FORBIDDEN'
		);
	});

	it('maps repository, toolchain, boundary, and live-context paths without widening policy', () => {
		const parent = temporaryRoot();
		const root = join(parent, 'repo');
		mkdirSync(root, { recursive: true });
		write(root, 'src/index.ts', 'export {};\n');
		write(root, 'node_modules/pkg/index.d.ts', 'export {};\n');
		write(root, 'node_modules/pkg/package.json', '{}\n');
		write(root, 'node_modules/pkg/runtime.js', 'module.exports = {};\n');
		write(root, 'generated/context.js', 'export {};\n');
		const resolver = new FrozenCompilerPathResolver(
			subject([artifact('src/index.ts')], {
				generatedContexts: [
					generatedContext('generated/context.js', false),
					generatedContext('generated/types.d.ts', false)
				],
				projects: [project({ outDir: 'dist' })]
			}),
			root,
			true
		);

		expect(resolver.toLogical(root)).toBe('.');
		expect(resolver.toLogical('src/index.ts')).toBe('src/index.ts');
		expect(resolver.toAbsolute('.')).toBe(resolve(root));
		expect(resolver.toRecordedAbsolute('.')).toBe(resolve(root));
		expect(resolver.canonicalLogical('.')).toBe('.');
		expect(resolver.canonicalRecordedLogical('.')).toBe('.');

		const library = join(resolver.typescriptLibraryRoot, 'lib.d.ts');
		expect(resolver.toLogical(library)).toBe('@toolchain/typescript/lib/lib.d.ts');
		expect(resolver.toRecordedLogical(library)).toBe('@toolchain/typescript/lib/lib.d.ts');
		expect(resolver.toAbsolute('@toolchain/typescript')).toBe(resolver.typescriptPackageRoot);
		expect(resolver.toRecordedAbsolute('@toolchain/typescript/lib/lib.d.ts')).toBe(library);
		expect(resolver.canonicalLogical('@toolchain/typescript/lib/lib.d.ts')).toBe(
			'@toolchain/typescript/lib/lib.d.ts'
		);
		expect(resolver.canonicalRecordedLogical('@toolchain/typescript/lib/lib.d.ts')).toBe(
			'@toolchain/typescript/lib/lib.d.ts'
		);

		const boundaryAbsolute = join(parent, 'node_modules/pkg/index.d.ts');
		const boundaryLogical = '@boundary/ancestor-1/node_modules/pkg/index.d.ts';
		expect(resolver.toLogical(boundaryAbsolute)).toBe(boundaryLogical);
		expect(resolver.toRecordedLogical(boundaryAbsolute)).toBe(boundaryLogical);
		expect(resolver.isBoundaryPath(boundaryLogical)).toBe(true);
		expect(resolver.canonicalLogical(boundaryLogical)).toBe(boundaryLogical);
		expect(resolver.canonicalRecordedLogical(boundaryLogical)).toBe(boundaryLogical);
		expect(resolver.isBoundaryPath('@boundary/ancestor-0/node_modules/pkg')).toBe(false);

		const authorized = resolver.authorizeEnumeratedChild('node_modules/pkg', 'index.d.ts');
		expect(authorized).toEqual({
			absolutePath: resolve(root, 'node_modules/pkg/index.d.ts'),
			logicalPath: 'node_modules/pkg/index.d.ts',
			observedLogicalPath: 'node_modules/pkg/index.d.ts'
		});
		expect(resolver.enumeratedChildIdentity('.', 'src')).toEqual({
			logicalPath: 'src',
			observedLogicalPath: 'src'
		});

		expect(resolver.isLiveDirectoryPermitted('@toolchain/typescript/lib')).toBe(true);
		expect(resolver.isLiveDirectoryPermitted('node_modules/pkg')).toBe(true);
		expect(resolver.isLiveDirectoryPermitted('generated')).toBe(true);
		expect(resolver.isLiveDirectoryPermitted('src')).toBe(false);
		expect(resolver.isLiveScanPermitted('@toolchain/typescript/lib')).toBe(true);
		expect(resolver.isLiveScanPermitted('node_modules/pkg')).toBe(true);
		expect(resolver.isLiveScanPermitted('dist')).toBe(true);
		expect(resolver.isLiveScanPermitted('generated')).toBe(false);
		expect(resolver.isLiveFilePermitted('@toolchain/typescript/lib/lib.d.ts')).toBe(true);
		expect(resolver.isLiveFilePermitted('@toolchain/typescript/package.json')).toBe(true);
		expect(resolver.isLiveFilePermitted('node_modules/pkg/index.d.ts')).toBe(true);
		expect(resolver.isLiveFilePermitted('node_modules/pkg/package.json')).toBe(true);
		expect(resolver.isLiveFilePermitted('node_modules/pkg/runtime.js')).toBe(false);
		expect(resolver.isLiveFilePermitted('dist/index.d.ts')).toBe(true);
		expect(resolver.isLiveFilePermitted('dist/package.json')).toBe(true);
		expect(resolver.isLiveFilePermitted('generated/context.js')).toBe(true);
		expect(resolver.isLiveRealpathPermitted('generated/context.js')).toBe(true);
		expect(resolver.isLiveRealpathPermitted('node_modules')).toBe(true);
		expect(resolver.isLiveRealpathPermitted('@toolchain/typescript')).toBe(true);
		expect(resolver.isLiveRealpathPermitted('src')).toBe(true);
		expect(resolver.isLiveRealpathPermitted('node_modules/pkg')).toBe(false);
		expect(resolver.origin('generated/context.js')).toBe('GENERATED');
		expect(resolver.origin('generated/types.d.ts')).toBe('GENERATED_DECLARATION');
		expect(resolver.origin('dist/index.d.ts')).toBe('GENERATED_DECLARATION');
	});
});
