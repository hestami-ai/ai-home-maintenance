import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ts from 'typescript';
import { TYPESCRIPT_PROVIDER_VERSION, type SemanticBudgets } from '../../contracts/semantic.js';
import type { FrozenSubject, ProgramRecipe } from '../../contracts/subject.js';
import { sha256 } from '../../inventory/canonical.js';
import { canonicalSemanticJson } from '../../semantic/canonical.js';
import {
	compilerInputResultDigest,
	programRecipeDigest,
	semanticContextInputId
} from '../../semantic/ids.js';
import type {
	SemanticOperationBudgetPhase,
	SemanticOperationPopulationClaimInput
} from '../../semantic/operation-budget-ledger.js';
import {
	createStaticSemanticOperationBudgetSession,
	issueStaticSemanticOperationBudgetWitnessForTesting,
	type StaticSemanticOperationBudgetSession
} from '../../semantic/static-semantic-operation-budget-session.js';
import { attachFrozenSubjectBytes } from '../../subject/frozen-store.js';
import {
	CompilerInputCaptureError,
	CompilerInputJournal,
	LiveCompilerInputReader,
	ReplayCompilerInputJournal,
	issueFrozenCompilerCaptureOperationBudgetWitness,
	issueReplayCompilerInputOperationBudgetWitness,
	normalizeSemanticBudgets,
	recheckCompilerInputJournal,
	takeCompilerInputOperationBudgetWitness,
	type CompilerInputQuery,
	type FrozenCompilerCapture,
	type VerifiedCompilerCapture
} from './compiler-input-journal.js';
import { CompilerPathError, FrozenCompilerPathResolver } from './compiler-paths.js';
import {
	materializeProgramRecipe,
	type MaterializedProgramRecipe
} from './materialize-program-recipe.js';

const temporaryRoots: string[] = [];
const PROJECT_KEY = 'project/tsconfig.json';

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
	maxProjects: 100,
	maxSnapshotBytes: 64 * 1024 * 1024,
	maxScopes: 100_000,
	maxSources: 10_000
};

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

function temporaryRoot(prefix = 'csaa-compiler-input-'): string {
	const root = mkdtempSync(join(tmpdir(), prefix));
	temporaryRoots.push(root);
	return root;
}

function write(root: string, path: string, content: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, content, 'utf8');
}

function subject(
	files: Readonly<Record<string, string>>,
	overrides: Partial<
		Pick<FrozenSubject, 'excludedArtifacts' | 'generatedContexts' | 'projects' | 'workspaces'>
	> = {}
): FrozenSubject {
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
		descriptor: { subjectId: 'a'.repeat(64) },
		diagnostics: [],
		excludedArtifacts: overrides.excludedArtifacts ?? [],
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
	attachFrozenSubjectBytes(
		frozen,
		new Map(
			Object.entries(files).map(([path, content]) => [path, new TextEncoder().encode(content)])
		)
	);
	return frozen;
}

function projectBinding(
	root: string,
	projectKey = PROJECT_KEY
): { readonly materialized: MaterializedProgramRecipe; readonly recipe: ProgramRecipe } {
	const base = {
		compilerOptions: { configFilePath: projectKey, noEmit: true, noLib: true },
		configClosureDigest: 'b'.repeat(64),
		configPath: projectKey,
		kind: 'SOLUTION' as const,
		projectReferences: [],
		provider: { id: 'typescript' as const, version: TYPESCRIPT_PROVIDER_VERSION },
		rootNames: []
	};
	const recipe = { ...base, projectResolutionDigest: programRecipeDigest(base) };
	return { materialized: materializeProgramRecipe(recipe, root), recipe };
}

function session(
	root: string,
	frozen: FrozenSubject,
	caseSensitive = true,
	budgets: SemanticBudgets = BUDGETS,
	startedAtMs = Date.now()
) {
	const paths = new FrozenCompilerPathResolver(frozen, root, caseSensitive);
	const reader = new LiveCompilerInputReader(frozen, paths, caseSensitive);
	const journal = new CompilerInputJournal(reader, budgets, startedAtMs);
	const binding = projectBinding(root);
	journal.registerProject(PROJECT_KEY, binding.recipe, binding.materialized);
	return {
		...binding,
		capture: (query: CompilerInputQuery) => journal.capture(query, PROJECT_KEY),
		finalize: () => journal.finalizeCapture(),
		journal,
		paths,
		reader
	};
}

function replayJournal(
	frozen: FrozenSubject,
	verified: VerifiedCompilerCapture,
	recipe: ProgramRecipe,
	materialized: MaterializedProgramRecipe
): ReplayCompilerInputJournal {
	const replay = new ReplayCompilerInputJournal(frozen, verified);
	replay.registerProject(PROJECT_KEY, recipe, materialized);
	return replay;
}

function expectCode(
	action: () => unknown,
	errorType: typeof CompilerInputCaptureError | typeof CompilerPathError,
	code: string
): void {
	try {
		action();
		throw new Error('Expected action to fail.');
	} catch (error) {
		expect(error).toBeInstanceOf(errorType);
		expect((error as { code: string }).code).toBe(code);
	}
}

function compilerInputBudgetClaims(
	capture: Pick<FrozenCompilerCapture, 'entries' | 'observations' | 'projectAttributions'>,
	phase: 'CAPTURE' | 'RECHECK' | 'VALIDATE'
): readonly SemanticOperationPopulationClaimInput[] {
	const liveContext = capture.observations
		.filter(
			(observation) =>
				observation.operation === 'READ_FILE' &&
				observation.result === 'PRESENT' &&
				observation.byteBudgetClass === 'LIVE_COMPILER_CONTEXT'
		)
		.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
	return [
		{
			members: capture.projectAttributions.map((attribution) => attribution.projectKey).sort(),
			mode: 'COUNT',
			phase,
			population: 'PROJECTS'
		},
		{
			members: capture.entries.map((entry) => canonicalSemanticJson(entry.query)).sort(),
			mode: 'COUNT',
			phase,
			population: 'COMPILER_INPUTS'
		},
		{
			contributions: [
				{
					amount: Buffer.byteLength(canonicalSemanticJson(capture.observations), 'utf8'),
					key: 'canonical-compiler-input-array'
				}
			],
			mode: 'SUM',
			phase,
			population: 'COMPILER_INPUT_METADATA_BYTES'
		},
		{
			members: liveContext.map((observation) => observation.id),
			mode: 'COUNT',
			phase,
			population: 'CONTEXT_FILES'
		},
		{
			contributions: liveContext.flatMap((observation) =>
				'contentBytes' in observation && observation.contentBytes > 0
					? [{ amount: observation.contentBytes, key: observation.id }]
					: []
			),
			mode: 'SUM',
			phase,
			population: 'CONTEXT_BYTES'
		},
		{
			contributions: capture.observations
				.flatMap((observation) =>
					'scannedEntries' in observation && observation.scannedEntries > 0
						? [{ amount: observation.scannedEntries, key: observation.id }]
						: []
				)
				.sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0)),
			mode: 'SUM',
			phase,
			population: 'DIRECTORY_ENTRIES'
		}
	];
}

function emptyRawBudgetClaims(
	phase: 'CAPTURE' | 'EXTRACT' | 'VALIDATE'
): readonly SemanticOperationPopulationClaimInput[] {
	return [
		{ members: [], mode: 'COUNT', phase, population: 'SOURCES' },
		{ contributions: [], mode: 'SUM', phase, population: 'AST_NODES' },
		{ contributions: [], mode: 'SUM', phase, population: 'SCOPES' },
		{ contributions: [], mode: 'SUM', phase, population: 'DIAGNOSTICS' },
		{ contributions: [], mode: 'SUM', phase, population: 'DIAGNOSTIC_CHARACTERS' },
		{ contributions: [], mode: 'SUM', phase, population: 'COMPILER_FACTS' }
	];
}

function acceptTestBudgetClaims(
	operation: StaticSemanticOperationBudgetSession,
	phase: SemanticOperationBudgetPhase,
	populationClaims: readonly SemanticOperationPopulationClaimInput[]
): void {
	operation.acceptWitness(
		phase,
		issueStaticSemanticOperationBudgetWitnessForTesting(operation, {
			phase,
			populationClaims,
			queryInvocations: []
		})
	);
}

function hostileProxy<T extends object>(target: T, trapCount: { value: number }): T {
	const trap = (): never => {
		trapCount.value += 1;
		throw new TypeError('hostile trap executed');
	};
	return new Proxy(target, {
		defineProperty: trap,
		deleteProperty: trap,
		get: trap,
		getOwnPropertyDescriptor: trap,
		getPrototypeOf: trap,
		has: trap,
		ownKeys: trap,
		set: trap
	});
}

describe('frozen compiler path authorization', () => {
	it('rejects traversal and authorized-directory escapes while forbidden regions remain inert', () => {
		const root = temporaryRoot();
		const outside = temporaryRoot('csaa-compiler-outside-');
		write(outside, 'secret.d.ts', 'export declare const secret: true;\n');
		symlinkSync(outside, join(root, 'coverage'), process.platform === 'win32' ? 'junction' : 'dir');
		mkdirSync(join(root, 'node_modules/pkg'), { recursive: true });
		symlinkSync(
			outside,
			join(root, 'node_modules/pkg/escape'),
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		const { paths, reader } = session(root, subject({}));
		expectCode(
			() => paths.toAbsolute('@toolchain/typescript/lib/../typescript.js'),
			CompilerPathError,
			'PATH_ESCAPE'
		);
		for (const operation of ['READ_FILE', 'FILE_EXISTS', 'REALPATH'] as const) {
			expect(
				reader.observe({ logicalPath: 'coverage/secret.d.ts', operation }).observation
			).toMatchObject({ result: 'ABSENT' });
		}
		expectCode(
			() => reader.observe({ logicalPath: 'node_modules/pkg', operation: 'GET_DIRECTORIES' }),
			CompilerPathError,
			'PATH_ESCAPE'
		);
	});

	it('authorizes file class before metadata so forbidden node_modules files cannot reveal presence', () => {
		const root = temporaryRoot();
		mkdirSync(join(root, 'node_modules/pkg'), { recursive: true });
		const { reader } = session(root, subject({}));
		const observe = () =>
			(['READ_FILE', 'FILE_EXISTS', 'REALPATH'] as const).map(
				(operation) =>
					reader.observe({ logicalPath: 'node_modules/pkg/runtime.js', operation }).observation
						.result
			);
		expect(observe()).toEqual(['ABSENT', 'ABSENT', 'ABSENT']);
		write(root, 'node_modules/pkg/runtime.js', 'module.exports = 1;\n');
		expect(observe()).toEqual(['ABSENT', 'ABSENT', 'ABSENT']);
	});

	it('records nested package-directory existence while withholding its realpath', () => {
		const root = temporaryRoot();
		mkdirSync(join(root, 'node_modules/pkg'), { recursive: true });
		const { reader } = session(root, subject({}));
		expect(
			reader.observe({ logicalPath: 'node_modules/pkg', operation: 'DIRECTORY_EXISTS' }).observation
		).toMatchObject({ result: 'DIRECTORY' });
		expect(
			reader.observe({ logicalPath: 'node_modules/pkg', operation: 'REALPATH' }).observation
		).toMatchObject({ result: 'ABSENT' });
	});

	it('canonicalizes case and rejects a workspace alias bound to the wrong target', () => {
		const root = temporaryRoot();
		write(root, 'Src/A.ts', 'export const a = 1;\n');
		expect(
			new FrozenCompilerPathResolver(
				subject({ 'Src/A.ts': 'export const a = 1;\n' }),
				root,
				false
			).canonicalLogical('src/a.ts')
		).toBe('Src/A.ts');
		mkdirSync(join(root, 'packages/good'), { recursive: true });
		mkdirSync(join(root, 'packages/wrong'), { recursive: true });
		mkdirSync(join(root, 'node_modules/@fixture'), { recursive: true });
		symlinkSync(
			join(root, 'packages/wrong'),
			join(root, 'node_modules/@fixture/pkg'),
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		const workspace = {
			exports: [],
			kind: 'PACKAGE',
			manifestPath: 'packages/good/package.json',
			name: '@fixture/pkg',
			path: 'packages/good',
			private: true,
			provenance: [],
			workspacePatterns: []
		} as FrozenSubject['workspaces'][number];
		expectCode(
			() => new FrozenCompilerPathResolver(subject({}, { workspaces: [workspace] }), root, false),
			CompilerPathError,
			'PATH_ESCAPE'
		);
	});

	it('validates a finalized capture before live alias inspection and reports alias drift uniformly', () => {
		const root = temporaryRoot();
		write(root, 'packages/good/src/index.ts', 'export const workspace = true;\n');
		const workspace = {
			exports: [],
			kind: 'PACKAGE',
			manifestPath: 'packages/good/package.json',
			name: '@fixture/pkg',
			path: 'packages/good',
			private: true,
			provenance: [],
			workspacePatterns: []
		} as FrozenSubject['workspaces'][number];
		const frozen = subject(
			{ 'packages/good/src/index.ts': 'export const workspace = true;\n' },
			{ workspaces: [workspace] }
		);
		const capture = session(root, frozen);
		expect(
			capture.capture({
				logicalPath: 'node_modules/@fixture/pkg/src/index.ts',
				operation: 'FILE_EXISTS'
			}).observation
		).toMatchObject({ result: 'ABSENT' });
		const finalized = capture.finalize();
		mkdirSync(join(root, 'node_modules/@fixture'), { recursive: true });
		symlinkSync(
			join(root, 'packages/good'),
			join(root, 'node_modules/@fixture/pkg'),
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		expectCode(
			() => recheckCompilerInputJournal({ ...finalized } as FrozenCompilerCapture),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);
		expectCode(
			() => recheckCompilerInputJournal(finalized),
			CompilerInputCaptureError,
			'CONTEXT_CHANGED'
		);
	});

	it('uses stable-handle reads and detects live generated-context mutation at freshness recheck', () => {
		const root = temporaryRoot();
		const initial = 'export declare const generated: true;\n';
		write(root, 'generated/context.d.ts', initial);
		const generatedContext = {
			path: 'generated/context.d.ts',
			selectedInput: false,
			sha256: sha256(initial)
		} as FrozenSubject['generatedContexts'][number];
		const frozen = subject({}, { generatedContexts: [generatedContext] });
		const capture = session(root, frozen);
		expect(
			capture.capture({ logicalPath: 'generated/context.d.ts', operation: 'READ_FILE' }).observation
		).toMatchObject({ byteBudgetClass: 'LIVE_COMPILER_CONTEXT', result: 'PRESENT' });
		const finalized = capture.finalize();
		write(root, 'generated/context.d.ts', 'export declare const changed: true;\n');
		expectCode(
			() => recheckCompilerInputJournal(finalized),
			CompilerInputCaptureError,
			'CONTEXT_CHANGED'
		);
	});
});

describe('TypeScript directory parity and bounded traversal', () => {
	it('matches the TypeScript 5.9.3 wildcard matrix including empty extensions and invalid terminal ** includes', () => {
		const root = temporaryRoot();
		for (const path of [
			'node_modules/pkg/at@sign/a.d.ts',
			'node_modules/pkg/hash#tag/a.d.ts',
			'node_modules/pkg/index.d.ts',
			'node_modules/pkg/.hidden.d.ts',
			'node_modules/pkg/src/a.d.ts',
			'node_modules/pkg/src/deep/b.d.ts',
			'node_modules/pkg/src/skip/c.d.ts',
			'node_modules/pkg/src/one/terminal/end.d.ts',
			'node_modules/pkg/with-hyphen/a.d.ts'
		])
			write(root, path, 'export {};\n');
		const { paths, reader } = session(root, subject({}), ts.sys.useCaseSensitiveFileNames);
		const absolute = join(root, 'node_modules/pkg');
		const matrix = [
			{ depth: null, excludes: [], extensions: [], includes: [] },
			{ depth: null, excludes: [], extensions: ['.d.ts'], includes: ['**'] },
			{ depth: null, excludes: [], extensions: ['.d.ts'], includes: ['src/*/terminal/**'] },
			{ depth: null, excludes: [], extensions: ['.d.ts'], includes: ['src/'] },
			{ depth: null, excludes: [], extensions: ['.d.ts'], includes: ['.'] },
			{ depth: null, excludes: ['src/deep/'], extensions: ['.d.ts'], includes: ['.'] },
			{ depth: null, excludes: ['.'], extensions: ['.d.ts'], includes: ['.'] },
			{ depth: null, excludes: [], extensions: ['.d.ts'], includes: ['at@sign/'] },
			{ depth: null, excludes: [], extensions: ['.d.ts'], includes: ['hash#tag/'] },
			{ depth: null, excludes: [], extensions: ['.d.ts'], includes: ['with-hyphen/'] },
			{ depth: null, excludes: [], extensions: ['.d.ts'], includes: [] },
			{ depth: 0, excludes: [], extensions: ['.d.ts'], includes: ['**/*'] },
			{ depth: null, excludes: ['src/skip/**'], extensions: ['.d.ts'], includes: ['src/**/*'] },
			{ depth: 2, excludes: [], extensions: ['.d.ts'], includes: [] },
			{ depth: null, excludes: [], extensions: ['.d.ts'], includes: ['src/?eep/*'] }
		] as const;
		for (const parameters of matrix) {
			const expected = ts.sys
				.readDirectory(
					absolute,
					[...parameters.extensions],
					[...parameters.excludes],
					[...parameters.includes],
					parameters.depth ?? undefined
				)
				.map((path) => paths.toLogical(path))
				.sort();
			const observation = reader.observe({
				...parameters,
				logicalPath: 'node_modules/pkg',
				operation: 'READ_DIRECTORY'
			}).observation;
			expect('resultEntries' in observation ? observation.resultEntries : []).toEqual(expected);
		}
	});

	it('matches directory-form includes on virtual topology and preserves them through capture, recheck, and replay', () => {
		const root = temporaryRoot();
		const files = {
			'src/a.d.ts': 'export declare const a: true;\n',
			'src/deep/b.d.ts': 'export declare const b: true;\n',
			'top.d.ts': 'export declare const top: true;\n'
		};
		for (const [path, content] of Object.entries(files))
			write(root, `node_modules/mirror/${path}`, content);
		const frozen = subject(files);
		const capture = session(root, frozen, ts.sys.useCaseSensitiveFileNames);
		for (const parameters of [
			{ excludes: [], includes: ['src/'] },
			{ excludes: [], includes: ['.'] },
			{ excludes: ['src/deep/'], includes: ['.'] },
			{ excludes: ['.'], includes: ['.'] }
		] as const) {
			const query = {
				depth: null,
				excludes: [...parameters.excludes],
				extensions: ['.d.ts'],
				includes: [...parameters.includes],
				logicalPath: '.',
				operation: 'READ_DIRECTORY' as const
			};
			const virtual = capture.reader.observe(query).observation;
			const expected = ts.sys
				.readDirectory(
					join(root, 'node_modules/mirror'),
					['.d.ts'],
					[...parameters.excludes],
					[...parameters.includes]
				)
				.map((path) => capture.paths.toLogical(path).replace(/^node_modules\/mirror\//u, ''))
				.sort();
			expect('resultEntries' in virtual ? virtual.resultEntries : []).toEqual(expected);
			const live = capture.reader.observe({
				...query,
				logicalPath: 'node_modules/mirror'
			}).observation;
			expect(
				'resultEntries' in live
					? live.resultEntries.map((path) => path.replace(/^node_modules\/mirror\//u, ''))
					: []
			).toEqual(expected);
			capture.capture(query);
		}
		const finalized = capture.finalize();
		const verified = recheckCompilerInputJournal(finalized);
		const replay = replayJournal(frozen, verified, capture.recipe, capture.materialized);
		for (const entry of finalized.entries) replay.replay(entry.query, PROJECT_KEY);
		replay.assertFullyConsumed();
	});

	it('preserves observed case for literal extension filtering while canonicalizing result identity', () => {
		const root = temporaryRoot();
		write(root, 'node_modules/pkg/Upper.D.TS', 'export declare const upper: true;\n');
		const { reader } = session(root, subject({}), false);
		const query = {
			depth: null,
			excludes: [],
			includes: [],
			logicalPath: 'node_modules/pkg',
			operation: 'READ_DIRECTORY' as const
		};
		const upper = reader.observe({ ...query, extensions: ['.D.TS'] }).observation;
		const lower = reader.observe({ ...query, extensions: ['.d.ts'] }).observation;
		expect('resultEntries' in upper ? upper.resultEntries : []).toEqual([
			'node_modules/pkg/upper.d.ts'
		]);
		expect('resultEntries' in lower ? lower.resultEntries : []).toEqual([]);
	});

	it('matches TypeScript UTF-16 wildcard and non-Unicode case-folding semantics', () => {
		const root = temporaryRoot();
		for (const name of ['😀.d.ts', 'ſ.d.ts', 'K.d.ts'])
			write(root, `node_modules/pkg/${name}`, 'export {};\n');
		const { paths, reader } = session(root, subject({}), false);
		const absolute = join(root, 'node_modules/pkg');
		for (const includes of [['?.d.ts'], ['??.d.ts'], ['s.d.ts'], ['k.d.ts']] as const) {
			const expected = ts.sys
				.readDirectory(absolute, ['.d.ts'], [], [...includes])
				.map((path) => paths.toLogical(path))
				.sort();
			const observation = reader.observe({
				depth: null,
				excludes: [],
				extensions: ['.d.ts'],
				includes: [...includes],
				logicalPath: 'node_modules/pkg',
				operation: 'READ_DIRECTORY'
			}).observation;
			expect('resultEntries' in observation ? observation.resultEntries : []).toEqual(expected);
		}
	});

	it('keeps forbidden runtime files inert across READ_DIRECTORY and GET_DIRECTORIES without statting an outside junction', () => {
		const root = temporaryRoot();
		const outside = temporaryRoot('csaa-compiler-forbidden-enumeration-');
		write(root, 'node_modules/pkg/index.d.ts', 'export {};\n');
		write(outside, 'secret.d.ts', 'export declare const secret: true;\n');
		const { reader } = session(root, subject({}));
		const observe = () => [
			reader.observe({ logicalPath: 'node_modules/pkg', operation: 'GET_DIRECTORIES' }).observation,
			reader.observe({
				depth: null,
				excludes: [],
				extensions: ['.d.ts'],
				includes: [],
				logicalPath: 'node_modules/pkg',
				operation: 'READ_DIRECTORY'
			}).observation
		];
		const absent = observe();
		write(root, 'node_modules/pkg/runtime.js', 'module.exports = 1;\n');
		expect(observe()).toEqual(absent);
		rmSync(join(root, 'node_modules/pkg/runtime.js'));
		symlinkSync(
			outside,
			join(root, 'node_modules/pkg/runtime.js'),
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		expect(observe()).toEqual(absent);
	});

	it('enforces produced path and minimum observation metadata bounds before descendant authorization or filesystem work', () => {
		const root = temporaryRoot();
		const outside = temporaryRoot('csaa-compiler-produced-bound-');
		write(outside, 'secret.d.ts', 'export declare const secret: true;\n');
		mkdirSync(join(root, 'node_modules/pkg'), { recursive: true });
		const longChild = `long-${'x'.repeat(80)}`;
		symlinkSync(
			outside,
			join(root, 'node_modules/pkg', longChild),
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		const { reader } = session(root, subject({}));
		const bounded = {
			allowPresentRead: true,
			deadlineMs: Date.now() + 10_000,
			maxDirectoryEntries: 100,
			maxPathCharacters: 32,
			maxQueryMetadataBytes: 10_000,
			maxReadBytes: 1024
		};
		expectCode(
			() =>
				reader.observe({ logicalPath: 'node_modules/pkg', operation: 'GET_DIRECTORIES' }, bounded),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);

		rmSync(join(root, 'node_modules/pkg', longChild), { force: true, recursive: true });
		symlinkSync(
			outside,
			join(root, 'node_modules/pkg/z-escape'),
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		const directoryQuery = {
			depth: null,
			excludes: [],
			extensions: ['.d.ts'],
			includes: [],
			logicalPath: 'node_modules/pkg',
			operation: 'READ_DIRECTORY' as const
		};
		const directoryQueryBytes = Buffer.byteLength(canonicalSemanticJson(directoryQuery), 'utf8');
		expectCode(
			() =>
				reader.observe(directoryQuery, {
					...bounded,
					maxPathCharacters: 16_384,
					maxQueryMetadataBytes: directoryQueryBytes + 2
				}),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);

		rmSync(join(root, 'node_modules/pkg/z-escape'), { force: true, recursive: true });
		symlinkSync(
			outside,
			join(root, 'node_modules/pkg/index.d.ts'),
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		const realpathQuery = {
			logicalPath: 'node_modules/pkg/index.d.ts',
			operation: 'REALPATH' as const
		};
		const realpathQueryBytes = Buffer.byteLength(canonicalSemanticJson(realpathQuery), 'utf8');
		expectCode(
			() =>
				reader.observe(realpathQuery, {
					...bounded,
					maxPathCharacters: 16_384,
					maxQueryMetadataBytes: realpathQueryBytes + 2
				}),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);
	});

	it('prunes excluded virtual subtrees under the same scan budget as live traversal', () => {
		const root = temporaryRoot();
		const frozenFiles: Record<string, string> = { 'types/keep/x.d.ts': 'export {};\n' };
		for (let index = 0; index < 8; index += 1)
			frozenFiles[`types/skip/${index}.d.ts`] = 'export {};\n';
		write(root, 'node_modules/pkg/keep/x.d.ts', 'export {};\n');
		for (let index = 0; index < 8; index += 1)
			write(root, `node_modules/pkg/skip/${index}.d.ts`, 'export {};\n');
		const { reader } = session(root, subject(frozenFiles));
		const limits = {
			allowPresentRead: true,
			deadlineMs: Date.now() + 10_000,
			maxDirectoryEntries: 4,
			maxPathCharacters: 16_384,
			maxQueryMetadataBytes: 4096,
			maxReadBytes: 1024
		};
		const parameters = {
			depth: null,
			excludes: ['skip/**'],
			extensions: ['.d.ts'],
			includes: ['**/*'],
			operation: 'READ_DIRECTORY' as const
		};
		const virtual = reader.observe({ ...parameters, logicalPath: 'types' }, limits).observation;
		const live = reader.observe(
			{ ...parameters, logicalPath: 'node_modules/pkg' },
			limits
		).observation;
		expect(virtual).toMatchObject({ resultEntries: ['types/keep/x.d.ts'], scannedEntries: 3 });
		expect(live).toMatchObject({
			resultEntries: ['node_modules/pkg/keep/x.d.ts'],
			scannedEntries: 3
		});
	});

	it('lexically prunes excluded live junctions before authorization with virtual and replay parity', () => {
		const root = temporaryRoot();
		const outside = temporaryRoot('csaa-compiler-excluded-junction-');
		write(root, 'node_modules/pkg/keep/x.d.ts', 'export {};\n');
		write(outside, 'y.d.ts', 'export declare const escaped: true;\n');
		symlinkSync(
			outside,
			join(root, 'node_modules/pkg/skip'),
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		const frozen = subject({
			'types/keep/x.d.ts': 'export {};\n',
			'types/skip/y.d.ts': 'export {};\n'
		});
		const capture = session(root, frozen);
		for (const excludes of [['skip/**'], ['skip/']] as const) {
			const parameters = {
				depth: null,
				excludes: [...excludes],
				extensions: ['.d.ts'],
				includes: ['**/*'],
				operation: 'READ_DIRECTORY' as const
			};
			const virtualQuery = { ...parameters, logicalPath: 'types' };
			const liveQuery = { ...parameters, logicalPath: 'node_modules/pkg' };
			const virtual = capture.reader.observe(virtualQuery).observation;
			const live = capture.reader.observe(liveQuery).observation;
			expect(virtual).toMatchObject({ resultEntries: ['types/keep/x.d.ts'], scannedEntries: 3 });
			expect(live).toMatchObject({
				resultEntries: ['node_modules/pkg/keep/x.d.ts'],
				scannedEntries: 3
			});
			capture.capture(virtualQuery);
			capture.capture(liveQuery);
		}
		expectCode(
			() =>
				capture.reader.observe({
					depth: null,
					excludes: [],
					extensions: ['.d.ts'],
					includes: ['**/*'],
					logicalPath: 'node_modules/pkg',
					operation: 'READ_DIRECTORY'
				}),
			CompilerPathError,
			'PATH_ESCAPE'
		);
		const finalized = capture.finalize();
		const verified = recheckCompilerInputJournal(finalized);
		const replay = replayJournal(frozen, verified, capture.recipe, capture.materialized);
		for (const entry of finalized.entries) replay.replay(entry.query, PROJECT_KEY);
		replay.assertFullyConsumed();
	});

	it('charges cumulative parameter count and UTF-8 bytes before regex or filesystem work', () => {
		const root = temporaryRoot();
		const tinyCount = session(root, subject({}), true, { ...BUDGETS, maxDirectoryEntries: 2 });
		expectCode(
			() =>
				tinyCount.capture({
					depth: null,
					excludes: ['a'],
					extensions: ['.d.ts'],
					includes: ['b'],
					logicalPath: 'coverage/junction',
					operation: 'READ_DIRECTORY'
				}),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);

		const getterCount = { value: 0 };
		const manyLong = Array.from(
			{ length: 50 },
			(_, index) => `${index.toString().padStart(2, '0')}-${'x'.repeat(100)}`
		);
		Object.defineProperty(manyLong, '49', {
			enumerable: true,
			get() {
				getterCount.value += 1;
				return 'zz';
			}
		});
		const tinyBytes = session(root, subject({}), true, {
			...BUDGETS,
			maxCompilerInputMetadataBytes: 300,
			maxPathCharacters: 1024
		});
		expectCode(
			() =>
				tinyBytes.capture({
					depth: null,
					excludes: manyLong,
					extensions: [],
					includes: [],
					logicalPath: '.',
					operation: 'READ_DIRECTORY'
				}),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);
		expect(getterCount.value).toBe(0);
	});
});

describe('sealed capture, freshness, and replay', () => {
	const replaceFinalAttribution = (
		capture: ReturnType<typeof session>,
		mutate: (
			attribution: FrozenCompilerCapture['projectAttributions'][number]
		) => FrozenCompilerCapture['projectAttributions'][number]
	): void => {
		const attribution = capture.journal.currentProjectEvidence(PROJECT_KEY).attribution;
		(
			capture.journal as unknown as {
				attributions: { entries: () => FrozenCompilerCapture['projectAttributions'] };
			}
		).attributions = { entries: () => [mutate(attribution)] };
	};

	it('finalizes atomically with reconciled final context IDs and blocks every post-finalize drift', () => {
		const root = temporaryRoot();
		const frozen = subject({ 'src/index.ts': 'export {};\n' });
		const capture = session(root, frozen);
		capture.capture({ logicalPath: 'src/index.ts', operation: 'READ_FILE' });
		capture.capture({ logicalPath: 'src/index.ts', operation: 'READ_FILE' });
		const finalized = capture.finalize();
		expect(finalized.entries).toHaveLength(1);
		expect(finalized.entries[0]!.observation.invocationCount).toBe(2);
		expect(finalized.projectAttributions).toEqual([
			expect.objectContaining({
				contextInputIds: [finalized.entries[0]!.observation.id],
				materializedRecipeDigest: sha256(canonicalSemanticJson(capture.materialized)),
				projectResolutionDigest: capture.recipe.projectResolutionDigest
			})
		]);
		expectCode(
			() => capture.capture({ logicalPath: 'missing.ts', operation: 'FILE_EXISTS' }),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);
		expectCode(() => capture.finalize(), CompilerInputCaptureError, 'INVALID_CAPTURE');
	});

	it('requires unforgeable finalized and verified capabilities and never executes hostile traps', () => {
		const root = temporaryRoot();
		const frozen = subject({ 'src/index.ts': 'export {};\n' });
		const capture = session(root, frozen);
		capture.capture({ logicalPath: 'src/index.ts', operation: 'READ_FILE' });
		const finalized = capture.finalize();
		const traps = { value: 0 };
		const outer = hostileProxy({ ...finalized }, traps);
		expectCode(
			() => recheckCompilerInputJournal(outer as FrozenCompilerCapture),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);
		const hostileEntries = hostileProxy([...finalized.entries], traps);
		const hostileEntry = hostileProxy({ ...finalized.entries[0]! }, traps);
		const hostileBytes = hostileProxy(new Uint8Array([1]), traps);
		for (const lookalike of [
			{ ...finalized, entries: hostileEntries },
			{ ...finalized, entries: [hostileEntry] },
			{ ...finalized, entries: [{ ...finalized.entries[0]!, bytes: hostileBytes }] }
		])
			expectCode(
				() => recheckCompilerInputJournal(lookalike as FrozenCompilerCapture),
				CompilerInputCaptureError,
				'INVALID_CAPTURE'
			);
		expect(traps.value).toBe(0);

		const verified = recheckCompilerInputJournal(finalized);
		const verifiedProxy = hostileProxy(verified, traps);
		expectCode(
			() => new ReplayCompilerInputJournal(frozen, verifiedProxy),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);
		expectCode(
			() => new ReplayCompilerInputJournal(frozen, { ...verified } as VerifiedCompilerCapture),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);
		expect(traps.value).toBe(0);
	});

	it.each([
		[
			'closure observations',
			(capture: ReturnType<typeof session>) => {
				(
					capture.journal as unknown as {
						observations: () => FrozenCompilerCapture['observations'];
					}
				).observations = () => [];
			}
		],
		[
			'project identity',
			(capture: ReturnType<typeof session>) =>
				replaceFinalAttribution(capture, (attribution) => ({
					...attribution,
					materializedRecipeDigest: 'not-a-sha256-digest'
				}))
		],
		[
			'project query invocation',
			(capture: ReturnType<typeof session>) =>
				replaceFinalAttribution(capture, (attribution) => ({
					...attribution,
					queryInvocations: [{ ...attribution.queryInvocations[0]!, invocationCount: 0 }]
				}))
		],
		[
			'project context-input identity',
			(capture: ReturnType<typeof session>) =>
				replaceFinalAttribution(capture, (attribution) => ({
					...attribution,
					contextInputIds: []
				}))
		],
		[
			'global query multiplicity',
			(capture: ReturnType<typeof session>) =>
				replaceFinalAttribution(capture, (attribution) => ({
					...attribution,
					queryInvocations: [{ ...attribution.queryInvocations[0]!, invocationCount: 2 }]
				}))
		]
	] as const)('rejects provider-issued finalized state with corrupt %s', (_kind, corrupt) => {
		const root = temporaryRoot();
		const frozen = subject({});
		const capture = session(root, frozen);
		capture.capture({ logicalPath: 'missing.ts', operation: 'FILE_EXISTS' });
		corrupt(capture);

		expectCode(
			() => recheckCompilerInputJournal(capture.finalize()),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);
	});

	it('fails closed when internal operation clocks make recheck or replay deadlines unsafe', () => {
		const root = temporaryRoot();
		const frozen = subject({});
		const unsafeRecheck = session(root, frozen);
		unsafeRecheck.capture({ logicalPath: 'missing.ts', operation: 'FILE_EXISTS' });
		(unsafeRecheck.journal as unknown as { startedAtMs: number }).startedAtMs =
			Number.MAX_SAFE_INTEGER;
		const unsafeFinalized = unsafeRecheck.finalize();
		expectCode(
			() => recheckCompilerInputJournal(unsafeFinalized),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);

		const replayCapture = session(root, frozen);
		replayCapture.capture({ logicalPath: 'missing.ts', operation: 'FILE_EXISTS' });
		const finalized = replayCapture.finalize();
		const intrinsicFreeze = Object.freeze;
		let corruptedBudgetClone = false;
		const freeze = vi.spyOn(Object, 'freeze').mockImplementation((value) => {
			if (
				!corruptedBudgetClone &&
				value !== null &&
				typeof value === 'object' &&
				Object.hasOwn(value, 'maxDurationMs') &&
				Object.hasOwn(value, 'maxCompilerInputMetadataBytes')
			) {
				(value as { maxDurationMs: number }).maxDurationMs = Number.MAX_SAFE_INTEGER;
				corruptedBudgetClone = true;
			}
			return intrinsicFreeze(value);
		});
		const verified = recheckCompilerInputJournal(finalized);
		freeze.mockRestore();
		expect(corruptedBudgetClone).toBe(true);
		expectCode(
			() => new ReplayCompilerInputJournal(frozen, verified),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);
	});

	it('poisons replay when its internal invocation counter exceeds the captured budget', () => {
		const root = temporaryRoot();
		const frozen = subject({});
		const query = { logicalPath: 'missing.ts', operation: 'FILE_EXISTS' as const };
		const capture = session(root, frozen);
		capture.capture(query);
		const verified = recheckCompilerInputJournal(capture.finalize());
		const replay = replayJournal(frozen, verified, capture.recipe, capture.materialized);
		(replay as unknown as { replayCalls: number }).replayCalls =
			replay.semanticBudgets.maxCompilerQueryInvocations;

		expectCode(
			() => replay.replay(query, PROJECT_KEY),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);
		expectCode(() => replay.assertFullyConsumed(), CompilerInputCaptureError, 'INVALID_CAPTURE');
	});

	it('rejects Proxy budgets and query arrays before reflection with zero trap execution', () => {
		const traps = { value: 0 };
		expectCode(
			() => normalizeSemanticBudgets(hostileProxy({ ...BUDGETS }, traps)),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);
		expect(traps.value).toBe(0);
		const root = temporaryRoot();
		const frozen = subject({});
		const hostileQueryCapture = session(root, frozen);
		expectCode(
			() =>
				hostileQueryCapture.capture(
					hostileProxy({ logicalPath: '.', operation: 'FILE_EXISTS' }, traps) as CompilerInputQuery
				),
			CompilerInputCaptureError,
			'INVALID_QUERY'
		);
		expectCode(() => hostileQueryCapture.finalize(), CompilerInputCaptureError, 'INVALID_CAPTURE');
		const hostileArrayCapture = session(root, frozen);
		const extensions = hostileProxy(['.d.ts'], traps);
		expectCode(
			() =>
				hostileArrayCapture.capture({
					depth: null,
					excludes: [],
					extensions,
					includes: [],
					logicalPath: '.',
					operation: 'READ_DIRECTORY'
				}),
			CompilerInputCaptureError,
			'INVALID_QUERY'
		);
		expect(traps.value).toBe(0);
	});

	it('omits byte views from public capabilities while retaining exact hidden bytes for recheck and replay', () => {
		const root = temporaryRoot();
		const frozen = subject({ 'src/index.ts': 'export const frozen = true;\n' });
		const capture = session(root, frozen);
		const direct = capture.capture({ logicalPath: 'src/index.ts', operation: 'READ_FILE' });
		direct.bytes![0] = 0;
		const finalized = capture.finalize();
		expect('bytes' in finalized.entries[0]!).toBe(false);
		const verified = recheckCompilerInputJournal(finalized);
		expect('bytes' in verified.entries[0]!).toBe(false);
		const replay = replayJournal(frozen, verified, capture.recipe, capture.materialized);
		const replayed = replay.replay(finalized.entries[0]!.query, PROJECT_KEY);
		expect(new TextDecoder().decode(replayed.bytes)).toBe('export const frozen = true;\n');
		replay.assertFullyConsumed();
		attachFrozenSubjectBytes(
			frozen,
			new Map([['src/index.ts', new TextEncoder().encode('forged')]])
		);
		expectCode(
			() => recheckCompilerInputJournal(finalized),
			CompilerInputCaptureError,
			'FROZEN_BYTES_UNAVAILABLE'
		);
	});

	it('rechecks and replays exact multiplicity without accepting raw entries', () => {
		const root = temporaryRoot();
		const frozen = subject({});
		const capture = session(root, frozen);
		for (let index = 0; index < 3; index += 1)
			capture.capture({ logicalPath: 'missing.ts', operation: 'FILE_EXISTS' });
		const finalized = capture.finalize();
		const verified = recheckCompilerInputJournal(finalized);
		const replay = replayJournal(frozen, verified, capture.recipe, capture.materialized);
		expectCode(() => replay.assertFullyConsumed(), CompilerInputCaptureError, 'UNCONSUMED_QUERY');
		expectCode(
			() => replay.replay(finalized.entries[0]!.query, PROJECT_KEY),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);

		const overflowReplay = replayJournal(frozen, verified, capture.recipe, capture.materialized);
		for (let index = 0; index < 3; index += 1)
			overflowReplay.replay(finalized.entries[0]!.query, PROJECT_KEY);
		expectCode(
			() => overflowReplay.replay(finalized.entries[0]!.query, PROJECT_KEY),
			CompilerInputCaptureError,
			'UNRECORDED_QUERY'
		);
		expectCode(
			() => overflowReplay.assertFullyConsumed(),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);

		const successfulReplay = replayJournal(frozen, verified, capture.recipe, capture.materialized);
		for (let index = 0; index < 3; index += 1)
			successfulReplay.replay(finalized.entries[0]!.query, PROJECT_KEY);
		successfulReplay.assertFullyConsumed();
		expectCode(
			() => successfulReplay.replay(finalized.entries[0]!.query, PROJECT_KEY),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);
	});

	it('enforces exact UTF-8 metadata bytes and carries the original operation clock through replay', () => {
		const root = temporaryRoot();
		const frozen = subject({ 'src/é.ts': 'export const unicode = true;\n' });
		const baseline = session(root, frozen);
		baseline.capture({ logicalPath: 'src/é.ts', operation: 'READ_FILE' });
		const baselineCapture = baseline.finalize();
		const exactBytes = Buffer.byteLength(
			canonicalSemanticJson(baselineCapture.observations),
			'utf8'
		);
		const exact = session(root, frozen, true, {
			...BUDGETS,
			maxCompilerInputMetadataBytes: exactBytes
		});
		exact.capture({ logicalPath: 'src/é.ts', operation: 'READ_FILE' });
		expect(() => exact.finalize()).not.toThrow();
		const tooSmall = session(root, frozen, true, {
			...BUDGETS,
			maxCompilerInputMetadataBytes: exactBytes - 1
		});
		expectCode(
			() => tooSmall.capture({ logicalPath: 'src/é.ts', operation: 'READ_FILE' }),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);

		vi.useFakeTimers();
		vi.setSystemTime(new Date(10_000));
		const timed = session(root, frozen, true, { ...BUDGETS, maxDurationMs: 100 }, 10_000);
		timed.capture({ logicalPath: 'src/é.ts', operation: 'READ_FILE' });
		const timedFinal = timed.finalize();
		const timedVerified = recheckCompilerInputJournal(timedFinal);
		vi.setSystemTime(new Date(10_101));
		expectCode(
			() => new ReplayCompilerInputJournal(frozen, timedVerified),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);
	});

	it('binds project attribution to the authoritative config path and enforces the original deadline at every terminal seam', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(20_000));
		const root = temporaryRoot();
		const frozen = subject({});
		const paths = new FrozenCompilerPathResolver(frozen, root, true);
		const reader = new LiveCompilerInputReader(frozen, paths, true);
		const binding = projectBinding(root);
		const relabel = new CompilerInputJournal(reader, BUDGETS, 20_000);
		expectCode(
			() => relabel.registerProject('other/tsconfig.json', binding.recipe, binding.materialized),
			CompilerInputCaptureError,
			'INVALID_QUERY'
		);

		const expiredFinalize = session(root, frozen, true, { ...BUDGETS, maxDurationMs: 100 }, 20_000);
		vi.setSystemTime(new Date(20_101));
		expectCode(() => expiredFinalize.finalize(), CompilerInputCaptureError, 'BUDGET_EXCEEDED');

		vi.setSystemTime(new Date(30_000));
		const expiredRecheck = session(root, frozen, true, { ...BUDGETS, maxDurationMs: 100 }, 30_000);
		const finalized = expiredRecheck.finalize();
		vi.setSystemTime(new Date(30_101));
		expectCode(
			() => recheckCompilerInputJournal(finalized),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);

		vi.setSystemTime(new Date(40_000));
		const replayCapture = session(root, frozen, true, { ...BUDGETS, maxDurationMs: 100 }, 40_000);
		replayCapture.capture({ logicalPath: 'missing.ts', operation: 'FILE_EXISTS' });
		const replayFinalized = replayCapture.finalize();
		const replayVerified = recheckCompilerInputJournal(replayFinalized);
		const replay = replayJournal(
			frozen,
			replayVerified,
			replayCapture.recipe,
			replayCapture.materialized
		);
		replay.replay(replayFinalized.entries[0]!.query, PROJECT_KEY);
		vi.setSystemTime(new Date(40_101));
		expectCode(() => replay.assertFullyConsumed(), CompilerInputCaptureError, 'BUDGET_EXCEEDED');

		vi.setSystemTime(new Date(50_000));
		const zeroCapture = session(root, frozen, true, { ...BUDGETS, maxDurationMs: 100 }, 50_000);
		const zeroVerified = recheckCompilerInputJournal(zeroCapture.finalize());
		const zeroReplay = replayJournal(
			frozen,
			zeroVerified,
			zeroCapture.recipe,
			zeroCapture.materialized
		);
		vi.setSystemTime(new Date(50_101));
		expectCode(
			() => zeroReplay.assertFullyConsumed(),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);

		vi.setSystemTime(new Date(60_000));
		const registerCapture = session(root, frozen, true, { ...BUDGETS, maxDurationMs: 100 }, 60_000);
		const registerVerified = recheckCompilerInputJournal(registerCapture.finalize());
		const expiredRegister = new ReplayCompilerInputJournal(frozen, registerVerified);
		vi.setSystemTime(new Date(60_101));
		expectCode(
			() =>
				expiredRegister.registerProject(
					PROJECT_KEY,
					registerCapture.recipe,
					registerCapture.materialized
				),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);
	});

	it('poisons capture when the deadline crosses during terminal byte cloning', () => {
		vi.useFakeTimers();
		const start = 65_000;
		vi.setSystemTime(new Date(start));
		const root = temporaryRoot();
		const frozen = subject({ 'src/index.ts': 'export const terminalClone = true;\n' });
		const timed = session(root, frozen, true, { ...BUDGETS, maxDurationMs: 100 }, start);
		const originalSlice = Uint8Array.prototype.slice;
		let sliceCalls = 0;
		const slice = vi.spyOn(Uint8Array.prototype, 'slice').mockImplementation(function (
			this: Uint8Array<ArrayBuffer>,
			begin?: number,
			end?: number
		) {
			sliceCalls += 1;
			if (sliceCalls === 3) vi.setSystemTime(new Date(start + 101));
			return originalSlice.call(this, begin, end);
		});

		expectCode(
			() => timed.capture({ logicalPath: 'src/index.ts', operation: 'READ_FILE' }),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);
		expect(sliceCalls).toBeGreaterThanOrEqual(3);
		slice.mockRestore();
		expectCode(
			() => timed.capture({ logicalPath: 'src/index.ts', operation: 'FILE_EXISTS' }),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);
		expectCode(() => timed.finalize(), CompilerInputCaptureError, 'INVALID_CAPTURE');
	});

	it('rechecks the original deadline after constructing each terminal capture or replay result', () => {
		const root = temporaryRoot();
		const frozen = subject({});
		const paths = new FrozenCompilerPathResolver(frozen, root, true);
		const reader = new LiveCompilerInputReader(frozen, paths, true);
		const start = 70_000;
		const budgets = { ...BUDGETS, maxDurationMs: 100 };
		let calls = 0;
		const now = vi.spyOn(Date, 'now').mockImplementation(() => {
			calls += 1;
			return start;
		});

		new CompilerInputJournal(reader, budgets, start).finalizeCapture();
		const finalizeCalls = calls;
		calls = 0;
		now.mockImplementation(() => {
			calls += 1;
			return calls === finalizeCalls ? start + 101 : start;
		});
		expectCode(
			() => new CompilerInputJournal(reader, budgets, start).finalizeCapture(),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);

		now.mockImplementation(() => start);
		const finalized = new CompilerInputJournal(reader, budgets, start).finalizeCapture();
		calls = 0;
		now.mockImplementation(() => {
			calls += 1;
			return start;
		});
		const verified = recheckCompilerInputJournal(finalized);
		const recheckCalls = calls;
		calls = 0;
		now.mockImplementation(() => {
			calls += 1;
			return calls === recheckCalls ? start + 101 : start;
		});
		expectCode(
			() => recheckCompilerInputJournal(finalized),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);

		calls = 0;
		now.mockImplementation(() => {
			calls += 1;
			return start;
		});
		new ReplayCompilerInputJournal(frozen, verified);
		const constructorCalls = calls;
		calls = 0;
		now.mockImplementation(() => {
			calls += 1;
			return calls === constructorCalls ? start + 101 : start;
		});
		expectCode(
			() => new ReplayCompilerInputJournal(frozen, verified),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);

		now.mockImplementation(() => start);
		const baselineReplay = new ReplayCompilerInputJournal(frozen, verified);
		calls = 0;
		now.mockImplementation(() => {
			calls += 1;
			return start;
		});
		baselineReplay.assertFullyConsumed();
		const assertionCalls = calls;
		now.mockImplementation(() => start);
		const expiringReplay = new ReplayCompilerInputJournal(frozen, verified);
		calls = 0;
		now.mockImplementation(() => {
			calls += 1;
			return calls === assertionCalls ? start + 101 : start;
		});
		expectCode(
			() => expiringReplay.assertFullyConsumed(),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);
		expectCode(
			() => expiringReplay.assertFullyConsumed(),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);
	});

	it('rejects future operation starts instead of extending the duration budget', () => {
		const root = temporaryRoot();
		const frozen = subject({});
		const paths = new FrozenCompilerPathResolver(frozen, root, true);
		const reader = new LiveCompilerInputReader(frozen, paths, true);
		expectCode(
			() => new CompilerInputJournal(reader, BUDGETS, Date.now() + 60_000),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);
	});
});

describe('compiler-input defensive closure', () => {
	it('rejects non-inert budgets and non-canonical query parameter sets with stable codes', () => {
		const accessorBudgets = { ...BUDGETS };
		Object.defineProperty(accessorBudgets, 'maxSources', { enumerable: true, get: () => 1 });
		const symbolBudgets = { ...BUDGETS, [Symbol('extra')]: 1 };
		const inheritedBudgets = Object.assign(Object.create({ inherited: true }), BUDGETS);
		for (const invalid of [
			accessorBudgets,
			symbolBudgets,
			inheritedBudgets,
			{ ...BUDGETS, maxSources: 0 },
			{ ...BUDGETS, maxSources: Number.NaN },
			{ ...BUDGETS, unexpected: 1 }
		])
			expectCode(
				() => normalizeSemanticBudgets(invalid),
				CompilerInputCaptureError,
				'BUDGET_EXCEEDED'
			);

		const root = temporaryRoot();
		const query = (
			overrides: Partial<Extract<CompilerInputQuery, { operation: 'READ_DIRECTORY' }>>
		) => ({
			depth: null,
			excludes: [],
			extensions: ['.d.ts'],
			includes: ['**/*'],
			logicalPath: '.',
			operation: 'READ_DIRECTORY' as const,
			...overrides
		});
		for (const invalid of [
			query({ excludes: ['z', 'a'] }),
			query({ includes: ['same', 'same'] }),
			query({ depth: -1 }),
			query({ depth: Number.NaN }),
			{ logicalPath: '.', operation: 'NOT_REGISTERED' },
			{ extra: true, logicalPath: '.', operation: 'FILE_EXISTS' },
			{ logicalPath: 1, operation: 'FILE_EXISTS' }
		])
			expectCode(
				() => session(root, subject({})).capture(invalid as CompilerInputQuery),
				CompilerInputCaptureError,
				'INVALID_QUERY'
			);
	});

	it('covers boundary, virtual-directory, live-realpath, and fail-closed reader outcomes', () => {
		const root = temporaryRoot();
		mkdirSync(join(root, 'node_modules/pkg/subdir'), { recursive: true });
		write(root, 'node_modules/pkg/index.d.ts', 'export declare const live: true;\n');
		const generated = 'export declare const generated: true;\n';
		write(root, 'generated/context.d.ts', generated);
		const frozen = subject(
			{
				'types/root.d.ts': 'export {};\n',
				'types/sub/child.d.ts': 'export {};\n'
			},
			{
				generatedContexts: [
					{ path: 'generated/context.d.ts', selectedInput: false, sha256: sha256(generated) }
				] as unknown as FrozenSubject['generatedContexts']
			}
		);
		const { paths, reader } = session(root, frozen);

		expect(
			reader.observe({ logicalPath: 'coverage/hidden', operation: 'DIRECTORY_EXISTS' }).observation
		).toMatchObject({ result: 'NOT_DIRECTORY' });
		expect(
			reader.observe({ logicalPath: 'coverage/hidden', operation: 'GET_DIRECTORIES' }).observation
		).toMatchObject({ result: 'NOT_DIRECTORY', resultEntries: [], scannedEntries: 0 });
		expect(
			reader.observe({
				depth: null,
				excludes: [],
				extensions: ['.ts'],
				includes: ['**/*'],
				logicalPath: 'coverage/hidden',
				operation: 'READ_DIRECTORY'
			}).observation
		).toMatchObject({ result: 'NOT_DIRECTORY', resultEntries: [], scannedEntries: 0 });
		expect(
			reader.observe({ logicalPath: 'types', operation: 'GET_DIRECTORIES' }).observation
		).toMatchObject({ result: 'DIRECTORY', resultEntries: ['types/sub'] });
		expect(
			reader.observe({ logicalPath: 'node_modules/pkg', operation: 'REALPATH' }).observation
		).toMatchObject({ result: 'ABSENT' });
		expect(
			reader.observe({ logicalPath: 'generated/context.d.ts', operation: 'REALPATH' }).observation
		).toMatchObject({ result: 'RESOLVED', resolvedLogicalPath: 'generated/context.d.ts' });
		expect(
			reader.observe({ logicalPath: 'node_modules/pkg/missing.d.ts', operation: 'REALPATH' })
				.observation
		).toMatchObject({ result: 'ABSENT' });

		const origin = vi.spyOn(paths, 'origin').mockImplementation(() => {
			throw new Error('ambient path failure');
		});
		expectCode(
			() => reader.observe({ logicalPath: 'missing.ts', operation: 'FILE_EXISTS' }),
			CompilerInputCaptureError,
			'CONTEXT_UNAVAILABLE'
		);
		origin.mockRestore();
		const canonical = vi.spyOn(paths, 'canonicalRecordedLogical').mockImplementation(() => {
			throw new Error('canonicalization failure');
		});
		expectCode(
			() => reader.observe({ logicalPath: 'missing.ts', operation: 'FILE_EXISTS' }),
			CompilerInputCaptureError,
			'INVALID_QUERY'
		);
		canonical.mockRestore();
	});

	it('fails closed on malformed recipe bindings and poisons project-consumption failures', () => {
		const root = temporaryRoot();
		const frozen = subject({});
		const paths = new FrozenCompilerPathResolver(frozen, root, true);
		const reader = new LiveCompilerInputReader(frozen, paths, true);
		const binding = projectBinding(root);
		const invalidRecipe = {
			...binding.recipe,
			projectResolutionDigest: 'not-a-digest'
		} as ProgramRecipe;
		expectCode(
			() =>
				new CompilerInputJournal(reader, BUDGETS, Date.now()).registerProject(
					PROJECT_KEY,
					invalidRecipe,
					binding.materialized
				),
			CompilerInputCaptureError,
			'INVALID_QUERY'
		);
		expectCode(
			() =>
				new CompilerInputJournal(reader, BUDGETS, Date.now()).registerProject(
					PROJECT_KEY,
					binding.recipe,
					{ ...binding.materialized, rootNames: ['elsewhere.ts'] }
				),
			CompilerInputCaptureError,
			'INVALID_QUERY'
		);

		const captured = session(root, frozen);
		captured.capture({ logicalPath: 'missing.ts', operation: 'FILE_EXISTS' });
		const finalized = captured.finalize();
		const verified = recheckCompilerInputJournal(finalized);
		const replay = replayJournal(frozen, verified, captured.recipe, captured.materialized);
		expect(replay.maxProjects).toBe(BUDGETS.maxProjects);
		expect(replay.semanticBudgets).toEqual(BUDGETS);
		expect(replay.repositoryRoot).toBe(paths.repositoryRoot);
		expect(replay.toRecordedAbsolute('.')).toBe(paths.repositoryRoot);
		expect(replay.toRecordedLogical(paths.repositoryRoot)).toBe('.');
		expect(replay.workspaceAliasRoots()).toEqual([]);
		replay.assertWithinDeadline();
		expectCode(
			() => replay.assertProjectConsumed(PROJECT_KEY),
			CompilerInputCaptureError,
			'UNCONSUMED_QUERY'
		);
		expectCode(
			() => replay.replay(finalized.entries[0]!.query, PROJECT_KEY),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);
	});

	it('reports the complete public operation matrix for boundary, frozen, live, and root identities', () => {
		const parent = temporaryRoot();
		const root = join(parent, 'repo');
		mkdirSync(join(root, 'node_modules/pkg/as-directory.d.ts'), { recursive: true });
		write(root, 'node_modules/pkg/index.d.ts', 'export declare const live: true;\n');
		const frozen = subject({
			'src/index.ts': 'export const frozen = true;\n',
			'types/nested/value.d.ts': 'export declare const nested: true;\n'
		});
		const paths = new FrozenCompilerPathResolver(frozen, root, false);
		const reader = new LiveCompilerInputReader(frozen, paths, false);
		const boundary = '@boundary/ancestor-1/node_modules/pkg/index.d.ts';
		const boundaryCases: readonly [CompilerInputQuery, Readonly<Record<string, unknown>>][] = [
			[{ logicalPath: boundary, operation: 'READ_FILE' }, { result: 'ABSENT' }],
			[{ logicalPath: boundary, operation: 'FILE_EXISTS' }, { result: 'ABSENT' }],
			[{ logicalPath: boundary, operation: 'DIRECTORY_EXISTS' }, { result: 'NOT_DIRECTORY' }],
			[
				{ logicalPath: boundary, operation: 'GET_DIRECTORIES' },
				{ result: 'NOT_DIRECTORY', resultEntries: [], scannedEntries: 0 }
			],
			[
				{
					depth: null,
					excludes: [],
					extensions: ['.d.ts'],
					includes: ['**/*'],
					logicalPath: boundary,
					operation: 'READ_DIRECTORY'
				},
				{ result: 'NOT_DIRECTORY', resultEntries: [], scannedEntries: 0 }
			],
			[{ logicalPath: boundary, operation: 'REALPATH' }, { result: 'ABSENT' }]
		];
		for (const [query, expected] of boundaryCases)
			expect(reader.observe(query).observation).toMatchObject(expected);

		const frozenRead = reader.observe({ logicalPath: 'src/index.ts', operation: 'READ_FILE' });
		expect(frozenRead.observation).toMatchObject({
			byteBudgetClass: 'FROZEN_SUBJECT',
			origin: 'AUTHORED',
			result: 'PRESENT'
		});
		expect(new TextDecoder().decode(frozenRead.bytes)).toBe('export const frozen = true;\n');
		expect(
			reader.observe({ logicalPath: 'src/index.ts', operation: 'FILE_EXISTS' }).observation
		).toMatchObject({ result: 'PRESENT' });
		expect(
			reader.observe({ logicalPath: 'types', operation: 'DIRECTORY_EXISTS' }).observation
		).toMatchObject({ result: 'DIRECTORY' });
		expect(
			reader.observe({ logicalPath: 'node_modules/pkg/index.d.ts', operation: 'READ_FILE' })
				.observation
		).toMatchObject({ byteBudgetClass: 'LIVE_COMPILER_CONTEXT', result: 'PRESENT' });
		expect(
			reader.observe({ logicalPath: 'node_modules/pkg/index.d.ts', operation: 'FILE_EXISTS' })
				.observation
		).toMatchObject({ result: 'PRESENT' });
		expect(
			reader.observe({ logicalPath: 'node_modules/pkg/as-directory.d.ts', operation: 'READ_FILE' })
				.observation
		).toMatchObject({ result: 'ABSENT' });
		expect(
			reader.observe({ logicalPath: 'node_modules/pkg/index.d.ts', operation: 'REALPATH' })
				.observation
		).toMatchObject({ resolvedLogicalPath: 'node_modules/pkg/index.d.ts', result: 'RESOLVED' });
		expect(
			reader.observe({ logicalPath: '.', operation: 'CURRENT_DIRECTORY' }).observation
		).toMatchObject({
			logicalPath: '.',
			origin: 'CONFIGURATION',
			resolvedLogicalPath: '.',
			result: 'RESOLVED'
		});
		expect(
			reader.observe({ logicalPath: '.', operation: 'USE_CASE_SENSITIVE_FILE_NAMES' }).observation
		).toMatchObject({ logicalPath: '.', origin: 'CONFIGURATION', result: 'CASE_INSENSITIVE' });
	});

	it('rejects active, sparse, malformed, and over-budget nested query arrays before observation', () => {
		const root = temporaryRoot();
		const frozen = subject({});
		const query = (extensions: readonly string[]): CompilerInputQuery => ({
			depth: null,
			excludes: [],
			extensions,
			includes: [],
			logicalPath: '.',
			operation: 'READ_DIRECTORY'
		});
		const wrongPrototype = ['.d.ts'];
		Object.setPrototypeOf(wrongPrototype, null);
		const sparse = new Array<string>(1);
		const expando = ['.d.ts'];
		Object.defineProperty(expando, 'extra', { enumerable: true, value: true });
		const symbolic = ['.d.ts'];
		Object.defineProperty(symbolic, Symbol('extra'), { enumerable: true, value: true });
		const accessor = ['.d.ts'];
		Object.defineProperty(accessor, '0', { enumerable: true, get: () => '.d.ts' });
		for (const extensions of [
			wrongPrototype,
			sparse,
			expando,
			symbolic,
			accessor,
			[1] as unknown as string[]
		]) {
			expectCode(
				() => session(root, frozen).capture(query(extensions)),
				CompilerInputCaptureError,
				'INVALID_QUERY'
			);
		}
		expectCode(
			() =>
				session(root, frozen, true, { ...BUDGETS, maxPathCharacters: PROJECT_KEY.length }).capture(
					query([`/${'x'.repeat(PROJECT_KEY.length)}`])
				),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);
		expectCode(
			() =>
				session(root, frozen).capture({
					logicalPath: 'src' as '.',
					operation: 'CURRENT_DIRECTORY'
				}),
			CompilerInputCaptureError,
			'INVALID_QUERY'
		);
		const longPath = 'x'.repeat(PROJECT_KEY.length + 1);
		expectCode(
			() =>
				session(root, frozen, true, { ...BUDGETS, maxPathCharacters: PROJECT_KEY.length }).capture({
					logicalPath: longPath,
					operation: 'FILE_EXISTS'
				}),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);
		const currentDirectory = { logicalPath: '.' as const, operation: 'CURRENT_DIRECTORY' as const };
		const currentDirectoryBytes = Buffer.byteLength(
			canonicalSemanticJson(currentDirectory),
			'utf8'
		);
		expectCode(
			() =>
				session(root, frozen, true, {
					...BUDGETS,
					maxCompilerInputMetadataBytes: currentDirectoryBytes - 1
				}).capture(currentDirectory),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);
		const emptyReadDirectory = query([]);
		const emptyReadDirectoryBytes = Buffer.byteLength(
			canonicalSemanticJson(emptyReadDirectory),
			'utf8'
		);
		expectCode(
			() =>
				session(root, frozen, true, {
					...BUDGETS,
					maxCompilerInputMetadataBytes: emptyReadDirectoryBytes - 1
				}).capture(emptyReadDirectory),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);
	});

	it('enforces capture project registration and exposes only reconciled current-project evidence', () => {
		const root = temporaryRoot();
		const frozen = subject({ 'src/index.ts': 'export const captured = true;\n' });
		const paths = new FrozenCompilerPathResolver(frozen, root, true);
		const reader = new LiveCompilerInputReader(frozen, paths, true);
		const binding = projectBinding(root);
		const unregistered = new CompilerInputJournal(reader, BUDGETS, Date.now());
		expectCode(
			() => unregistered.currentProjectEvidence(PROJECT_KEY),
			CompilerInputCaptureError,
			'INVALID_QUERY'
		);
		expectCode(
			() =>
				unregistered.capture({ logicalPath: 'missing.ts', operation: 'FILE_EXISTS' }, PROJECT_KEY),
			CompilerInputCaptureError,
			'INVALID_QUERY'
		);
		expectCode(() => unregistered.finalizeCapture(), CompilerInputCaptureError, 'INVALID_CAPTURE');

		const duplicate = new CompilerInputJournal(reader, BUDGETS, Date.now());
		duplicate.registerProject(PROJECT_KEY, binding.recipe, binding.materialized);
		expectCode(
			() => duplicate.registerProject(PROJECT_KEY, binding.recipe, binding.materialized),
			CompilerInputCaptureError,
			'INVALID_QUERY'
		);

		const projectLimited = new CompilerInputJournal(
			reader,
			{ ...BUDGETS, maxProjects: 1 },
			Date.now()
		);
		projectLimited.registerProject(PROJECT_KEY, binding.recipe, binding.materialized);
		const other = projectBinding(root, 'other/tsconfig.json');
		expectCode(
			() => projectLimited.registerProject('other/tsconfig.json', other.recipe, other.materialized),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);
		expectCode(
			() =>
				new CompilerInputJournal(reader, BUDGETS, Date.now()).registerProject(
					'',
					binding.recipe,
					binding.materialized
				),
			CompilerInputCaptureError,
			'INVALID_QUERY'
		);
		expectCode(
			() =>
				new CompilerInputJournal(reader, BUDGETS, Date.now()).registerProject(
					'x'.repeat(BUDGETS.maxPathCharacters + 1),
					binding.recipe,
					binding.materialized
				),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);

		const capture = session(root, frozen);
		capture.journal.assertWithinDeadline();
		capture.capture({ logicalPath: 'src/index.ts', operation: 'READ_FILE' });
		capture.capture({ logicalPath: 'missing.ts', operation: 'FILE_EXISTS' });
		const evidence = capture.journal.currentProjectEvidence(PROJECT_KEY);
		expect(evidence.attribution).toMatchObject({
			projectKey: PROJECT_KEY,
			queryInvocations: [
				expect.objectContaining({ invocationCount: 1 }),
				expect.objectContaining({ invocationCount: 1 })
			]
		});
		expect(evidence.observations.map((observation) => observation.id).sort()).toEqual(
			[...evidence.attribution.contextInputIds].sort()
		);
		capture.finalize();
		expectCode(
			() => capture.journal.currentProjectEvidence(PROJECT_KEY),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);
		expectCode(
			() => capture.journal.registerProject(PROJECT_KEY, binding.recipe, binding.materialized),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);

		const poisoned = session(root, frozen);
		poisoned.journal.poison();
		expectCode(
			() => poisoned.capture({ logicalPath: 'missing.ts', operation: 'FILE_EXISTS' }),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);
	});

	it('enforces live-context and query budgets and detects ordinary live declaration drift at recheck', () => {
		const root = temporaryRoot();
		write(root, 'node_modules/pkg/a.d.ts', 'export declare const a: true;\n');
		write(root, 'node_modules/pkg/b.d.ts', 'export declare const b: true;\n');
		const frozen = subject({});
		const fileLimited = session(root, frozen, true, { ...BUDGETS, maxContextFiles: 1 });
		expect(
			fileLimited.capture({ logicalPath: 'node_modules/pkg/a.d.ts', operation: 'READ_FILE' })
				.observation
		).toMatchObject({ byteBudgetClass: 'LIVE_COMPILER_CONTEXT', result: 'PRESENT' });
		expectCode(
			() => fileLimited.capture({ logicalPath: 'node_modules/pkg/b.d.ts', operation: 'READ_FILE' }),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);

		const oversized = session(root, frozen, true, { ...BUDGETS, maxContextFileBytes: 4 });
		expectCode(
			() => oversized.capture({ logicalPath: 'node_modules/pkg/a.d.ts', operation: 'READ_FILE' }),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);
		const invocationLimited = session(root, frozen, true, {
			...BUDGETS,
			maxCompilerQueryInvocations: 1
		});
		invocationLimited.capture({ logicalPath: 'missing.ts', operation: 'FILE_EXISTS' });
		expectCode(
			() => invocationLimited.capture({ logicalPath: 'missing.ts', operation: 'FILE_EXISTS' }),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);
		const distinctLimited = session(root, frozen, true, { ...BUDGETS, maxCompilerQueries: 1 });
		distinctLimited.capture({ logicalPath: 'missing-a.ts', operation: 'FILE_EXISTS' });
		expectCode(
			() => distinctLimited.capture({ logicalPath: 'missing-b.ts', operation: 'FILE_EXISTS' }),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);

		const repeatedQuery = { logicalPath: 'missing-repeat.ts', operation: 'FILE_EXISTS' as const };
		const baseline = session(root, frozen);
		for (let index = 0; index < 9; index += 1) baseline.capture(repeatedQuery);
		const exactMetadataBytes = Buffer.byteLength(
			canonicalSemanticJson(baseline.finalize().observations),
			'utf8'
		);
		const metadataLimited = session(root, frozen, true, {
			...BUDGETS,
			maxCompilerInputMetadataBytes: exactMetadataBytes
		});
		for (let index = 0; index < 9; index += 1) metadataLimited.capture(repeatedQuery);
		expectCode(
			() => metadataLimited.capture(repeatedQuery),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);

		const drift = session(root, frozen);
		drift.capture({ logicalPath: 'node_modules/pkg/a.d.ts', operation: 'READ_FILE' });
		const finalized = drift.finalize();
		write(root, 'node_modules/pkg/a.d.ts', 'export declare const a: null;\n');
		expectCode(
			() => recheckCompilerInputJournal(finalized),
			CompilerInputCaptureError,
			'CONTEXT_CHANGED'
		);
	});

	it('enforces replay registration, unrecorded-query, poisoning, budget, and finalization semantics', () => {
		const root = temporaryRoot();
		const frozen = subject({});
		const captured = session(root, frozen);
		const query = { logicalPath: 'missing.ts', operation: 'FILE_EXISTS' as const };
		captured.capture(query);
		const finalized = captured.finalize();
		const verified = recheckCompilerInputJournal(finalized);

		expectCode(
			() => new ReplayCompilerInputJournal(subject({}), verified),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);
		expectCode(
			() =>
				new ReplayCompilerInputJournal(frozen, verified).registerProject(
					'',
					captured.recipe,
					captured.materialized
				),
			CompilerInputCaptureError,
			'INVALID_QUERY'
		);
		expectCode(
			() =>
				new ReplayCompilerInputJournal(frozen, verified).registerProject(
					'x'.repeat(BUDGETS.maxPathCharacters + 1),
					captured.recipe,
					captured.materialized
				),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);
		expectCode(
			() =>
				new ReplayCompilerInputJournal(frozen, verified).registerProject(
					'other/tsconfig.json',
					captured.recipe,
					captured.materialized
				),
			CompilerInputCaptureError,
			'INVALID_QUERY'
		);
		const other = projectBinding(root, 'other/tsconfig.json');
		expectCode(
			() =>
				new ReplayCompilerInputJournal(frozen, verified).registerProject(
					'other/tsconfig.json',
					other.recipe,
					other.materialized
				),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);

		const duplicate = replayJournal(frozen, verified, captured.recipe, captured.materialized);
		expectCode(
			() => duplicate.registerProject(PROJECT_KEY, captured.recipe, captured.materialized),
			CompilerInputCaptureError,
			'INVALID_QUERY'
		);
		const projectBudgetCapture = session(root, frozen, true, { ...BUDGETS, maxProjects: 1 });
		projectBudgetCapture.capture(query);
		const projectBudgetVerified = recheckCompilerInputJournal(projectBudgetCapture.finalize());
		const projectLimited = replayJournal(
			frozen,
			projectBudgetVerified,
			projectBudgetCapture.recipe,
			projectBudgetCapture.materialized
		);
		expectCode(
			() =>
				projectLimited.registerProject(
					PROJECT_KEY,
					projectBudgetCapture.recipe,
					projectBudgetCapture.materialized
				),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);

		const unknownProject = new ReplayCompilerInputJournal(frozen, verified);
		expectCode(
			() => unknownProject.assertProjectConsumed('unknown/tsconfig.json'),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);
		const unrecorded = replayJournal(frozen, verified, captured.recipe, captured.materialized);
		expectCode(
			() =>
				unrecorded.replay(
					{ logicalPath: 'other-missing.ts', operation: 'FILE_EXISTS' },
					PROJECT_KEY
				),
			CompilerInputCaptureError,
			'UNRECORDED_QUERY'
		);
		expectCode(
			() => unrecorded.replay(query, PROJECT_KEY),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);
		const invalidProject = replayJournal(frozen, verified, captured.recipe, captured.materialized);
		expectCode(() => invalidProject.replay(query, ''), CompilerInputCaptureError, 'INVALID_QUERY');

		const successful = replayJournal(frozen, verified, captured.recipe, captured.materialized);
		successful.replay(query, PROJECT_KEY);
		successful.assertProjectConsumed(PROJECT_KEY);
		successful.assertFullyConsumed();
		expect(() => successful.assertFullyConsumed()).not.toThrow();
		expectCode(
			() => successful.registerProject(PROJECT_KEY, captured.recipe, captured.materialized),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);
		const finalizedProjectCheck = replayJournal(
			frozen,
			verified,
			captured.recipe,
			captured.materialized
		);
		finalizedProjectCheck.replay(query, PROJECT_KEY);
		finalizedProjectCheck.assertFullyConsumed();
		expectCode(
			() => finalizedProjectCheck.assertProjectConsumed(PROJECT_KEY),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);

		const poisoned = replayJournal(frozen, verified, captured.recipe, captured.materialized);
		poisoned.poison();
		expectCode(
			() => poisoned.replay(query, PROJECT_KEY),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);
	});

	it('converts path-authority topology failures to context drift during recheck', () => {
		const root = temporaryRoot();
		const frozen = subject({});
		const capture = session(root, frozen);
		capture.capture({ logicalPath: 'missing.ts', operation: 'FILE_EXISTS' });
		const finalized = capture.finalize();
		vi.spyOn(capture.paths, 'assertWorkspaceAliasTopologyUnchanged').mockImplementation(() => {
			throw new CompilerPathError('PATH_ESCAPE', 'simulated authority failure');
		});
		expectCode(
			() => recheckCompilerInputJournal(finalized),
			CompilerInputCaptureError,
			'CONTEXT_CHANGED'
		);
	});

	it('captures, verifies, and replays every public operation result family', () => {
		const root = temporaryRoot();
		write(root, 'node_modules/pkg/index.d.ts', 'export declare const live: true;\n');
		const frozen = subject({
			'src/index.ts': 'export const frozen = true;\n',
			'types/nested/a.d.ts': 'export declare const a: true;\n'
		});
		const capture = session(root, frozen, false);
		const queries: readonly CompilerInputQuery[] = [
			{ logicalPath: 'src/index.ts', operation: 'READ_FILE' },
			{ logicalPath: 'missing.ts', operation: 'FILE_EXISTS' },
			{ logicalPath: 'types', operation: 'DIRECTORY_EXISTS' },
			{ logicalPath: 'types', operation: 'GET_DIRECTORIES' },
			{
				depth: null,
				excludes: [],
				extensions: ['.d.ts'],
				includes: ['**/*'],
				logicalPath: 'types',
				operation: 'READ_DIRECTORY'
			},
			{ logicalPath: 'src/index.ts', operation: 'REALPATH' },
			{ logicalPath: '.', operation: 'CURRENT_DIRECTORY' },
			{ logicalPath: '.', operation: 'USE_CASE_SENSITIVE_FILE_NAMES' }
		];
		const results = queries.map((query) => capture.capture(query).observation.result);
		expect(results).toEqual([
			'PRESENT',
			'ABSENT',
			'DIRECTORY',
			'DIRECTORY',
			'DIRECTORY',
			'RESOLVED',
			'RESOLVED',
			'CASE_INSENSITIVE'
		]);
		const finalized = capture.finalize();
		const verified = recheckCompilerInputJournal(finalized);
		const replay = replayJournal(frozen, verified, capture.recipe, capture.materialized);
		for (const entry of finalized.entries)
			expect(replay.replay(entry.query, PROJECT_KEY).observation).toEqual(entry.observation);
		replay.assertProjectConsumed(PROJECT_KEY);
		replay.assertFullyConsumed();
	});

	it('normalizes absolute and empty wildcards while rejecting root escape and simple-query metadata overflow', () => {
		const root = temporaryRoot();
		write(root, 'node_modules/pkg/src/index.d.ts', 'export declare const value: true;\n');
		const { reader } = session(root, subject({}));
		const base = {
			depth: null,
			excludes: [],
			extensions: ['.d.ts'],
			logicalPath: 'node_modules/pkg',
			operation: 'READ_DIRECTORY' as const
		};
		const absoluteInclude = join(root, 'node_modules/pkg/src');
		expect(reader.observe({ ...base, includes: [absoluteInclude] }).observation).toMatchObject({
			resultEntries: ['node_modules/pkg/src/index.d.ts']
		});
		expect(reader.observe({ ...base, includes: [''] }).observation).toMatchObject({
			resultEntries: []
		});
		expectCode(
			() => reader.observe({ ...base, includes: [join(root, 'elsewhere')] }),
			CompilerInputCaptureError,
			'INVALID_QUERY'
		);
		expectCode(
			() => reader.observe({ ...base, includes: ['../elsewhere'] }),
			CompilerInputCaptureError,
			'INVALID_QUERY'
		);

		const simple = { logicalPath: 'missing.ts', operation: 'FILE_EXISTS' as const };
		const simpleBytes = Buffer.byteLength(canonicalSemanticJson(simple), 'utf8');
		expectCode(
			() =>
				reader.observe(simple, {
					allowPresentRead: true,
					deadlineMs: Date.now() + 10_000,
					maxDirectoryEntries: 100,
					maxPathCharacters: BUDGETS.maxPathCharacters,
					maxQueryMetadataBytes: simpleBytes - 1,
					maxReadBytes: BUDGETS.maxContextFileBytes
				}),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);
	});

	it('enforces frozen and live REALPATH result bounds after physical resolution', () => {
		const root = temporaryRoot();
		const longWorkspacePath = `packages/${'long-target-'.repeat(6)}pkg`;
		const targetFile = `${longWorkspacePath}/index.ts`;
		write(root, targetFile, 'export const workspace = true;\n');
		mkdirSync(join(root, 'node_modules'), { recursive: true });
		symlinkSync(
			join(root, ...longWorkspacePath.split('/')),
			join(root, 'node_modules/p'),
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		const workspace = {
			exports: [],
			kind: 'PACKAGE',
			manifestPath: `${longWorkspacePath}/package.json`,
			name: 'p',
			path: longWorkspacePath,
			private: true,
			provenance: [],
			workspacePatterns: []
		} as FrozenSubject['workspaces'][number];
		const frozen = subject(
			{ [targetFile]: 'export const workspace = true;\n' },
			{ workspaces: [workspace] }
		);
		const frozenReader = new LiveCompilerInputReader(
			frozen,
			new FrozenCompilerPathResolver(frozen, root, true),
			true
		);
		const aliasFile = 'node_modules/p/index.ts';
		const limits = {
			allowPresentRead: true,
			deadlineMs: Date.now() + 10_000,
			maxDirectoryEntries: 100,
			maxPathCharacters: aliasFile.length,
			maxQueryMetadataBytes: 4096,
			maxReadBytes: 4096
		};
		expectCode(
			() => frozenReader.observe({ logicalPath: aliasFile, operation: 'REALPATH' }, limits),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);

		const longLivePath = `node_modules/${'long-live-target-'.repeat(5)}pkg`;
		write(root, `${longLivePath}/index.d.ts`, 'export declare const live: true;\n');
		symlinkSync(
			join(root, ...longLivePath.split('/')),
			join(root, 'node_modules/q'),
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		const liveFrozen = subject({});
		const liveReader = new LiveCompilerInputReader(
			liveFrozen,
			new FrozenCompilerPathResolver(liveFrozen, root, true),
			true
		);
		const liveAliasFile = 'node_modules/q/index.d.ts';
		expectCode(
			() =>
				liveReader.observe(
					{ logicalPath: liveAliasFile, operation: 'REALPATH' },
					{ ...limits, maxPathCharacters: liveAliasFile.length }
				),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);
	});

	it('fails closed when stable-handle authorization changes, grows, or throws during a live read', () => {
		const root = temporaryRoot();
		const path = 'node_modules/pkg/index.d.ts';
		const initial = 'export declare const value: 1;\n';
		write(root, path, initial);
		const frozen = subject({});
		const changed = session(root, frozen);
		const changedAuthority = changed.paths.assertLiveFilePermitted.bind(changed.paths);
		let changedCalls = 0;
		const changedSpy = vi
			.spyOn(changed.paths, 'assertLiveFilePermitted')
			.mockImplementation((logicalPath) => {
				changedAuthority(logicalPath);
				changedCalls += 1;
				if (changedCalls === 2) write(root, path, 'export declare const value: 2;\n');
			});
		expectCode(
			() => changed.reader.observe({ logicalPath: path, operation: 'READ_FILE' }),
			CompilerInputCaptureError,
			'CONTEXT_CHANGED'
		);
		changedSpy.mockRestore();

		write(root, path, 'x');
		const grown = session(root, frozen);
		const grownAuthority = grown.paths.assertLiveFilePermitted.bind(grown.paths);
		let grownCalls = 0;
		const grownSpy = vi
			.spyOn(grown.paths, 'assertLiveFilePermitted')
			.mockImplementation((logicalPath) => {
				grownAuthority(logicalPath);
				grownCalls += 1;
				if (grownCalls === 2) write(root, path, 'content grew beyond its pre-open byte budget');
			});
		expectCode(
			() =>
				grown.reader.observe(
					{ logicalPath: path, operation: 'READ_FILE' },
					{
						allowPresentRead: true,
						deadlineMs: Date.now() + 10_000,
						maxDirectoryEntries: 100,
						maxPathCharacters: BUDGETS.maxPathCharacters,
						maxQueryMetadataBytes: 4096,
						maxReadBytes: 1
					}
				),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);
		grownSpy.mockRestore();

		write(root, path, initial);
		const unavailable = session(root, frozen);
		const unavailableAuthority = unavailable.paths.assertLiveFilePermitted.bind(unavailable.paths);
		let unavailableCalls = 0;
		vi.spyOn(unavailable.paths, 'assertLiveFilePermitted').mockImplementation((logicalPath) => {
			unavailableCalls += 1;
			if (unavailableCalls === 2) throw new Error('simulated stable-handle authority failure');
			unavailableAuthority(logicalPath);
		});
		expectCode(
			() => unavailable.reader.observe({ logicalPath: path, operation: 'READ_FILE' }),
			CompilerInputCaptureError,
			'CONTEXT_UNAVAILABLE'
		);
	});

	it('bounds live-directory races and avoids rescanning the same physical directory through junctions', () => {
		const root = temporaryRoot();
		write(root, 'node_modules/pkg/target/index.d.ts', 'export declare const target: true;\n');
		symlinkSync(
			join(root, 'node_modules/pkg/target'),
			join(root, 'node_modules/pkg/alias-a'),
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		symlinkSync(
			join(root, 'node_modules/pkg/target'),
			join(root, 'node_modules/pkg/alias-b'),
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		const frozen = subject({});
		const baseline = session(root, frozen);
		expect(
			baseline.reader.observe({ logicalPath: 'node_modules/pkg', operation: 'GET_DIRECTORIES' })
				.observation
		).toMatchObject({
			resultEntries: expect.arrayContaining([
				'node_modules/pkg/alias-a',
				'node_modules/pkg/alias-b',
				'node_modules/pkg/target'
			])
		});
		const scan = baseline.reader.observe({
			depth: null,
			excludes: [],
			extensions: ['.d.ts'],
			includes: ['**/*'],
			logicalPath: 'node_modules/pkg',
			operation: 'READ_DIRECTORY'
		}).observation;
		expect('resultEntries' in scan ? scan.resultEntries : []).toHaveLength(1);

		const disappearBeforeOpen = session(root, frozen);
		const openAbsolute = disappearBeforeOpen.paths.toAbsolute.bind(disappearBeforeOpen.paths);
		let openCalls = 0;
		vi.spyOn(disappearBeforeOpen.paths, 'toAbsolute').mockImplementation((logicalPath) => {
			const absolute = openAbsolute(logicalPath);
			if (logicalPath === 'node_modules/pkg' && ++openCalls === 2)
				rmSync(absolute, { force: true, recursive: true });
			return absolute;
		});
		expectCode(
			() =>
				disappearBeforeOpen.reader.observe({
					logicalPath: 'node_modules/pkg',
					operation: 'GET_DIRECTORIES'
				}),
			CompilerInputCaptureError,
			'CONTEXT_CHANGED'
		);

		write(root, 'node_modules/pkg/sub/index.d.ts', 'export declare const restored: true;\n');
		const disappearBeforeRealpath = session(root, frozen);
		const scanAbsolute = disappearBeforeRealpath.paths.toAbsolute.bind(
			disappearBeforeRealpath.paths
		);
		let scanCalls = 0;
		vi.spyOn(disappearBeforeRealpath.paths, 'toAbsolute').mockImplementation((logicalPath) => {
			const absolute = scanAbsolute(logicalPath);
			if (logicalPath === 'node_modules/pkg' && ++scanCalls === 2)
				rmSync(absolute, { force: true, recursive: true });
			return absolute;
		});
		expectCode(
			() =>
				disappearBeforeRealpath.reader.observe({
					depth: null,
					excludes: [],
					extensions: ['.d.ts'],
					includes: ['**/*'],
					logicalPath: 'node_modules/pkg',
					operation: 'READ_DIRECTORY'
				}),
			CompilerInputCaptureError,
			'CONTEXT_CHANGED'
		);
	});

	it('rejects corrupt reader results at journal capture and finalized-evidence seams', () => {
		const root = temporaryRoot();
		const frozen = subject({
			'src/index.ts': 'export const frozen = true;\n',
			'types/a.d.ts': 'export declare const a: true;\n',
			'types/b.d.ts': 'export declare const b: true;\n'
		});
		const rejectFinalized = (
			query: CompilerInputQuery,
			corrupt: (
				captured: ReturnType<LiveCompilerInputReader['observe']>
			) => ReturnType<LiveCompilerInputReader['observe']>,
			code: CompilerInputCaptureError['code'] = 'INVALID_CAPTURE'
		): void => {
			const attempt = session(root, frozen, false);
			const authentic = attempt.reader.observe(query);
			vi.spyOn(attempt.reader, 'observe').mockReturnValue(corrupt(authentic));
			attempt.capture(query);
			expectCode(() => attempt.finalize(), CompilerInputCaptureError, code);
		};
		const exists = { logicalPath: 'missing.ts', operation: 'FILE_EXISTS' as const };
		rejectFinalized(
			exists,
			(captured) =>
				({ ...captured, observation: { ...captured.observation, origin: 'TEST' } }) as ReturnType<
					LiveCompilerInputReader['observe']
				>
		);
		rejectFinalized(
			exists,
			(captured) =>
				({
					...captured,
					observation: { ...captured.observation, invocationCount: 0 }
				}) as ReturnType<LiveCompilerInputReader['observe']>
		);
		rejectFinalized(
			exists,
			(captured) =>
				({
					...captured,
					observation: { ...captured.observation, result: 'DIRECTORY' }
				}) as unknown as ReturnType<LiveCompilerInputReader['observe']>
		);
		rejectFinalized(
			exists,
			(captured) =>
				({
					...captured,
					observation: { ...captured.observation, resultDigest: 'invalid' }
				}) as ReturnType<LiveCompilerInputReader['observe']>
		);
		rejectFinalized(
			exists,
			(captured) =>
				({
					...captured,
					observation: { ...captured.observation, id: 'f'.repeat(64) }
				}) as ReturnType<LiveCompilerInputReader['observe']>
		);

		const directory = {
			depth: null,
			excludes: [],
			extensions: ['.d.ts'],
			includes: ['**/*'],
			logicalPath: 'types',
			operation: 'READ_DIRECTORY' as const
		};
		rejectFinalized(
			directory,
			(captured) =>
				({ ...captured, observation: { ...captured.observation, includes: [] } }) as ReturnType<
					LiveCompilerInputReader['observe']
				>
		);
		rejectFinalized(
			directory,
			(captured) =>
				({
					...captured,
					observation: { ...captured.observation, resultEntries: ['types/b.d.ts', 'types/a.d.ts'] }
				}) as ReturnType<LiveCompilerInputReader['observe']>
		);
		rejectFinalized(
			directory,
			(captured) =>
				({
					...captured,
					observation: { ...captured.observation, scannedEntries: 0 }
				}) as ReturnType<LiveCompilerInputReader['observe']>
		);

		const read = { logicalPath: 'src/index.ts', operation: 'READ_FILE' as const };
		rejectFinalized(
			read,
			(captured) =>
				({
					...captured,
					observation: { ...captured.observation, contentSha256: 'invalid' }
				}) as ReturnType<LiveCompilerInputReader['observe']>
		);
		rejectFinalized(read, (captured) => ({
			...captured,
			bytes: new TextEncoder().encode('forged')
		}));
		const realpath = { logicalPath: 'src/index.ts', operation: 'REALPATH' as const };
		rejectFinalized(
			realpath,
			(captured) =>
				({
					...captured,
					observation: { ...captured.observation, resolvedLogicalPath: 1 }
				}) as unknown as ReturnType<LiveCompilerInputReader['observe']>
		);
		const current = { logicalPath: '.' as const, operation: 'CURRENT_DIRECTORY' as const };
		rejectFinalized(
			current,
			(captured) =>
				({
					...captured,
					observation: { ...captured.observation, resolvedLogicalPath: 'src/index.ts' }
				}) as ReturnType<LiveCompilerInputReader['observe']>
		);
		const caseQuery = {
			logicalPath: '.' as const,
			operation: 'USE_CASE_SENSITIVE_FILE_NAMES' as const
		};
		rejectFinalized(
			caseQuery,
			(captured) =>
				({
					...captured,
					observation: { ...captured.observation, result: 'CASE_SENSITIVE' }
				}) as ReturnType<LiveCompilerInputReader['observe']>
		);
	});

	it('rejects corrupt reader results against immediate journal closure budgets and recheck budgets', () => {
		const root = temporaryRoot();
		write(root, 'node_modules/pkg/index.d.ts', 'x');
		const frozen = subject({ 'src/index.ts': 'export const frozen = true;\n' });
		const immediate = (
			query: CompilerInputQuery,
			corrupt: (
				captured: ReturnType<LiveCompilerInputReader['observe']>
			) => ReturnType<LiveCompilerInputReader['observe']>
		): void => {
			const attempt = session(root, frozen);
			const authentic = attempt.reader.observe(query);
			vi.spyOn(attempt.reader, 'observe').mockReturnValue(corrupt(authentic));
			expectCode(() => attempt.capture(query), CompilerInputCaptureError, 'BUDGET_EXCEEDED');
		};
		immediate(
			{ logicalPath: 'src/index.ts', operation: 'REALPATH' },
			(captured) =>
				({
					...captured,
					observation: {
						...captured.observation,
						resolvedLogicalPath: 'x'.repeat(BUDGETS.maxPathCharacters + 1)
					}
				}) as ReturnType<LiveCompilerInputReader['observe']>
		);
		immediate(
			{ logicalPath: 'types', operation: 'GET_DIRECTORIES' },
			(captured) =>
				({
					...captured,
					observation: { ...captured.observation, scannedEntries: BUDGETS.maxDirectoryEntries + 1 }
				}) as ReturnType<LiveCompilerInputReader['observe']>
		);
		immediate(
			{ logicalPath: 'node_modules/pkg/index.d.ts', operation: 'READ_FILE' },
			(captured) =>
				({
					...captured,
					observation: { ...captured.observation, contentBytes: BUDGETS.maxContextBytes + 1 }
				}) as ReturnType<LiveCompilerInputReader['observe']>
		);
		immediate(
			{ logicalPath: 'missing.ts', operation: 'FILE_EXISTS' },
			(captured) =>
				({
					...captured,
					observation: {
						...captured.observation,
						logicalPath: 'x'.repeat(BUDGETS.maxCompilerInputMetadataBytes)
					}
				}) as ReturnType<LiveCompilerInputReader['observe']>
		);

		const recheck = session(root, frozen, true, {
			...BUDGETS,
			maxContextBytes: 2,
			maxContextFileBytes: 2
		});
		recheck.capture({ logicalPath: 'node_modules/pkg/index.d.ts', operation: 'READ_FILE' });
		const finalized = recheck.finalize();
		const authentic = recheck.reader.observe({
			logicalPath: 'node_modules/pkg/index.d.ts',
			operation: 'READ_FILE'
		});
		vi.spyOn(recheck.reader, 'observe').mockReturnValue({
			...authentic,
			observation: { ...authentic.observation, contentBytes: 3 }
		} as ReturnType<LiveCompilerInputReader['observe']>);
		expectCode(
			() => recheckCompilerInputJournal(finalized),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);
	});

	it('enforces empty-closure, project-key, poison, and deadline bounds through public journal methods', () => {
		const root = temporaryRoot();
		const frozen = subject({});
		const paths = new FrozenCompilerPathResolver(frozen, root, true);
		const reader = new LiveCompilerInputReader(frozen, paths, true);
		expectCode(
			() =>
				new CompilerInputJournal(
					reader,
					{ ...BUDGETS, maxCompilerInputMetadataBytes: 1 },
					Date.now()
				),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);

		const invalidProject = session(root, frozen);
		expectCode(
			() =>
				invalidProject.journal.capture({ logicalPath: 'missing.ts', operation: 'FILE_EXISTS' }, ''),
			CompilerInputCaptureError,
			'INVALID_QUERY'
		);
		const poisonedEvidence = session(root, frozen);
		poisonedEvidence.journal.poison();
		expectCode(
			() => poisonedEvidence.journal.currentProjectEvidence(PROJECT_KEY),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);

		vi.useFakeTimers();
		vi.setSystemTime(new Date(80_000));
		const deadlineBudgets = { ...BUDGETS, maxDurationMs: 10 };
		const expiredAssertion = new CompilerInputJournal(reader, deadlineBudgets, 80_000);
		vi.setSystemTime(new Date(80_011));
		expectCode(
			() => expiredAssertion.assertWithinDeadline(),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);
		vi.setSystemTime(new Date(90_000));
		const expiredEvidence = session(root, frozen, true, deadlineBudgets, 90_000);
		vi.setSystemTime(new Date(90_011));
		expectCode(
			() => expiredEvidence.journal.currentProjectEvidence(PROJECT_KEY),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);
	});

	it('rejects globally complete replay when queries are attributed to the wrong registered projects', () => {
		const root = temporaryRoot();
		const frozen = subject({});
		const paths = new FrozenCompilerPathResolver(frozen, root, true);
		const reader = new LiveCompilerInputReader(frozen, paths, true);
		const journal = new CompilerInputJournal(reader, BUDGETS, Date.now());
		const first = projectBinding(root, 'first/tsconfig.json');
		const second = projectBinding(root, 'second/tsconfig.json');
		journal.registerProject('first/tsconfig.json', first.recipe, first.materialized);
		journal.registerProject('second/tsconfig.json', second.recipe, second.materialized);
		const firstQuery = { logicalPath: 'first-missing.ts', operation: 'FILE_EXISTS' as const };
		const secondQuery = { logicalPath: 'second-missing.ts', operation: 'FILE_EXISTS' as const };
		journal.capture(firstQuery, 'first/tsconfig.json');
		journal.capture(secondQuery, 'second/tsconfig.json');
		const verified = recheckCompilerInputJournal(journal.finalizeCapture());
		const replay = new ReplayCompilerInputJournal(frozen, verified);
		replay.registerProject('first/tsconfig.json', first.recipe, first.materialized);
		replay.registerProject('second/tsconfig.json', second.recipe, second.materialized);
		replay.replay(firstQuery, 'second/tsconfig.json');
		replay.replay(secondQuery, 'first/tsconfig.json');
		expectCode(() => replay.assertFullyConsumed(), CompilerInputCaptureError, 'INVALID_CAPTURE');
		expectCode(
			() => replay.assertProjectConsumed('first/tsconfig.json'),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);
	});

	it('rejects hostile and structurally non-inert READ_DIRECTORY parameter arrays', () => {
		const root = temporaryRoot();
		const reject = (extensions: readonly string[], code: CompilerInputCaptureError['code']) =>
			expectCode(
				() =>
					session(root, subject({})).capture({
						depth: null,
						excludes: [],
						extensions,
						includes: ['**/*'],
						logicalPath: '.',
						operation: 'READ_DIRECTORY'
					}),
				CompilerInputCaptureError,
				code
			);

		const inherited = ['.ts'];
		Object.setPrototypeOf(inherited, null);
		reject(inherited, 'INVALID_QUERY');

		const oversized = new Array<string>(BUDGETS.maxDirectoryEntries + 1);
		reject(oversized, 'BUDGET_EXCEEDED');

		const expando = ['.ts'];
		Object.defineProperty(expando, 'extra', { enumerable: true, value: 'unexpected' });
		reject(expando, 'INVALID_QUERY');

		const nonEnumerable = ['.ts'];
		Object.defineProperty(nonEnumerable, '0', { enumerable: false, value: '.ts' });
		reject(nonEnumerable, 'INVALID_QUERY');

		const inspectionFailure = ['.ts'];
		const intrinsicGetPrototypeOf = Object.getPrototypeOf;
		const prototypeSpy = vi.spyOn(Object, 'getPrototypeOf').mockImplementation((value) => {
			if (value === inspectionFailure) throw new Error('simulated reflective failure');
			return intrinsicGetPrototypeOf(value);
		});
		reject(inspectionFailure, 'INVALID_QUERY');
		prototypeSpy.mockRestore();
	});

	it('bounds directory enumeration and fails closed across open and child-identity races', () => {
		const unavailableRoot = temporaryRoot();
		write(unavailableRoot, 'node_modules/pkg/index.d.ts', 'export {};\n');
		const unavailable = session(unavailableRoot, subject({}));
		const unavailableAbsolute = unavailable.paths.toAbsolute.bind(unavailable.paths);
		let unavailableCalls = 0;
		vi.spyOn(unavailable.paths, 'toAbsolute').mockImplementation((logicalPath) => {
			const absolutePath = unavailableAbsolute(logicalPath);
			return logicalPath === 'node_modules/pkg' && ++unavailableCalls === 2
				? `${absolutePath}\0`
				: absolutePath;
		});
		expectCode(
			() =>
				unavailable.reader.observe({
					logicalPath: 'node_modules/pkg',
					operation: 'GET_DIRECTORIES'
				}),
			CompilerInputCaptureError,
			'CONTEXT_UNAVAILABLE'
		);

		const boundedRoot = temporaryRoot();
		mkdirSync(join(boundedRoot, 'node_modules/pkg/a'), { recursive: true });
		mkdirSync(join(boundedRoot, 'node_modules/pkg/b'), { recursive: true });
		const bounded = session(boundedRoot, subject({}));
		expectCode(
			() =>
				bounded.reader.observe(
					{ logicalPath: 'node_modules/pkg', operation: 'GET_DIRECTORIES' },
					{
						allowPresentRead: true,
						deadlineMs: Date.now() + 10_000,
						maxDirectoryEntries: 1,
						maxPathCharacters: BUDGETS.maxPathCharacters,
						maxQueryMetadataBytes: 4096,
						maxReadBytes: 4096
					}
				),
			CompilerInputCaptureError,
			'BUDGET_EXCEEDED'
		);

		const disappearedRoot = temporaryRoot();
		mkdirSync(join(disappearedRoot, 'node_modules/pkg/target'), { recursive: true });
		symlinkSync(
			join(disappearedRoot, 'node_modules/pkg/target'),
			join(disappearedRoot, 'node_modules/pkg/alias'),
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		const disappeared = session(disappearedRoot, subject({}));
		const authorize = disappeared.paths.authorizeEnumeratedChild.bind(disappeared.paths);
		vi.spyOn(disappeared.paths, 'authorizeEnumeratedChild').mockImplementation(
			(parentLogicalPath, entryName) => {
				const authorized = authorize(parentLogicalPath, entryName);
				if (entryName === 'alias')
					rmSync(join(disappearedRoot, 'node_modules/pkg/target'), {
						force: true,
						recursive: true
					});
				return authorized;
			}
		);
		expectCode(
			() =>
				disappeared.reader.observe({
					logicalPath: 'node_modules/pkg',
					operation: 'GET_DIRECTORIES'
				}),
			CompilerInputCaptureError,
			'CONTEXT_CHANGED'
		);

		const filteredRoot = temporaryRoot();
		mkdirSync(join(filteredRoot, 'node_modules/pkg/target'), { recursive: true });
		write(filteredRoot, 'node_modules/pkg/file-target', 'not a directory\n');
		symlinkSync(
			join(filteredRoot, 'node_modules/pkg/target'),
			join(filteredRoot, 'node_modules/pkg/alias'),
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		const filtered = session(filteredRoot, subject({}));
		const authorizeFiltered = filtered.paths.authorizeEnumeratedChild.bind(filtered.paths);
		vi.spyOn(filtered.paths, 'authorizeEnumeratedChild').mockImplementation(
			(parentLogicalPath, entryName) => {
				const authorized = authorizeFiltered(parentLogicalPath, entryName);
				return entryName === 'alias'
					? Object.freeze({
							...authorized,
							absolutePath: join(filteredRoot, 'node_modules/pkg/file-target')
						})
					: authorized;
			}
		);
		const directories = filtered.reader.observe({
			logicalPath: 'node_modules/pkg',
			operation: 'GET_DIRECTORIES'
		}).observation;
		expect('resultEntries' in directories ? directories.resultEntries : []).toContain(
			'node_modules/pkg/target'
		);
		expect('resultEntries' in directories ? directories.resultEntries : []).not.toContain(
			'node_modules/pkg/alias'
		);
	});

	it('rejects non-string protocol fields, non-inert bytes, and self-consistent forged frozen bytes', () => {
		const root = temporaryRoot();
		const sourceText = 'export const frozen = true;\n';
		const frozen = subject({ 'src/index.ts': sourceText });
		const read = { logicalPath: 'src/index.ts', operation: 'READ_FILE' as const };
		const rejectFinalized = (
			corrupt: (
				captured: ReturnType<LiveCompilerInputReader['observe']>
			) => ReturnType<LiveCompilerInputReader['observe']>
		): void => {
			const attempt = session(root, frozen);
			const authentic = attempt.reader.observe(read);
			vi.spyOn(attempt.reader, 'observe').mockReturnValue(corrupt(authentic));
			attempt.capture(read);
			expectCode(() => attempt.finalize(), CompilerInputCaptureError, 'INVALID_CAPTURE');
		};

		rejectFinalized(
			(captured) =>
				({
					...captured,
					observation: { ...captured.observation, operation: 1 }
				}) as unknown as ReturnType<LiveCompilerInputReader['observe']>
		);
		rejectFinalized(
			(captured) =>
				({
					...captured,
					observation: { ...captured.observation, result: null }
				}) as unknown as ReturnType<LiveCompilerInputReader['observe']>
		);

		class DerivedBytes extends Uint8Array {}
		rejectFinalized((captured) => ({
			...captured,
			bytes: new DerivedBytes(captured.bytes!)
		}));

		rejectFinalized((captured) => {
			const bytes = captured.bytes!.slice();
			Object.defineProperty(bytes, 'slice', { value: () => bytes });
			return { ...captured, bytes };
		});

		rejectFinalized((captured) => {
			const bytes = new TextEncoder().encode('export const frozen = false;\n');
			const { id: _id, resultDigest: _resultDigest, ...authenticPayload } = captured.observation;
			const payload = {
				...authenticPayload,
				contentBytes: bytes.byteLength,
				contentSha256: sha256(bytes)
			};
			const resultDigest = compilerInputResultDigest(payload);
			const observation = {
				...payload,
				id: semanticContextInputId({
					...payload,
					resultDigest,
					subjectId: frozen.descriptor.subjectId
				}),
				resultDigest
			};
			return { ...captured, bytes, observation } as ReturnType<LiveCompilerInputReader['observe']>;
		});
	});

	it('classifies live-file disappearance and type replacement during stable-handle admission', () => {
		const exercise = (replacement: 'ABSENT' | 'DIRECTORY'): void => {
			const root = temporaryRoot();
			const logicalPath = 'node_modules/pkg/index.d.ts';
			const absolutePath = join(root, 'node_modules/pkg/index.d.ts');
			write(root, logicalPath, 'export declare const value: true;\n');
			const attempt = session(root, subject({}));
			const assertPermitted = attempt.paths.assertLiveFilePermitted.bind(attempt.paths);
			let calls = 0;
			vi.spyOn(attempt.paths, 'assertLiveFilePermitted').mockImplementation((path) => {
				assertPermitted(path);
				if (++calls !== 1) return;
				rmSync(absolutePath, { force: true });
				if (replacement === 'DIRECTORY') mkdirSync(absolutePath);
			});
			expectCode(
				() => attempt.reader.observe({ logicalPath, operation: 'READ_FILE' }),
				CompilerInputCaptureError,
				'CONTEXT_CHANGED'
			);
		};

		exercise('ABSENT');
		exercise('DIRECTORY');
	});
});

describe('compiler-input operation budget witnesses', () => {
	it('derives exact CAPTURE and RECHECK populations while recording only defensible CAPTURE host multiplicity', () => {
		const root = temporaryRoot();
		const contextText = 'export declare const generated: true;\n';
		write(root, 'generated/context.d.ts', contextText);
		const generatedContext = {
			path: 'generated/context.d.ts',
			selectedInput: false,
			sha256: sha256(contextText)
		} as FrozenSubject['generatedContexts'][number];
		const frozen = subject({}, { generatedContexts: [generatedContext] });
		const startedAtMs = Date.now();
		const capture = session(root, frozen, true, BUDGETS, startedAtMs);
		capture.capture({ logicalPath: 'generated/context.d.ts', operation: 'READ_FILE' });
		capture.capture({ logicalPath: 'generated/context.d.ts', operation: 'READ_FILE' });
		capture.capture({
			depth: null,
			excludes: [],
			extensions: ['.d.ts'],
			includes: ['**/*'],
			logicalPath: 'generated',
			operation: 'READ_DIRECTORY'
		});
		capture.capture({ logicalPath: 'missing.ts', operation: 'FILE_EXISTS' });
		const finalized = capture.finalize();
		const recheckReads = vi.spyOn(capture.reader, 'observe');
		const verified = recheckCompilerInputJournal(finalized);
		expect(recheckReads).toHaveBeenCalledTimes(finalized.entries.length);
		const replay = replayJournal(frozen, verified, capture.recipe, capture.materialized);
		for (const attribution of finalized.projectAttributions)
			for (const query of attribution.queryInvocations)
				for (let invocation = 0; invocation < query.invocationCount; invocation += 1)
					replay.replay(query.query, attribution.projectKey);
		replay.assertFullyConsumed();
		const operation = createStaticSemanticOperationBudgetSession(
			BUDGETS,
			startedAtMs,
			() => startedAtMs
		);
		const binding = operation.providerBinding();
		operation.acceptCompilerInputWitness(
			'CAPTURE',
			issueFrozenCompilerCaptureOperationBudgetWitness(binding, finalized)
		);
		operation.acceptCompilerInputWitness(
			'RECHECK',
			issueReplayCompilerInputOperationBudgetWitness(binding, replay)
		);

		acceptTestBudgetClaims(operation, 'MATERIALIZE', [
			{ members: [PROJECT_KEY], mode: 'COUNT', phase: 'MATERIALIZE', population: 'PROJECTS' }
		]);
		acceptTestBudgetClaims(operation, 'CAPTURE', emptyRawBudgetClaims('CAPTURE'));
		acceptTestBudgetClaims(operation, 'EXTRACT', [
			{ members: [PROJECT_KEY], mode: 'COUNT', phase: 'EXTRACT', population: 'PROJECTS' },
			...emptyRawBudgetClaims('EXTRACT')
		]);
		acceptTestBudgetClaims(operation, 'VALIDATE', [
			...compilerInputBudgetClaims(finalized, 'VALIDATE'),
			...emptyRawBudgetClaims('VALIDATE'),
			{
				contributions: [{ amount: 1, key: 'canonical-static-semantic-snapshot' }],
				mode: 'SUM',
				phase: 'VALIDATE',
				population: 'SNAPSHOT_BYTES'
			}
		]);
		const usage = operation.finalize();

		for (const population of [
			'PROJECTS',
			'COMPILER_INPUTS',
			'COMPILER_INPUT_METADATA_BYTES',
			'CONTEXT_FILES',
			'CONTEXT_BYTES',
			'DIRECTORY_ENTRIES'
		] as const) {
			const claims = usage.populationClaims.filter((claim) => claim.population === population);
			expect(new Set(claims.map((claim) => claim.manifestSha256))).toHaveLength(1);
		}
		const contextFiles = usage.populationClaims.find(
			(claim) => claim.phase === 'CAPTURE' && claim.population === 'CONTEXT_FILES'
		);
		const contextBytes = usage.populationClaims.find(
			(claim) => claim.phase === 'CAPTURE' && claim.population === 'CONTEXT_BYTES'
		);
		expect(contextFiles).toMatchObject({ amount: 1, mode: 'COUNT' });
		expect(contextBytes).toMatchObject({ amount: Buffer.byteLength(contextText), mode: 'SUM' });
		const capturedInvocations = finalized.observations.reduce(
			(total, observation) => total + observation.invocationCount,
			0
		);
		expect(usage.uniqueQueries.count).toBe(finalized.entries.length);
		expect(usage.uniqueQueries.members.flatMap((query) => query.invocations)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ phase: 'CAPTURE', projectKey: PROJECT_KEY })
			])
		);
		const recheckInvocations = usage.uniqueQueries.members
			.flatMap((query) => query.invocations)
			.filter((invocation) => invocation.phase === 'RECHECK');
		expect(recheckInvocations).toEqual(
			expect.arrayContaining([expect.objectContaining({ projectKey: PROJECT_KEY })])
		);
		expect(recheckInvocations.reduce((total, invocation) => total + invocation.amount, 0)).toBe(
			capturedInvocations
		);
		expect(usage.workTotals[0]).toMatchObject({ amount: capturedInvocations * 2 });
	});

	it('issues replay evidence only from the exact fully consumed journal and enforces binding and single use', () => {
		const root = temporaryRoot();
		const frozen = subject({});
		const startedAtMs = Date.now();
		const captured = session(root, frozen, true, BUDGETS, startedAtMs);
		const query = { logicalPath: 'missing.ts', operation: 'FILE_EXISTS' as const };
		captured.capture(query);
		captured.capture(query);
		const finalized = captured.finalize();
		const verified = recheckCompilerInputJournal(finalized);
		const replay = replayJournal(frozen, verified, captured.recipe, captured.materialized);
		const operation = createStaticSemanticOperationBudgetSession(
			BUDGETS,
			startedAtMs,
			() => startedAtMs
		);
		const binding = operation.providerBinding();

		expectCode(
			() => issueReplayCompilerInputOperationBudgetWitness(binding, replay),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);
		replay.replay(query, PROJECT_KEY);
		expectCode(
			() => issueReplayCompilerInputOperationBudgetWitness(binding, replay),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);
		replay.replay(query, PROJECT_KEY);
		replay.assertFullyConsumed();
		expectCode(
			() => issueReplayCompilerInputOperationBudgetWitness(new Proxy(binding, {}), replay),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);
		expectCode(
			() =>
				issueReplayCompilerInputOperationBudgetWitness(binding, {
					...replay
				} as unknown as ReplayCompilerInputJournal),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);

		const witness = issueReplayCompilerInputOperationBudgetWitness(binding, replay);
		const budgetsDigest = sha256(canonicalSemanticJson(normalizeSemanticBudgets(BUDGETS)));
		expectCode(
			() => takeCompilerInputOperationBudgetWitness(witness, binding, 'CAPTURE', budgetsDigest),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);
		expectCode(
			() => takeCompilerInputOperationBudgetWitness(witness, binding, 'RECHECK', '0'.repeat(64)),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);
		const wrongSession = createStaticSemanticOperationBudgetSession(
			BUDGETS,
			startedAtMs,
			() => startedAtMs
		);
		expectCode(
			() => wrongSession.acceptCompilerInputWitness('RECHECK', witness),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);
		const cloneSession = createStaticSemanticOperationBudgetSession(
			BUDGETS,
			startedAtMs,
			() => startedAtMs
		);
		expectCode(
			() => cloneSession.acceptCompilerInputWitness('RECHECK', structuredClone(witness) as never),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);
		const proxySession = createStaticSemanticOperationBudgetSession(
			BUDGETS,
			startedAtMs,
			() => startedAtMs
		);
		expectCode(
			() => proxySession.acceptCompilerInputWitness('RECHECK', new Proxy(witness, {})),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);
		operation.acceptCompilerInputWitness('RECHECK', witness);
		expectCode(
			() => operation.acceptCompilerInputWitness('RECHECK', witness),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);
	});

	it('preserves actual per-project replay multiplicity when projects share one compiler query', () => {
		const root = temporaryRoot();
		const frozen = subject({});
		const paths = new FrozenCompilerPathResolver(frozen, root, true);
		const reader = new LiveCompilerInputReader(frozen, paths, true);
		const journal = new CompilerInputJournal(reader, BUDGETS, Date.now());
		const first = projectBinding(root, 'first/tsconfig.json');
		const second = projectBinding(root, 'second/tsconfig.json');
		journal.registerProject('first/tsconfig.json', first.recipe, first.materialized);
		journal.registerProject('second/tsconfig.json', second.recipe, second.materialized);
		const query = { logicalPath: 'shared-missing.ts', operation: 'FILE_EXISTS' as const };
		journal.capture(query, 'first/tsconfig.json');
		journal.capture(query, 'first/tsconfig.json');
		journal.capture(query, 'second/tsconfig.json');
		const verified = recheckCompilerInputJournal(journal.finalizeCapture());
		const replay = new ReplayCompilerInputJournal(frozen, verified);
		replay.registerProject('first/tsconfig.json', first.recipe, first.materialized);
		replay.registerProject('second/tsconfig.json', second.recipe, second.materialized);
		replay.replay(query, 'first/tsconfig.json');
		replay.replay(query, 'second/tsconfig.json');
		replay.replay(query, 'first/tsconfig.json');
		replay.assertFullyConsumed();

		const operation = createStaticSemanticOperationBudgetSession(BUDGETS, Date.now());
		const binding = operation.providerBinding();
		const evidence = takeCompilerInputOperationBudgetWitness(
			issueReplayCompilerInputOperationBudgetWitness(binding, replay),
			binding,
			'RECHECK',
			sha256(canonicalSemanticJson(normalizeSemanticBudgets(BUDGETS)))
		);
		expect(evidence.phase).toBe('RECHECK');
		expect(
			evidence.queryCharges.map(({ invocationCount, projectKey }) => ({
				invocationCount,
				projectKey
			}))
		).toEqual([
			{ invocationCount: 2, projectKey: 'first/tsconfig.json' },
			{ invocationCount: 1, projectKey: 'second/tsconfig.json' }
		]);
		expect(new Set(evidence.queryCharges.map((charge) => charge.queryKey))).toHaveLength(1);
	});

	it('rejects fake, cloned, tampered, wrong-phase, wrong-session, wrong-budget, and reused capabilities', () => {
		const makeCapabilities = () => {
			const root = temporaryRoot();
			const frozen = subject({});
			const startedAtMs = Date.now();
			const capture = session(root, frozen, true, BUDGETS, startedAtMs);
			capture.capture({ logicalPath: 'missing.ts', operation: 'FILE_EXISTS' });
			const finalized = capture.finalize();
			return {
				finalized,
				startedAtMs
			};
		};

		const tamper = makeCapabilities();
		const tamperOperation = createStaticSemanticOperationBudgetSession(
			BUDGETS,
			tamper.startedAtMs,
			() => tamper.startedAtMs
		);
		expectCode(
			() =>
				issueFrozenCompilerCaptureOperationBudgetWitness(tamperOperation.providerBinding(), {
					...tamper.finalized
				} as FrozenCompilerCapture),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);
		const fake = makeCapabilities();
		const fakeOperation = createStaticSemanticOperationBudgetSession(
			BUDGETS,
			fake.startedAtMs,
			() => fake.startedAtMs
		);
		expectCode(
			() => fakeOperation.acceptCompilerInputWitness('CAPTURE', Object.freeze({}) as never),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);

		const cloned = makeCapabilities();
		const cloneOperation = createStaticSemanticOperationBudgetSession(
			BUDGETS,
			cloned.startedAtMs,
			() => cloned.startedAtMs
		);
		const cloneWitness = issueFrozenCompilerCaptureOperationBudgetWitness(
			cloneOperation.providerBinding(),
			cloned.finalized
		);
		expectCode(
			() =>
				cloneOperation.acceptCompilerInputWitness(
					'CAPTURE',
					structuredClone(cloneWitness) as never
				),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);

		const wrongPhase = makeCapabilities();
		const phaseOperation = createStaticSemanticOperationBudgetSession(
			BUDGETS,
			wrongPhase.startedAtMs,
			() => wrongPhase.startedAtMs
		);
		expectCode(
			() =>
				phaseOperation.acceptCompilerInputWitness(
					'RECHECK',
					issueFrozenCompilerCaptureOperationBudgetWitness(
						phaseOperation.providerBinding(),
						wrongPhase.finalized
					)
				),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);

		const wrongSession = makeCapabilities();
		const firstOperation = createStaticSemanticOperationBudgetSession(
			BUDGETS,
			wrongSession.startedAtMs,
			() => wrongSession.startedAtMs
		);
		const secondOperation = createStaticSemanticOperationBudgetSession(
			BUDGETS,
			wrongSession.startedAtMs,
			() => wrongSession.startedAtMs
		);
		const scopedWitness = issueFrozenCompilerCaptureOperationBudgetWitness(
			firstOperation.providerBinding(),
			wrongSession.finalized
		);
		expectCode(
			() => secondOperation.acceptCompilerInputWitness('CAPTURE', scopedWitness),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);

		const wrongBudget = makeCapabilities();
		const budgetOperation = createStaticSemanticOperationBudgetSession(
			{ ...BUDGETS, maxCompilerFacts: BUDGETS.maxCompilerFacts + 1 },
			wrongBudget.startedAtMs,
			() => wrongBudget.startedAtMs
		);
		expectCode(
			() =>
				budgetOperation.acceptCompilerInputWitness(
					'CAPTURE',
					issueFrozenCompilerCaptureOperationBudgetWitness(
						budgetOperation.providerBinding(),
						wrongBudget.finalized
					)
				),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);

		const reused = makeCapabilities();
		const reuseOperation = createStaticSemanticOperationBudgetSession(
			BUDGETS,
			reused.startedAtMs,
			() => reused.startedAtMs
		);
		const reusedWitness = issueFrozenCompilerCaptureOperationBudgetWitness(
			reuseOperation.providerBinding(),
			reused.finalized
		);
		reuseOperation.acceptCompilerInputWitness('CAPTURE', reusedWitness);
		expectCode(
			() => reuseOperation.acceptCompilerInputWitness('CAPTURE', reusedWitness),
			CompilerInputCaptureError,
			'INVALID_CAPTURE'
		);
	});
});
