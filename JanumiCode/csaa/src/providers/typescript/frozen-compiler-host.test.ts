import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ts from 'typescript';
import type { FrozenSubject, ProgramRecipe } from '../../contracts/subject.js';
import type { SemanticBudgets } from '../../contracts/semantic.js';
import { TYPESCRIPT_PROVIDER_VERSION } from '../../contracts/semantic.js';
import { sha256 } from '../../inventory/canonical.js';
import { programRecipeDigest } from '../../semantic/ids.js';
import { createStaticSemanticOperationBudgetSession } from '../../semantic/static-semantic-operation-budget-session.js';
import { attachFrozenSubjectBytes } from '../../subject/frozen-store.js';
import {
	CompilerInputCaptureError,
	CompilerInputJournal,
	LiveCompilerInputReader,
	recheckCompilerInputJournal
} from './compiler-input-journal.js';
import {
	createCapturingCompilerEnvironment,
	createCapturingCompilerHost,
	createReplayCompilerEnvironment,
	createReplayCompilerHost,
	type ExtendedCompilerHost
} from './frozen-compiler-host.js';
import { CompilerPathError, FrozenCompilerPathResolver } from './compiler-paths.js';
import { materializeProgramRecipe } from './materialize-program-recipe.js';

const temporaryRoots: string[] = [];
const FIXTURE_FILES = {
	'src/dep.ts': 'export const dep = 41 as const;\n',
	'src/index.ts': "import { dep } from './dep.js';\nexport const answer = dep + 1;\n",
	'src/runtime.js': 'export const runtime = true;\n',
	'src/view.jsx': 'export const view = <div />;\n',
	'tsconfig.json': '{}\n'
} as const;
const BUDGETS: SemanticBudgets = {
	maxAstDepth: 64,
	maxAstNodes: 10_000,
	maxCompilerInputMetadataBytes: 4 * 1024 * 1024,
	maxCompilerQueries: 100_000,
	maxCompilerFacts: 100_000,
	maxCompilerQueryInvocations: 1_000_000,
	maxContextBytes: 4 * 1024 * 1024,
	maxContextFileBytes: 1024 * 1024,
	maxContextFiles: 1_000,
	maxDiagnosticCharacters: 1_000_000,
	maxDiagnostics: 1_000,
	maxDirectoryEntries: 100_000,
	maxDurationMs: 30_000,
	maxLiteralCharacters: 1_000_000,
	maxPathCharacters: 16_384,
	maxProjects: 10,
	maxSnapshotBytes: 64 * 1024 * 1024,
	maxScopes: 10_000,
	maxSources: 1_000
};

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

function write(root: string, path: string, content: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, content, 'utf8');
}

function fixture(): {
	readonly frozen: FrozenSubject;
	readonly recipe: ProgramRecipe;
	readonly root: string;
} {
	const root = mkdtempSync(join(tmpdir(), 'csaa-compiler-host-'));
	temporaryRoots.push(root);
	const files = FIXTURE_FILES;
	for (const [path, content] of Object.entries(files)) write(root, path, content);
	const artifacts = Object.entries(files).map(([path, content]) => ({
		bytes: Buffer.byteLength(content),
		canonicalPathKey: path.toLowerCase(),
		disposition: 'ANALYZED' as const,
		path,
		primaryClass: path.endsWith('.json')
			? ('PROJECT_CONFIGURATION' as const)
			: ('PRODUCTION_SOURCE' as const),
		reason: 'fixture',
		roles: path.endsWith('.json')
			? ['CONFIGURATION' as const]
			: ['ANALYSIS_INPUT' as const, 'COMPILER_CANDIDATE' as const],
		sha256: sha256(content)
	}));
	const frozen = {
		artifacts,
		descriptor: { subjectId: 'b'.repeat(64) },
		diagnostics: [],
		excludedArtifacts: [],
		generatedContexts: [],
		population: {
			analyzed: artifacts.length,
			discovered: artifacts.length,
			excluded: 0,
			failed: 0,
			included: artifacts.length,
			inventoryOnly: 0,
			reconciles: true
		},
		projects: [],
		request: {},
		workspaces: []
	} as unknown as FrozenSubject;
	attachFrozenSubjectBytes(
		frozen,
		new Map(
			Object.entries(files).map(([path, content]) => [path, new TextEncoder().encode(content)])
		)
	);
	const recipeBase = {
		compilerOptions: {
			configFilePath: 'tsconfig.json',
			module: ts.ModuleKind.ESNext,
			moduleResolution: ts.ModuleResolutionKind.Bundler,
			noEmit: true,
			noLib: true,
			strict: true,
			target: ts.ScriptTarget.ES2022
		},
		configClosureDigest: 'c'.repeat(64),
		configPath: 'tsconfig.json',
		kind: 'PROJECT' as const,
		projectReferences: [],
		provider: { id: 'typescript' as const, version: TYPESCRIPT_PROVIDER_VERSION },
		rootNames: ['src/index.ts']
	};
	const recipe = { ...recipeBase, projectResolutionDigest: programRecipeDigest(recipeBase) };
	return { frozen, recipe, root };
}

function withIndexBytes(frozen: FrozenSubject, bytes: Uint8Array): FrozenSubject {
	const changed = {
		...frozen,
		artifacts: frozen.artifacts.map((artifact) =>
			artifact.path === 'src/index.ts'
				? { ...artifact, bytes: bytes.byteLength, sha256: sha256(bytes) }
				: artifact
		)
	};
	attachFrozenSubjectBytes(
		changed,
		new Map(
			Object.entries(FIXTURE_FILES).map(([path, content]) => [
				path,
				path === 'src/index.ts' ? bytes : new TextEncoder().encode(content)
			])
		)
	);
	return changed;
}

function exercise(host: ExtendedCompilerHost, recipe: ReturnType<typeof materializeProgramRecipe>) {
	const sourceDirectory = dirname(recipe.rootNames[0]!);
	const directoryResults = [
		host.directoryExists!(sourceDirectory),
		host.directoryExists!(join(sourceDirectory, 'not-frozen'))
	];
	const program = ts.createProgram({
		host,
		options: recipe.compilerOptions,
		projectReferences: [...recipe.projectReferences],
		rootNames: [...recipe.rootNames]
	});
	const checker = program.getTypeChecker();
	let identifiers = 0;
	for (const source of program.getSourceFiles()) {
		const visit = (node: ts.Node): void => {
			if (ts.isIdentifier(node)) {
				identifiers += 1;
				checker.getTypeAtLocation(node);
			}
			ts.forEachChild(node, visit);
		};
		visit(source);
	}
	const diagnostics = [
		...program.getConfigFileParsingDiagnostics(),
		...program.getOptionsDiagnostics(),
		...program.getGlobalDiagnostics(),
		...program.getSyntacticDiagnostics(),
		...program.getSemanticDiagnostics(),
		...program.getDeclarationDiagnostics()
	]
		.map((diagnostic) => diagnostic.code)
		.sort((left, right) => left - right);
	return {
		directoryResults,
		diagnostics,
		identifiers,
		sources: program
			.getSourceFiles()
			.map((source) => host.getCanonicalFileName(source.fileName))
			.sort()
	};
}

function expectCaptureCode(action: () => unknown, code: CompilerInputCaptureError['code']): void {
	try {
		action();
		throw new Error('Expected compiler input operation to fail.');
	} catch (error) {
		expect(error).toBeInstanceOf(CompilerInputCaptureError);
		expect((error as CompilerInputCaptureError).code).toBe(code);
	}
}

describe('two-pass frozen CompilerHost', () => {
	it('requires the supplied materialization to be the exact projection of the authoritative ProgramRecipe', () => {
		const { frozen, recipe, root } = fixture();
		const materialized = materializeProgramRecipe(recipe, root);
		const unrelated = {
			...materialized,
			rootNames: [materialized.rootNames[1] ?? join(root, 'src/dep.ts')]
		};
		const environment = createCapturingCompilerEnvironment(frozen, root, BUDGETS);
		expectCaptureCode(() => environment.createProjectHost(recipe, unrelated), 'INVALID_QUERY');
	});

	it('rejects hostile materialized projections and readDirectory arrays without executing traps', () => {
		const { frozen, recipe, root } = fixture();
		const materialized = materializeProgramRecipe(recipe, root);
		const { configFilePath: _configFilePath, ...withoutConfigFilePath } = materialized;
		for (const hostileMaterialization of [
			null,
			Object.assign(new Date(0), { configFilePath: materialized.configFilePath }),
			withoutConfigFilePath
		]) {
			const preflightEnvironment = createCapturingCompilerEnvironment(frozen, root, BUDGETS);
			expectCaptureCode(
				() => preflightEnvironment.createProjectHost(recipe, hostileMaterialization as never),
				'INVALID_QUERY'
			);
			expectCaptureCode(
				() => preflightEnvironment.createProjectHost(recipe, materialized),
				'INVALID_CAPTURE'
			);
		}
		let traps = 0;
		const trap = (): never => {
			traps += 1;
			throw new TypeError('hostile trap');
		};
		const hostileOptions = new Proxy(
			{ ...materialized.compilerOptions },
			{ get: trap, getOwnPropertyDescriptor: trap, getPrototypeOf: trap, ownKeys: trap }
		);
		const firstEnvironment = createCapturingCompilerEnvironment(frozen, root, BUDGETS);
		expectCaptureCode(
			() =>
				firstEnvironment.createProjectHost(recipe, {
					...materialized,
					compilerOptions: hostileOptions
				}),
			'INVALID_QUERY'
		);
		expect(traps).toBe(0);
		const accessorOptions = { ...materialized.compilerOptions } as Record<string, unknown>;
		Object.defineProperty(accessorOptions, 'strict', {
			enumerable: true,
			get() {
				traps += 1;
				return true;
			}
		});
		const accessorEnvironment = createCapturingCompilerEnvironment(frozen, root, BUDGETS);
		expectCaptureCode(
			() =>
				accessorEnvironment.createProjectHost(recipe, {
					...materialized,
					compilerOptions: accessorOptions as ts.CompilerOptions
				}),
			'INVALID_QUERY'
		);
		expect(traps).toBe(0);

		const environment = createCapturingCompilerEnvironment(frozen, root, BUDGETS);
		const host = environment.createProjectHost(recipe, materialized);
		const proxiedExtensions = new Proxy(['.ts'], {
			get: trap,
			getOwnPropertyDescriptor: trap,
			getPrototypeOf: trap,
			ownKeys: trap
		});
		expectCaptureCode(() => host.readDirectory(root, proxiedExtensions, [], []), 'INVALID_QUERY');
		const expanded = ['.ts'] as string[] & { extra?: boolean };
		expanded.extra = true;
		expectCaptureCode(() => host.readDirectory(root, expanded, [], []), 'INVALID_QUERY');
		const symbolExpanded = ['.ts'];
		Object.defineProperty(symbolExpanded, Symbol('hostile'), { enumerable: true, value: true });
		expectCaptureCode(() => host.readDirectory(root, symbolExpanded, [], []), 'INVALID_QUERY');
		expect(traps).toBe(0);

		const pathEnvironment = createCapturingCompilerEnvironment(frozen, root, BUDGETS);
		const pathHost = pathEnvironment.createProjectHost(recipe, materialized);
		expectCaptureCode(() => pathHost.fileExists(7 as never), 'INVALID_QUERY');

		const cumulativeBudgets = { ...BUDGETS, maxDirectoryEntries: 2 };
		const cumulativeEnvironment = createCapturingCompilerEnvironment(
			frozen,
			root,
			cumulativeBudgets
		);
		const cumulativeHost = cumulativeEnvironment.createProjectHost(recipe, materialized);
		expectCaptureCode(
			() => cumulativeHost.readDirectory(root, ['.ts'], ['excluded'], ['included']),
			'BUDGET_EXCEEDED'
		);

		const elementEnvironment = createCapturingCompilerEnvironment(frozen, root, BUDGETS);
		const elementHost = elementEnvironment.createProjectHost(recipe, materialized);
		expectCaptureCode(() => elementHost.readDirectory(root, [7 as never], [], []), 'INVALID_QUERY');

		const shortPathBudgets = { ...BUDGETS, maxPathCharacters: 32 };
		const shortPathEnvironment = createCapturingCompilerEnvironment(frozen, root, shortPathBudgets);
		const shortPathHost = shortPathEnvironment.createProjectHost(recipe, materialized);
		expectCaptureCode(
			() => shortPathHost.readDirectory(root, ['x'.repeat(33)], [], []),
			'BUDGET_EXCEEDED'
		);
	});

	it('assigns public JavaScript script kinds from frozen file extensions', () => {
		const { frozen, recipe, root } = fixture();
		const materialized = materializeProgramRecipe(recipe, root);
		const environment = createCapturingCompilerEnvironment(frozen, root, BUDGETS);
		const host = environment.createProjectHost(recipe, materialized);
		const javaScript = host.getSourceFile(join(root, 'src/runtime.js'), ts.ScriptTarget.ES2022);
		const jsx = host.getSourceFile(join(root, 'src/view.jsx'), ts.ScriptTarget.ES2022);
		const emittedScriptKind = (sourceFile: ts.SourceFile | undefined): ts.ScriptKind | undefined =>
			(sourceFile as (ts.SourceFile & { readonly scriptKind?: ts.ScriptKind }) | undefined)
				?.scriptKind;
		expect(emittedScriptKind(javaScript)).toBe(ts.ScriptKind.JS);
		expect(emittedScriptKind(jsx)).toBe(ts.ScriptKind.JSX);
	});

	it('snapshots materialized inputs, freezes the host, and enforces host-side budgets before hostile reflection or path conversion', () => {
		const { frozen, recipe, root } = fixture();
		const mutable = structuredClone(materializeProgramRecipe(recipe, root));
		const snapshotEnvironment = createCapturingCompilerEnvironment(frozen, root, BUDGETS);
		const snapshotHost = snapshotEnvironment.createProjectHost(recipe, mutable);
		const defaultLibrary = snapshotHost.getDefaultLibFileName(mutable.compilerOptions);
		mutable.compilerOptions.target = ts.ScriptTarget.ES5;
		expect(ts.getDefaultLibFilePath(mutable.compilerOptions)).not.toBe(defaultLibrary);
		expect(snapshotHost.getDefaultLibFileName(mutable.compilerOptions)).toBe(defaultLibrary);
		expect(Object.isFrozen(snapshotHost)).toBe(true);
		expect(Reflect.set(snapshotHost, 'fileExists', () => true)).toBe(false);

		let getters = 0;
		const countEnvironment = createCapturingCompilerEnvironment(frozen, root, {
			...BUDGETS,
			maxDirectoryEntries: 2
		});
		const countHost = countEnvironment.createProjectHost(
			recipe,
			materializeProgramRecipe(recipe, root)
		);
		expect(countHost.fileExists(join(root, 'src/index.ts'))).toBe(true);
		const oversized = ['.d.ts', '.ts', '.tsx'];
		Object.defineProperty(oversized, '2', {
			enumerable: true,
			get() {
				getters += 1;
				return '.tsx';
			}
		});
		expectCaptureCode(() => countHost.readDirectory(root, oversized, [], []), 'BUDGET_EXCEEDED');
		expect(getters).toBe(0);
		expectCaptureCode(() => countEnvironment.finalizeCapture(), 'INVALID_CAPTURE');

		const keyEnvironment = createCapturingCompilerEnvironment(frozen, root, {
			...BUDGETS,
			maxPathCharacters: 32
		});
		const oversizedKey = {
			...materializeProgramRecipe(recipe, root),
			configFilePath: join(root, 'x'.repeat(100))
		} as Record<string, unknown>;
		Object.defineProperty(oversizedKey, 'compilerOptions', {
			enumerable: true,
			get() {
				getters += 1;
				return {};
			}
		});
		expectCaptureCode(
			() =>
				keyEnvironment.createProjectHost(
					recipe,
					oversizedKey as unknown as ReturnType<typeof materializeProgramRecipe>
				),
			'BUDGET_EXCEEDED'
		);
		expect(getters).toBe(0);

		const pathEnvironment = createCapturingCompilerEnvironment(frozen, root, {
			...BUDGETS,
			maxPathCharacters: 32
		});
		const pathHost = pathEnvironment.createProjectHost(
			recipe,
			materializeProgramRecipe(recipe, root)
		);
		const outside = mkdtempSync(join(tmpdir(), 'csaa-compiler-host-prebudget-'));
		temporaryRoots.push(outside);
		expectCaptureCode(() => pathHost.fileExists(join(outside, 'x'.repeat(200))), 'BUDGET_EXCEEDED');
		expectCaptureCode(() => pathEnvironment.finalizeCapture(), 'INVALID_CAPTURE');

		const capacityEnvironment = createCapturingCompilerEnvironment(frozen, root, {
			...BUDGETS,
			maxProjects: 1
		});
		capacityEnvironment.createProjectHost(recipe, materializeProgramRecipe(recipe, root));
		let traps = 0;
		const trap = (): never => {
			traps += 1;
			throw new TypeError('hostile trap');
		};
		const hostileRecipe = new Proxy(recipe, {
			get: trap,
			getOwnPropertyDescriptor: trap,
			getPrototypeOf: trap,
			ownKeys: trap
		});
		const hostileMaterialized = new Proxy(materializeProgramRecipe(recipe, root), {
			get: trap,
			getOwnPropertyDescriptor: trap,
			getPrototypeOf: trap,
			ownKeys: trap
		});
		expectCaptureCode(
			() => capacityEnvironment.createProjectHost(hostileRecipe, hostileMaterialized),
			'BUDGET_EXCEEDED'
		);
		expect(traps).toBe(0);
		expect(capacityEnvironment.createProjectHost.length).toBe(2);
	});

	it('exposes deterministic hash/newline callbacks and closes duplicate, failed-evidence, and finalized capture states', () => {
		const { frozen, recipe, root } = fixture();
		const materialized = materializeProgramRecipe(recipe, root);
		const duplicate = createCapturingCompilerEnvironment(frozen, root, BUDGETS);
		const host = duplicate.createProjectHost(recipe, materialized);
		expect(host.createHash!('compiler-host-payload')).toBe(sha256('compiler-host-payload'));
		expect(host.getNewLine()).toBe('\n');
		expectCaptureCode(() => duplicate.createProjectHost(recipe, materialized), 'INVALID_QUERY');
		expectCaptureCode(() => duplicate.currentProjectEvidence(recipe.configPath), 'INVALID_CAPTURE');
		expectCaptureCode(() => duplicate.finalizeCapture(), 'INVALID_CAPTURE');

		const missingEvidence = createCapturingCompilerEnvironment(frozen, root, BUDGETS);
		missingEvidence.createProjectHost(recipe, materialized);
		expectCaptureCode(
			() => missingEvidence.currentProjectEvidence('missing/tsconfig.json'),
			'INVALID_QUERY'
		);
		expectCaptureCode(() => missingEvidence.finalizeCapture(), 'INVALID_CAPTURE');

		const finalized = createCapturingCompilerEnvironment(frozen, root, BUDGETS);
		finalized.createProjectHost(recipe, materialized);
		finalized.finalizeCapture();
		expectCaptureCode(() => finalized.createProjectHost(recipe, materialized), 'INVALID_CAPTURE');
		expectCaptureCode(() => finalized.currentProjectEvidence(recipe.configPath), 'INVALID_CAPTURE');
		expectCaptureCode(() => finalized.finalizeCapture(), 'INVALID_CAPTURE');
	});

	it('rejects cyclic/non-finite materializations and invalid authoritative recipes before exposing a host', () => {
		const { frozen, recipe, root } = fixture();
		const materialized = materializeProgramRecipe(recipe, root);
		const cyclicOptions = { ...materialized.compilerOptions } as Record<string, unknown>;
		cyclicOptions.strict = cyclicOptions;
		const cyclic = { ...materialized, compilerOptions: cyclicOptions } as unknown as ReturnType<
			typeof materializeProgramRecipe
		>;
		const cyclicEnvironment = createCapturingCompilerEnvironment(frozen, root, BUDGETS);
		expectCaptureCode(() => cyclicEnvironment.createProjectHost(recipe, cyclic), 'INVALID_QUERY');
		expectCaptureCode(() => cyclicEnvironment.finalizeCapture(), 'INVALID_CAPTURE');

		const nonFinite = {
			...materialized,
			compilerOptions: {
				...materialized.compilerOptions,
				maxNodeModuleJsDepth: Number.POSITIVE_INFINITY
			}
		};
		const nonFiniteEnvironment = createCapturingCompilerEnvironment(frozen, root, BUDGETS);
		expectCaptureCode(
			() => nonFiniteEnvironment.createProjectHost(recipe, nonFinite),
			'INVALID_QUERY'
		);
		expectCaptureCode(() => nonFiniteEnvironment.finalizeCapture(), 'INVALID_CAPTURE');

		const invalidRecipe = { ...recipe, projectResolutionDigest: 'not-a-digest' };
		const invalidRecipeEnvironment = createCapturingCompilerEnvironment(frozen, root, BUDGETS);
		expectCaptureCode(
			() => invalidRecipeEnvironment.createProjectHost(invalidRecipe, materialized),
			'INVALID_QUERY'
		);
		expectCaptureCode(() => invalidRecipeEnvironment.finalizeCapture(), 'INVALID_CAPTURE');
	});

	it('poisons every replay failure seam and refuses all operations after successful finalization', () => {
		const { frozen, recipe, root } = fixture();
		const materialized = materializeProgramRecipe(recipe, root);
		const capture = createCapturingCompilerEnvironment(frozen, root, BUDGETS);
		const captureHost = capture.createProjectHost(recipe, materialized);
		const queriedPath = materialized.rootNames[0]!;
		expect(captureHost.fileExists(queriedPath)).toBe(true);
		const verified = recheckCompilerInputJournal(capture.finalizeCapture());

		const unconsumedProject = createReplayCompilerEnvironment(frozen, verified);
		unconsumedProject.createProjectHost(recipe, materialized);
		expectCaptureCode(
			() => unconsumedProject.assertProjectConsumed(recipe.configPath),
			'UNCONSUMED_QUERY'
		);
		expectCaptureCode(() => unconsumedProject.assertFullyConsumed(), 'INVALID_CAPTURE');

		const unconsumedAll = createReplayCompilerEnvironment(frozen, verified);
		unconsumedAll.createProjectHost(recipe, materialized);
		expectCaptureCode(() => unconsumedAll.assertFullyConsumed(), 'UNCONSUMED_QUERY');
		expectCaptureCode(
			() => unconsumedAll.assertProjectConsumed(recipe.configPath),
			'INVALID_CAPTURE'
		);

		const duplicate = createReplayCompilerEnvironment(frozen, verified);
		duplicate.createProjectHost(recipe, materialized);
		expectCaptureCode(() => duplicate.createProjectHost(recipe, materialized), 'INVALID_QUERY');
		expectCaptureCode(() => duplicate.assertFullyConsumed(), 'INVALID_CAPTURE');

		const invalidRecipe = { ...recipe, projectResolutionDigest: 'not-a-digest' };
		const invalid = createReplayCompilerEnvironment(frozen, verified);
		expectCaptureCode(
			() => invalid.createProjectHost(invalidRecipe, materialized),
			'INVALID_QUERY'
		);
		expectCaptureCode(() => invalid.assertFullyConsumed(), 'INVALID_CAPTURE');

		const finalized = createReplayCompilerEnvironment(frozen, verified);
		const replayHost = finalized.createProjectHost(recipe, materialized);
		expect(replayHost.fileExists(queriedPath)).toBe(true);
		finalized.assertProjectConsumed(recipe.configPath);
		finalized.assertFullyConsumed();
		expectCaptureCode(() => finalized.createProjectHost(recipe, materialized), 'INVALID_CAPTURE');
		expectCaptureCode(() => finalized.assertProjectConsumed(recipe.configPath), 'INVALID_CAPTURE');
	});

	it('checks the original deadline before reflecting any readDirectory array', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(10_000));
		const { frozen, recipe, root } = fixture();
		const environment = createCapturingCompilerEnvironment(
			frozen,
			root,
			{ ...BUDGETS, maxDurationMs: 100 },
			10_000
		);
		const host = environment.createProjectHost(recipe, materializeProgramRecipe(recipe, root));
		let getters = 0;
		const extensions = ['.ts'];
		Object.defineProperty(extensions, '0', {
			enumerable: true,
			get() {
				getters += 1;
				return '.ts';
			}
		});
		vi.setSystemTime(new Date(10_101));
		expectCaptureCode(() => host.readDirectory(root, extensions, [], []), 'BUDGET_EXCEEDED');
		expect(getters).toBe(0);
		expectCaptureCode(() => environment.finalizeCapture(), 'INVALID_CAPTURE');
	});

	it('maps SourceFile names through one pure capture/replay logical-path seam without journal queries', () => {
		const { frozen, recipe, root } = fixture();
		const outside = mkdtempSync(join(tmpdir(), 'csaa-compiler-host-outside-'));
		temporaryRoots.push(outside);
		const materialized = materializeProgramRecipe(recipe, root);
		const capture = createCapturingCompilerEnvironment(frozen, root, BUDGETS);
		const host = capture.createProjectHost(recipe, materialized);
		expect(host.toLogicalPath(materialized.rootNames[0]!)).toBe('src/index.ts');
		const toolchainLogical = host.toLogicalPath(
			ts.getDefaultLibFilePath(materialized.compilerOptions)
		);
		expect(toolchainLogical).toMatch(/^@toolchain\/typescript\/lib\/lib.*\.d\.ts$/u);
		const finalized = capture.finalizeCapture();
		expect(finalized.entries).toEqual([]);
		const verified = recheckCompilerInputJournal(finalized);

		const failedCapture = createCapturingCompilerEnvironment(frozen, root, BUDGETS);
		const failedCaptureHost = failedCapture.createProjectHost(recipe, materialized);
		try {
			failedCaptureHost.toLogicalPath(join(outside, 'escaped.ts'));
			throw new Error('Expected logical-path escape to fail.');
		} catch (error) {
			expect(error).toBeInstanceOf(CompilerPathError);
			expect((error as CompilerPathError).code).toBe('PATH_ESCAPE');
		}
		expectCaptureCode(() => failedCapture.finalizeCapture(), 'INVALID_CAPTURE');
		rmSync(root, { force: true, recursive: true });
		const replay = createReplayCompilerEnvironment(frozen, verified);
		const replayHost = replay.createProjectHost(recipe, materialized);
		expect(replayHost.toLogicalPath(materialized.rootNames[0]!)).toBe('src/index.ts');
		expect(replayHost.toLogicalPath(ts.getDefaultLibFilePath(materialized.compilerOptions))).toBe(
			toolchainLogical
		);
		replay.assertFullyConsumed();

		const failedReplay = createReplayCompilerEnvironment(frozen, verified);
		const failedReplayHost = failedReplay.createProjectHost(recipe, materialized);
		try {
			failedReplayHost.toLogicalPath(join(outside, 'escaped.ts'));
			throw new Error('Expected replay logical-path escape to fail.');
		} catch (error) {
			expect(error).toBeInstanceOf(CompilerPathError);
			expect((error as CompilerPathError).code).toBe('PATH_ESCAPE');
		}
		expectCaptureCode(() => failedReplay.assertFullyConsumed(), 'INVALID_CAPTURE');
	});

	it('records forbidden host paths and absolute wildcard patterns lexically so later junctions remain observationally absent', () => {
		const { frozen, recipe, root } = fixture();
		const outside = mkdtempSync(join(tmpdir(), 'csaa-compiler-host-forbidden-'));
		temporaryRoots.push(outside);
		write(outside, 'secret.d.ts', 'export declare const secret: true;\n');
		const materialized = materializeProgramRecipe(recipe, root);
		const environment = createCapturingCompilerEnvironment(frozen, root, BUDGETS);
		const host = environment.createProjectHost(recipe, materialized);
		const forbidden = join(root, 'coverage/secret.d.ts');
		expect(host.fileExists(forbidden)).toBe(false);
		expect(host.readFile(forbidden)).toBeUndefined();
		expect(host.realpath!(forbidden)).toBe(forbidden);
		const absoluteExclude = join(root, 'coverage/');
		const directoryResult = host.readDirectory(root, ['.ts'], [absoluteExclude], ['.']);
		const finalized = environment.finalizeCapture();
		symlinkSync(outside, join(root, 'coverage'), process.platform === 'win32' ? 'junction' : 'dir');
		const verified = recheckCompilerInputJournal(finalized);
		const replay = createReplayCompilerEnvironment(frozen, verified);
		const replayHost = replay.createProjectHost(recipe, materialized);
		expect(replayHost.fileExists(forbidden)).toBe(false);
		expect(replayHost.readFile(forbidden)).toBeUndefined();
		expect(replayHost.realpath!(forbidden)).toBe(forbidden);
		expect(replayHost.readDirectory(root, ['.ts'], [absoluteExclude], ['.'])).toEqual(
			directoryResult
		);
		replay.assertFullyConsumed();
	});

	it('preserves undefined extensions as all files while explicit empty extensions remain none through replay', () => {
		const { frozen, recipe, root } = fixture();
		write(root, 'node_modules/mixed/a.d.ts', 'export declare const a: true;\n');
		write(root, 'node_modules/mixed/b.d.mts', 'export declare const b: true;\n');
		write(root, 'node_modules/mixed/package.json', '{}\n');
		write(root, 'node_modules/mixed/runtime.js', 'module.exports = 1;\n');
		const materialized = materializeProgramRecipe(recipe, root);
		const capture = createCapturingCompilerEnvironment(frozen, root, BUDGETS);
		const host = capture.createProjectHost(recipe, materialized);
		const virtualAll = host
			.readDirectory(root, undefined, [], ['.'])
			.map((path) => host.toLogicalPath(path));
		const virtualNone = host
			.readDirectory(root, [], [], ['.'])
			.map((path) => host.toLogicalPath(path));
		const liveRoot = join(root, 'node_modules/mixed');
		const liveAll = host
			.readDirectory(liveRoot, undefined, [], ['.'])
			.map((path) => host.toLogicalPath(path));
		const liveNone = host
			.readDirectory(liveRoot, [], [], ['.'])
			.map((path) => host.toLogicalPath(path));
		expect(virtualAll).toEqual([
			'src/dep.ts',
			'src/index.ts',
			'src/runtime.js',
			'src/view.jsx',
			'tsconfig.json'
		]);
		expect(virtualNone).toEqual([]);
		expect(liveAll).toEqual([
			'node_modules/mixed/a.d.ts',
			'node_modules/mixed/b.d.mts',
			'node_modules/mixed/package.json'
		]);
		expect(liveNone).toEqual([]);
		const verified = recheckCompilerInputJournal(capture.finalizeCapture());
		const replay = createReplayCompilerEnvironment(frozen, verified);
		const replayHost = replay.createProjectHost(recipe, materialized);
		expect(
			replayHost
				.readDirectory(root, undefined, [], ['.'])
				.map((path) => replayHost.toLogicalPath(path))
		).toEqual(virtualAll);
		expect(replayHost.readDirectory(root, [], [], ['.'])).toEqual([]);
		expect(
			replayHost
				.readDirectory(liveRoot, undefined, [], ['.'])
				.map((path) => replayHost.toLogicalPath(path))
		).toEqual(liveAll);
		expect(replayHost.readDirectory(liveRoot, [], [], ['.'])).toEqual([]);
		replay.assertFullyConsumed();
	});

	it('binds authoritative project-resolution identity independently of identical materialized inputs', () => {
		const { frozen, recipe, root } = fixture();
		const materialized = materializeProgramRecipe(recipe, root);
		const capture = createCapturingCompilerHost(frozen, root, recipe, materialized, BUDGETS);
		const passA = exercise(capture.host, materialized);
		const verified = recheckCompilerInputJournal(capture.finalizeCapture());
		const { projectResolutionDigest: _oldDigest, ...recipeWithoutDigest } = recipe;
		const changedBase = { ...recipeWithoutDigest, configClosureDigest: 'd'.repeat(64) };
		const changedRecipe = {
			...changedBase,
			projectResolutionDigest: programRecipeDigest(changedBase)
		};
		const changedMaterialized = materializeProgramRecipe(changedRecipe, root);
		expect(changedMaterialized).toEqual(materialized);
		rmSync(root, { force: true, recursive: true });
		const replay = createReplayCompilerEnvironment(frozen, verified);
		expectCaptureCode(
			() => replay.createProjectHost(changedRecipe, changedMaterialized),
			'INVALID_CAPTURE'
		);
		expect(passA.sources).toHaveLength(2);
	});

	it('rejects overlong enumerated children through the host before following their outside targets', () => {
		const { frozen, recipe, root } = fixture();
		const outside = mkdtempSync(join(tmpdir(), 'csaa-compiler-host-result-bound-'));
		temporaryRoots.push(outside);
		write(outside, 'secret.d.ts', 'export declare const secret: true;\n');
		mkdirSync(join(root, 'node_modules/pkg'), { recursive: true });
		symlinkSync(
			outside,
			join(root, 'node_modules/pkg', `long-${'x'.repeat(80)}`),
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		const environment = createCapturingCompilerEnvironment(frozen, root, {
			...BUDGETS,
			maxPathCharacters: 32
		});
		const host = environment.createProjectHost(recipe, materializeProgramRecipe(recipe, root));
		expectCaptureCode(
			() => host.getDirectories!(join(root, 'node_modules/pkg')),
			'BUDGET_EXCEEDED'
		);
		expectCaptureCode(() => environment.finalizeCapture(), 'INVALID_CAPTURE');
	});

	it('captures, rechecks, and replays a fresh Program after the live repository is removed', () => {
		const { frozen, recipe, root } = fixture();
		const materialized = materializeProgramRecipe(recipe, root);
		const rejectedWrite = createCapturingCompilerHost(frozen, root, recipe, materialized, BUDGETS);
		try {
			rejectedWrite.host.writeFile(join(root, 'forbidden.js'), 'forbidden', false);
			throw new Error('Expected write to fail.');
		} catch (error) {
			expect(error).toBeInstanceOf(CompilerInputCaptureError);
			expect((error as CompilerInputCaptureError).code).toBe('CONTEXT_UNAVAILABLE');
		}
		expectCaptureCode(() => rejectedWrite.finalizeCapture(), 'INVALID_CAPTURE');

		const capture = createCapturingCompilerHost(frozen, root, recipe, materialized, BUDGETS);
		expect(capture.host.getEnvironmentVariable?.('PATH')).toBeUndefined();
		const passA = exercise(capture.host, materialized);
		expect(passA.sources).toHaveLength(2);
		expect(passA.identifiers).toBeGreaterThan(0);
		const finalized = capture.finalizeCapture();
		const entries = finalized.entries;
		expect(
			entries.some(
				(entry) =>
					entry.observation.operation === 'READ_FILE' && entry.observation.result === 'PRESENT'
			)
		).toBe(true);
		expect(
			entries.some((entry) => entry.observation.operation === 'USE_CASE_SENSITIVE_FILE_NAMES')
		).toBe(true);
		const verified = recheckCompilerInputJournal(finalized);

		rmSync(root, { force: true, recursive: true });
		const replay = createReplayCompilerHost(frozen, recipe, materialized, verified);
		const passB = exercise(replay.host, materialized);
		expect(passB).toEqual(passA);
		try {
			replay.host.fileExists(join(root, 'src/not-recorded.ts'));
			throw new Error('Expected unrecorded replay query to fail.');
		} catch (error) {
			expect(error).toBeInstanceOf(CompilerInputCaptureError);
			expect((error as CompilerInputCaptureError).code).toBe('UNRECORDED_QUERY');
		}
		expectCaptureCode(() => replay.assertFullyConsumed(), 'INVALID_CAPTURE');
	});

	it('decodes supported BOMs and reports malformed source bytes through a typed failure', () => {
		const bigEndianBody = new Uint8Array(Buffer.from(FIXTURE_FILES['src/index.ts'], 'utf16le'));
		for (let index = 0; index < bigEndianBody.length; index += 2)
			[bigEndianBody[index], bigEndianBody[index + 1]] = [
				bigEndianBody[index + 1]!,
				bigEndianBody[index]!
			];
		for (const bytes of [
			new Uint8Array([
				0xef,
				0xbb,
				0xbf,
				...new TextEncoder().encode(FIXTURE_FILES['src/index.ts'])
			]),
			new Uint8Array([0xff, 0xfe, ...Buffer.from(FIXTURE_FILES['src/index.ts'], 'utf16le')]),
			new Uint8Array([0xfe, 0xff, ...bigEndianBody])
		]) {
			const fixtureValue = fixture();
			const frozen = withIndexBytes(fixtureValue.frozen, bytes);
			const materialized = materializeProgramRecipe(fixtureValue.recipe, fixtureValue.root);
			const capture = createCapturingCompilerHost(
				frozen,
				fixtureValue.root,
				fixtureValue.recipe,
				materialized,
				BUDGETS
			);
			const source = capture.host.getSourceFile(materialized.rootNames[0]!, ts.ScriptTarget.ES2022);
			expect(source?.text).toBe(FIXTURE_FILES['src/index.ts']);
		}

		for (const malformedBytes of [
			new Uint8Array([0xff, 0xff, 0xff]),
			new Uint8Array([0xff, 0xfe, 0x61]),
			new Uint8Array([0xfe, 0xff, 0x00]),
			new Uint8Array([0xff, 0xfe, 0x00, 0xd8])
		]) {
			const malformedFixture = fixture();
			const malformed = withIndexBytes(malformedFixture.frozen, malformedBytes);
			const materialized = materializeProgramRecipe(malformedFixture.recipe, malformedFixture.root);
			const capture = createCapturingCompilerHost(
				malformed,
				malformedFixture.root,
				malformedFixture.recipe,
				materialized,
				BUDGETS
			);
			try {
				capture.host.getSourceFile(materialized.rootNames[0]!, ts.ScriptTarget.ES2022);
				throw new Error('Expected decoding to fail.');
			} catch (error) {
				expect(error).toBeInstanceOf(CompilerInputCaptureError);
				expect((error as CompilerInputCaptureError).code).toBe('INVALID_CAPTURE');
			}
			expectCaptureCode(() => capture.finalizeCapture(), 'INVALID_CAPTURE');
		}
	});

	it('captures the pinned TypeScript package context for a normal noLib:false Program and replays it without repository I/O', () => {
		const fixtureValue = fixture();
		const toolchainBudgets = {
			...BUDGETS,
			maxContextBytes: 16 * 1024 * 1024,
			maxContextFileBytes: 4 * 1024 * 1024,
			// Coverage instrumentation can exceed the shared 30-second fixture guard while walking
			// the pinned TypeScript library surface. This is test-operation headroom, not a product SLO.
			maxDurationMs: 60_000
		};
		const { projectResolutionDigest: _digest, ...recipeWithoutDigest } = fixtureValue.recipe;
		const noLibBase = {
			...recipeWithoutDigest,
			compilerOptions: { ...recipeWithoutDigest.compilerOptions, noLib: false }
		};
		const noLibRecipe = { ...noLibBase, projectResolutionDigest: programRecipeDigest(noLibBase) };
		const materialized = materializeProgramRecipe(noLibRecipe, fixtureValue.root);
		const capture = createCapturingCompilerHost(
			fixtureValue.frozen,
			fixtureValue.root,
			noLibRecipe,
			materialized,
			toolchainBudgets
		);
		const passA = exercise(capture.host, materialized);
		const finalized = capture.finalizeCapture();
		const entries = finalized.entries;
		const toolchainReads = entries.filter(
			(entry) =>
				entry.observation.operation === 'READ_FILE' &&
				entry.observation.result === 'PRESENT' &&
				entry.observation.logicalPath.startsWith('@toolchain/typescript/')
		);
		expect(toolchainReads.length).toBeGreaterThan(0);
		expect(
			toolchainReads.every(
				(entry) =>
					entry.observation.operation === 'READ_FILE' &&
					entry.observation.result === 'PRESENT' &&
					entry.observation.origin === 'TOOLCHAIN_LIBRARY' &&
					entry.observation.byteBudgetClass === 'LIVE_COMPILER_CONTEXT'
			)
		).toBe(true);
		const verified = recheckCompilerInputJournal(finalized);
		rmSync(fixtureValue.root, { force: true, recursive: true });
		const replay = createReplayCompilerHost(
			fixtureValue.frozen,
			noLibRecipe,
			materialized,
			verified
		);
		expect(exercise(replay.host, materialized)).toEqual(passA);
		replay.environment.assertFullyConsumed();
	}, 60_000);

	it('uses one snapshot-wide authority and reproduces exact per-project attribution across two fresh Programs', () => {
		const root = mkdtempSync(join(tmpdir(), 'csaa-compiler-environment-'));
		temporaryRoots.push(root);
		const files = {
			'packages/a/src/index.ts': 'export const a = 1;\n',
			'packages/a/tsconfig.json': '{}\n',
			'packages/b/src/index.ts': 'export const b = 2;\n',
			'packages/b/tsconfig.json': '{}\n',
			'packages/shared/src/index.ts': 'export const shared = true;\n'
		} as const;
		for (const [path, content] of Object.entries(files)) write(root, path, content);
		mkdirSync(join(root, 'node_modules/@fixture'), { recursive: true });
		symlinkSync(
			join(root, 'packages/shared'),
			join(root, 'node_modules/@fixture/shared'),
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		const artifacts = Object.entries(files).map(([path, content]) => ({
			bytes: Buffer.byteLength(content),
			canonicalPathKey: path.toLowerCase(),
			disposition: 'ANALYZED' as const,
			path,
			primaryClass: path.endsWith('.json')
				? ('PROJECT_CONFIGURATION' as const)
				: ('PRODUCTION_SOURCE' as const),
			reason: 'fixture',
			roles: path.endsWith('.json')
				? ['CONFIGURATION' as const]
				: ['ANALYSIS_INPUT' as const, 'COMPILER_CANDIDATE' as const],
			sha256: sha256(content)
		}));
		const workspace = {
			exports: [],
			kind: 'PACKAGE',
			manifestPath: 'packages/shared/package.json',
			name: '@fixture/shared',
			path: 'packages/shared',
			private: true,
			provenance: [],
			workspacePatterns: []
		} as FrozenSubject['workspaces'][number];
		const frozen = {
			artifacts,
			descriptor: { subjectId: 'd'.repeat(64) },
			diagnostics: [],
			excludedArtifacts: [],
			generatedContexts: [],
			population: {
				analyzed: artifacts.length,
				discovered: artifacts.length,
				excluded: 0,
				failed: 0,
				included: artifacts.length,
				inventoryOnly: 0,
				reconciles: true
			},
			projects: [],
			request: {},
			workspaces: [workspace]
		} as unknown as FrozenSubject;
		attachFrozenSubjectBytes(
			frozen,
			new Map(
				Object.entries(files).map(([path, content]) => [path, new TextEncoder().encode(content)])
			)
		);
		const recipe = (name: 'a' | 'b'): ProgramRecipe => {
			const base = {
				compilerOptions: {
					configFilePath: `packages/${name}/tsconfig.json`,
					module: ts.ModuleKind.ESNext,
					moduleResolution: ts.ModuleResolutionKind.Bundler,
					noEmit: true,
					noLib: true,
					strict: true,
					target: ts.ScriptTarget.ES2022
				},
				configClosureDigest: name.repeat(64),
				configPath: `packages/${name}/tsconfig.json`,
				kind: 'PROJECT' as const,
				projectReferences: [],
				provider: { id: 'typescript' as const, version: TYPESCRIPT_PROVIDER_VERSION },
				rootNames: [`packages/${name}/src/index.ts`]
			};
			return { ...base, projectResolutionDigest: programRecipeDigest(base) };
		};
		const recipeA = recipe('a');
		const recipeB = recipe('b');
		const materializedA = materializeProgramRecipe(recipeA, root);
		const materializedB = materializeProgramRecipe(recipeB, root);
		const capture = createCapturingCompilerEnvironment(frozen, root, BUDGETS);
		const hostA = capture.createProjectHost(recipeA, materializedA);
		const hostB = capture.createProjectHost(recipeB, materializedB);
		const workspaceAliasFile = join(root, 'node_modules/@fixture/shared/src/index.ts');
		expect(hostA.toLogicalPath(workspaceAliasFile)).toBe(
			'node_modules/@fixture/shared/src/index.ts'
		);
		const passA = exercise(hostA, materializedA);
		const passB = exercise(hostB, materializedB);
		const finalized = capture.finalizeCapture();
		const entries = finalized.entries;
		const aliasTopology = entries.find(
			(entry) =>
				entry.query.operation === 'REALPATH' &&
				entry.query.logicalPath === 'node_modules/@fixture/shared'
		);
		expect(aliasTopology?.observation).toMatchObject({
			invocationCount: 2,
			resolvedLogicalPath: 'packages/shared',
			result: 'RESOLVED'
		});
		const attributions = finalized.projectAttributions;
		expect(attributions).toHaveLength(2);
		expect(
			attributions.every((attribution) =>
				attribution.queryInvocations.some(
					(record) =>
						record.query.operation === 'REALPATH' &&
						record.query.logicalPath === 'node_modules/@fixture/shared'
				)
			)
		).toBe(true);
		const verified = recheckCompilerInputJournal(finalized);
		rmSync(root, { force: true, recursive: true });
		const replay = createReplayCompilerEnvironment(frozen, verified);
		const replayA = replay.createProjectHost(recipeA, materializedA);
		const replayB = replay.createProjectHost(recipeB, materializedB);
		expect(replayA.toLogicalPath(workspaceAliasFile)).toBe(
			'node_modules/@fixture/shared/src/index.ts'
		);
		expect(exercise(replayA, materializedA)).toEqual(passA);
		expect(exercise(replayB, materializedB)).toEqual(passB);
		replay.assertFullyConsumed();
	});

	it('poisons capture and replay atomically when mandatory workspace-alias setup fails after a committed prefix', () => {
		const fixtureValue = fixture();
		for (const name of ['a', 'b']) {
			mkdirSync(join(fixtureValue.root, `packages/${name}`), { recursive: true });
			mkdirSync(join(fixtureValue.root, 'node_modules/@fixture'), { recursive: true });
			symlinkSync(
				join(fixtureValue.root, `packages/${name}`),
				join(fixtureValue.root, `node_modules/@fixture/${name}`),
				process.platform === 'win32' ? 'junction' : 'dir'
			);
		}
		const workspaces = (['a', 'b'] as const).map((name) => ({
			exports: [],
			kind: 'PACKAGE',
			manifestPath: `packages/${name}/package.json`,
			name: `@fixture/${name}`,
			path: `packages/${name}`,
			private: true,
			provenance: [],
			workspacePatterns: []
		})) as FrozenSubject['workspaces'];
		const frozen = { ...fixtureValue.frozen, workspaces } as FrozenSubject;
		attachFrozenSubjectBytes(
			frozen,
			new Map(
				Object.entries(FIXTURE_FILES).map(([path, content]) => [
					path,
					new TextEncoder().encode(content)
				])
			)
		);
		const materialized = materializeProgramRecipe(fixtureValue.recipe, fixtureValue.root);

		const captureEnvironment = createCapturingCompilerEnvironment(frozen, fixtureValue.root, {
			...BUDGETS,
			maxCompilerQueries: 1
		});
		expectCaptureCode(
			() => captureEnvironment.createProjectHost(fixtureValue.recipe, materialized),
			'BUDGET_EXCEEDED'
		);
		expectCaptureCode(() => captureEnvironment.finalizeCapture(), 'INVALID_CAPTURE');

		const paths = new FrozenCompilerPathResolver(
			frozen,
			fixtureValue.root,
			ts.sys.useCaseSensitiveFileNames
		);
		const reader = new LiveCompilerInputReader(frozen, paths, ts.sys.useCaseSensitiveFileNames);
		const journal = new CompilerInputJournal(reader, BUDGETS, Date.now());
		journal.registerProject(fixtureValue.recipe.configPath, fixtureValue.recipe, materialized);
		journal.capture(
			{ logicalPath: paths.workspaceAliasRoots()[0]!, operation: 'REALPATH' },
			fixtureValue.recipe.configPath
		);
		const verified = recheckCompilerInputJournal(journal.finalizeCapture());
		const replayEnvironment = createReplayCompilerEnvironment(frozen, verified);
		expectCaptureCode(
			() => replayEnvironment.createProjectHost(fixtureValue.recipe, materialized),
			'UNRECORDED_QUERY'
		);
		expectCaptureCode(() => replayEnvironment.assertFullyConsumed(), 'INVALID_CAPTURE');
	});

	it('exposes a replay budget witness only after exact environment consumption', () => {
		const { frozen, recipe, root } = fixture();
		const materialized = materializeProgramRecipe(recipe, root);
		const capture = createCapturingCompilerEnvironment(frozen, root, BUDGETS);
		const captureHost = capture.createProjectHost(recipe, materialized);
		expect(captureHost.fileExists(materialized.rootNames[0]!)).toBe(true);
		const verified = recheckCompilerInputJournal(capture.finalizeCapture());

		const incomplete = createReplayCompilerEnvironment(frozen, verified);
		incomplete.createProjectHost(recipe, materialized);
		const incompleteOperation = createStaticSemanticOperationBudgetSession(BUDGETS, Date.now());
		expectCaptureCode(
			() => incomplete.issueRecheckOperationBudgetWitness(incompleteOperation.providerBinding()),
			'INVALID_CAPTURE'
		);
		expectCaptureCode(() => incomplete.assertFullyConsumed(), 'UNCONSUMED_QUERY');
		expectCaptureCode(
			() => incomplete.issueRecheckOperationBudgetWitness(incompleteOperation.providerBinding()),
			'INVALID_CAPTURE'
		);

		const replay = createReplayCompilerEnvironment(frozen, verified);
		const replayHost = replay.createProjectHost(recipe, materialized);
		expect(replayHost.fileExists(materialized.rootNames[0]!)).toBe(true);
		replay.assertFullyConsumed();
		const operation = createStaticSemanticOperationBudgetSession(BUDGETS, Date.now());
		const witness = replay.issueRecheckOperationBudgetWitness(operation.providerBinding());
		expect(replay.issueRecheckOperationBudgetWitness(operation.providerBinding())).toBe(witness);

		const fakeSession = createStaticSemanticOperationBudgetSession(BUDGETS, Date.now());
		expectCaptureCode(
			() => fakeSession.acceptCompilerInputWitness('RECHECK', Object.freeze({}) as never),
			'INVALID_CAPTURE'
		);
		const cloneSession = createStaticSemanticOperationBudgetSession(BUDGETS, Date.now());
		expectCaptureCode(
			() => cloneSession.acceptCompilerInputWitness('RECHECK', structuredClone(witness) as never),
			'INVALID_CAPTURE'
		);
		const wrongSession = createStaticSemanticOperationBudgetSession(BUDGETS, Date.now());
		expectCaptureCode(
			() => wrongSession.acceptCompilerInputWitness('RECHECK', witness),
			'INVALID_CAPTURE'
		);
		operation.acceptCompilerInputWitness('RECHECK', witness);
		expectCaptureCode(
			() => operation.acceptCompilerInputWitness('RECHECK', witness),
			'INVALID_CAPTURE'
		);
	});
});
