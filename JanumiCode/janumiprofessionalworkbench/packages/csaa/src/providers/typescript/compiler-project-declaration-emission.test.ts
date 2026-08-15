import ts from 'typescript';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { StaticSemanticSnapshot } from '../../contracts/semantic.js';
import type { SourceOriginProgramSourceIdentity } from '../../contracts/source-origin-correlation.js';
import {
	CompilerProjectProgramCapabilityError,
	type CompilerProjectProgramEvidence,
	type CompilerProjectProgramLimits
} from '../../semantic/compiler-project-program-capability.js';
import {
	SOURCE_ORIGIN_CORRELATION_FIXTURE_SOURCE_PATH,
	createSourceOriginCorrelationFixture,
	type SourceOriginCorrelationFixture
} from '../../semantic/source-origin-correlation-fixture.test-support.js';
import {
	sourceOriginProgramInputAttemptPopulationDigest,
	sourceOriginProgramSourcePopulationDigest
} from '../../semantic/source-origin-correlation-canonical.js';
import {
	CompilerProjectDeclarationEmissionError,
	compilerProjectDeclarationEmissionCompilerProgramCapability,
	compilerProjectDeclarationEmissionTypeScriptPublicApi,
	emitCompilerProjectDeclaration,
	type CompilerProjectDeclarationEmissionInputs,
	type CompilerProjectDeclarationEmissionLimits
} from './compiler-project-declaration-emission.js';

const SOURCE_PATH = SOURCE_ORIGIN_CORRELATION_FIXTURE_SOURCE_PATH;

interface Fixture extends SourceOriginCorrelationFixture {
	readonly inputs: CompilerProjectDeclarationEmissionInputs;
}

function compilerProgramLimits(
	overrides: Partial<CompilerProjectProgramLimits> = {}
): CompilerProjectProgramLimits {
	return {
		maxDurationMs: 60_000,
		maxProgramInputRecords: 100_000,
		maxProgramReadBytes: 16 * 1024 * 1024,
		maxProgramSourceFiles: 10_000,
		maxTotalInputRecords: 100_000,
		maxTotalReadBytes: 16 * 1024 * 1024,
		...overrides
	};
}

function emissionLimits(
	overrides: Partial<CompilerProjectDeclarationEmissionLimits> = {}
): CompilerProjectDeclarationEmissionLimits {
	return {
		maxDurationMs: 60_000,
		maxInputRecords: 100_000,
		maxOutputBytes: 4 * 1024 * 1024,
		maxOutputFiles: 2,
		maxOutputStringCharacters: 4 * 1024 * 1024,
		maxPathCharacters: 4_096,
		maxProgramSourceFiles: 10_000,
		maxReadBytes: 16 * 1024 * 1024,
		maxTraversalSteps: 1_000_000,
		...overrides
	};
}

function createFixture(): Fixture {
	const base = createSourceOriginCorrelationFixture();
	return {
		...base,
		inputs: {
			compilerProgramLimits: compilerProgramLimits(),
			frozenSubject: base.frozenSubject,
			logicalPath: base.sourcePath,
			semanticProgramId: base.semanticProgramId,
			semanticProjectId: base.semanticProjectId,
			semanticSnapshot: base.semanticSnapshot,
			semanticSourceId: base.semanticSourceId
		}
	};
}

function errorOf(action: () => unknown): CompilerProjectDeclarationEmissionError {
	try {
		action();
	} catch (error) {
		if (error instanceof CompilerProjectDeclarationEmissionError) return error;
		throw error;
	}
	throw new Error('Expected CompilerProjectDeclarationEmissionError.');
}

function outputPaths(sourceFileName: string): {
	readonly declaration: string;
	readonly map: string;
} {
	const declaration = sourceFileName.replace(/([\\/])src\1index\.ts$/u, '$1dist$1index.d.ts');
	if (declaration === sourceFileName) throw new Error('Fixture source path is unexpected.');
	return { declaration, map: `${declaration}.map` };
}

function mockFinalizedEvidence(
	transform: (evidence: CompilerProjectProgramEvidence) => CompilerProjectProgramEvidence
) {
	const createSession =
		compilerProjectDeclarationEmissionCompilerProgramCapability.createCompilerProjectProgramSession;
	return vi
		.spyOn(
			compilerProjectDeclarationEmissionCompilerProgramCapability,
			'createCompilerProjectProgramSession'
		)
		.mockImplementation((snapshot, configPath, limits, runtime) => {
			const session = createSession(snapshot, configPath, limits, runtime);
			return Object.freeze({
				...session,
				finalize: () => transform(session.finalize())
			});
		});
}

describe('compiler project declaration emission capability', () => {
	let fixture: Fixture;

	beforeAll(() => {
		fixture = createFixture();
	}, 60_000);

	afterEach(() => {
		vi.restoreAllMocks();
	});

	afterAll(() => {
		fixture.cleanup();
	});

	it('emits one exact UTF-8 declaration/map pair from a fresh captured public Program', () => {
		let checkpoints = 0;
		let inputCallbacks = 0;
		const result = emitCompilerProjectDeclaration(fixture.inputs, emissionLimits(), {
			checkpoint: () => {
				checkpoints += 1;
			},
			onInput: () => {
				inputCallbacks += 1;
			}
		});

		expect(result.outputs.map((output) => output.kind)).toEqual(['DECLARATION_MAP', 'DECLARATION']);
		expect(result.outputs.every((output) => output.writeByteOrderMark === false)).toBe(true);
		expect(result.outputs.every((output) => /^[a-f0-9]{64}$/u.test(output.contentSha256))).toBe(
			true
		);
		expect(result.outputs.find((output) => output.kind === 'DECLARATION')?.content).toContain(
			'export interface Cap014FixtureRecord'
		);
		expect(JSON.parse(result.outputs[0]!.content)).toMatchObject({
			file: 'index.d.ts',
			version: 3
		});
		expect(result.materializedSource).toMatchObject({
			logicalPath: SOURCE_PATH,
			semanticSourceId: fixture.inputs.semanticSourceId
		});
		expect(result.materializedSource.text).toContain('CAP014_FIXTURE_VALUE');
		expect(result.materializedSource.text.length).toBe(result.materializedSource.textLength);
		expect(result.emissionWitness).toMatchObject({
			attributedCompilerInputAttempts: expect.any(Number),
			attributedProgramReadBytes: expect.any(Number),
			compilerVersion: ts.version,
			declarationEmitCallbacksUseOnlyAttributedQueries: true,
			declarationEmitCompilerInputAttempts: expect.any(Number),
			declarationEmitReadBytes: expect.any(Number),
			emitApi: 'TYPESCRIPT_PUBLIC_PROGRAM_EMIT',
			emitDiagnostics: [],
			emitOnlyDtsFiles: true,
			emitSkipped: false,
			programCallbacksWithinAttributedInvocationBounds: true,
			programCompilerInputAttempts: inputCallbacks,
			programInputAttemptPopulationReconciles: true,
			programSourceFilePopulationReconciles: true,
			selectedSourceLogicalPath: SOURCE_PATH,
			state: 'FRESH_PUBLIC_TYPESCRIPT_DECLARATION_EMISSION_OVER_VERIFIED_PROJECT_SCOPED_CAPTURE'
		});
		expect(result.emissionWitness.declarationEmitCompilerInputAttempts).toBeGreaterThan(0);
		expect(result.emissionWitness.outputs).toBe(result.outputs);
		expect(result.emissionWitness.programInputAttemptPopulationDigest).toMatch(/^[a-f0-9]{64}$/u);
		expect(result.emissionWitness.programSourcePopulationDigest).toMatch(/^[a-f0-9]{64}$/u);
		expect(result.emissionWitness).not.toHaveProperty('inputRecords');
		expect(result.emissionWitness.programReadBytes).toBeGreaterThan(0);
		expect(result.emissionWitness.programPresentReadFileAttempts).toBeGreaterThan(0);
		expect(checkpoints).toBeGreaterThan(0);
		expect(Object.isFrozen(result)).toBe(true);
		expect(Object.isFrozen(result.outputs)).toBe(true);
		expect(Object.isFrozen(result.emissionWitness)).toBe(true);
		expect(Object.isFrozen(result.materializedSource)).toBe(true);
	});

	it('accepts an emitter source object with different identity but the exact selected logical path', () => {
		vi.spyOn(compilerProjectDeclarationEmissionTypeScriptPublicApi, 'emit').mockImplementation(
			(_program, sourceFile, writeFile) => {
				const paths = outputPaths(sourceFile.fileName);
				const logicalTwin = { fileName: sourceFile.fileName } as ts.SourceFile;
				writeFile(paths.map, '{"version":3}\n', false, undefined, [logicalTwin]);
				writeFile(paths.declaration, 'export {};\n', false, undefined, [logicalTwin]);
				return { diagnostics: [], emitSkipped: false } as ts.EmitResult;
			}
		);

		const result = emitCompilerProjectDeclaration(fixture.inputs, emissionLimits());
		expect(result.outputs).toHaveLength(2);
		expect(result.emissionWitness.selectedSourceLogicalPath).toBe(SOURCE_PATH);
	});

	it('uses the exact canonical Program-source and private input-attempt population digests', () => {
		const createSession =
			compilerProjectDeclarationEmissionCompilerProgramCapability.createCompilerProjectProgramSession;
		let finalizedEvidence: CompilerProjectProgramEvidence | undefined;
		vi.spyOn(
			compilerProjectDeclarationEmissionCompilerProgramCapability,
			'createCompilerProjectProgramSession'
		).mockImplementation((snapshot, configPath, limits, runtime) => {
			const session = createSession(snapshot, configPath, limits, runtime);
			return Object.freeze({
				...session,
				finalize() {
					const evidence = session.finalize();
					finalizedEvidence = evidence;
					return evidence;
				}
			});
		});

		const result = emitCompilerProjectDeclaration(fixture.inputs, emissionLimits());
		if (finalizedEvidence === undefined) throw new Error('Provider did not finalize its Program.');
		const programSources: SourceOriginProgramSourceIdentity[] = fixture.semanticSnapshot.sources
			.filter((source) => source.programId === fixture.semanticProgramId)
			.map((source) => ({
				bytes: source.bytes,
				contentSha256: source.contentSha256,
				declarationFile: source.declarationFile,
				logicalPath: source.logicalPath,
				origin: source.origin,
				semanticSourceId: source.id
			}));
		programSources.sort((left, right) =>
			left.logicalPath < right.logicalPath
				? -1
				: left.logicalPath > right.logicalPath
					? 1
					: left.semanticSourceId < right.semanticSourceId
						? -1
						: left.semanticSourceId > right.semanticSourceId
							? 1
							: 0
		);
		expect(result.emissionWitness.programInputAttemptPopulationDigest).toBe(
			sourceOriginProgramInputAttemptPopulationDigest(finalizedEvidence.inputRecords)
		);
		expect(result.emissionWitness.programSourcePopulationDigest).toBe(
			sourceOriginProgramSourcePopulationDigest(programSources)
		);
		expect(result.emissionWitness.programCompilerInputAttempts).toBe(
			finalizedEvidence.compilerHostCallbacks
		);
		expect(result.emissionWitness.declarationEmitCompilerInputAttempts).toBe(
			finalizedEvidence.declarationEmitInputRecords
		);
		expect(result.emissionWitness).not.toHaveProperty('inputRecords');
	});

	it('sorts and digests a reconciled multi-source Program population canonically', () => {
		const selected = fixture.semanticSnapshot.sources.find(
			(candidate) => candidate.id === fixture.semanticSourceId
		)!;
		const project = fixture.semanticSnapshot.projects.find(
			(candidate) => candidate.id === fixture.semanticProjectId
		)!;
		const program = fixture.semanticSnapshot.programs.find(
			(candidate) => candidate.id === fixture.semanticProgramId
		)!;
		const extra = Object.freeze({
			...selected,
			id: `${selected.id}:extra` as typeof selected.id,
			logicalPath: 'packages/origin/src/aaa.ts',
			rootFile: false
		});
		const snapshot = Object.freeze({
			...fixture.semanticSnapshot,
			programs: Object.freeze(
				fixture.semanticSnapshot.programs.map((candidate) =>
					candidate === program
						? Object.freeze({
								...candidate,
								sourceIds: Object.freeze([...candidate.sourceIds, extra.id])
							})
						: candidate
				)
			),
			projects: Object.freeze(
				fixture.semanticSnapshot.projects.map((candidate) =>
					candidate === project
						? Object.freeze({
								...candidate,
								sourceIds: Object.freeze([...candidate.sourceIds, extra.id])
							})
						: candidate
				)
			),
			sources: Object.freeze([...fixture.semanticSnapshot.sources, extra])
		}) as StaticSemanticSnapshot;
		const createSession =
			compilerProjectDeclarationEmissionCompilerProgramCapability.createCompilerProjectProgramSession;
		vi.spyOn(
			compilerProjectDeclarationEmissionCompilerProgramCapability,
			'createCompilerProjectProgramSession'
		).mockImplementation((_snapshot, configPath, limits, runtime) => {
			const session = createSession(fixture.semanticSnapshot, configPath, limits, runtime);
			return Object.freeze({
				...session,
				finalize: () => Object.freeze({ ...session.finalize(), programSourceFiles: 2 }),
				toLogicalPath(path: string) {
					return path === extra.logicalPath ? extra.logicalPath : session.toLogicalPath(path);
				}
			});
		});
		const getSourceFiles = compilerProjectDeclarationEmissionTypeScriptPublicApi.getSourceFiles;
		vi.spyOn(
			compilerProjectDeclarationEmissionTypeScriptPublicApi,
			'getSourceFiles'
		).mockImplementation((nativeProgram) => [
			...getSourceFiles(nativeProgram),
			{
				fileName: extra.logicalPath,
				isDeclarationFile: false,
				text: selected.textLength
			} as unknown as ts.SourceFile
		]);

		const result = emitCompilerProjectDeclaration(
			{ ...fixture.inputs, semanticSnapshot: snapshot },
			emissionLimits()
		);
		expect(result.emissionWitness.programSourceFiles).toBe(2);
		expect(result.emissionWitness.programSourcePopulationDigest).toBe(
			sourceOriginProgramSourcePopulationDigest([
				{
					bytes: extra.bytes,
					contentSha256: extra.contentSha256,
					declarationFile: extra.declarationFile,
					logicalPath: extra.logicalPath,
					origin: extra.origin,
					semanticSourceId: extra.id
				},
				{
					bytes: selected.bytes,
					contentSha256: selected.contentSha256,
					declarationFile: selected.declarationFile,
					logicalPath: selected.logicalPath,
					origin: selected.origin,
					semanticSourceId: selected.id
				}
			])
		);
	});

	it('refuses invalid capture/selection and requires an authored root non-declaration source', () => {
		expect(
			errorOf(() =>
				emitCompilerProjectDeclaration(
					{ ...fixture.inputs, semanticSourceId: 'semantic-source:missing' },
					emissionLimits()
				)
			).code
		).toBe('SELECTION_UNAVAILABLE');
		expect(
			errorOf(() =>
				emitCompilerProjectDeclaration(
					{ ...fixture.inputs, logicalPath: 'packages/demo/src/missing.ts' },
					emissionLimits()
				)
			).code
		).toBe('SELECTION_UNAVAILABLE');
		expect(
			errorOf(() =>
				emitCompilerProjectDeclaration(
					{ ...fixture.inputs, frozenSubject: structuredClone(fixture.frozenSubject) },
					emissionLimits()
				)
			).code
		).toBe('CAPTURE_UNAVAILABLE');

		const nonRoot = Object.freeze({
			...fixture.semanticSnapshot,
			sources: Object.freeze(
				fixture.semanticSnapshot.sources.map((source) =>
					source.id === fixture.inputs.semanticSourceId
						? Object.freeze({ ...source, rootFile: false as const })
						: source
				)
			)
		}) as StaticSemanticSnapshot;
		expect(
			errorOf(() =>
				emitCompilerProjectDeclaration(
					{ ...fixture.inputs, semanticSnapshot: nonRoot },
					emissionLimits()
				)
			).code
		).toBe('SELECTION_UNAVAILABLE');
	});

	it('rejects hostile and malformed input, limit, runtime, and clock ingress', () => {
		const { logicalPath: _logicalPath, ...withoutLogicalPath } = fixture.inputs;
		const sameSizeUnknownKey = { ...withoutLogicalPath, unknown: SOURCE_PATH };
		const accessorInputs = { ...fixture.inputs };
		let accessorReads = 0;
		Object.defineProperty(accessorInputs, 'logicalPath', {
			enumerable: true,
			get() {
				accessorReads += 1;
				return SOURCE_PATH;
			}
		});
		for (const invalid of [
			null,
			[],
			new Proxy({}, {}),
			{ ...fixture.inputs, extra: true },
			sameSizeUnknownKey,
			accessorInputs
		])
			expect(errorOf(() => emitCompilerProjectDeclaration(invalid, emissionLimits())).code).toBe(
				'INPUT_INVALID'
			);
		expect(accessorReads).toBe(0);
		for (const logicalPath of ['', '\ud800'])
			expect(
				errorOf(() =>
					emitCompilerProjectDeclaration({ ...fixture.inputs, logicalPath }, emissionLimits())
				).code
			).toBe('INPUT_INVALID');
		expect(
			errorOf(() =>
				emitCompilerProjectDeclaration(
					{ ...fixture.inputs, semanticSnapshot: { ...fixture.semanticSnapshot } },
					emissionLimits()
				)
			).code
		).toBe('CAPTURE_UNAVAILABLE');
		expect(
			errorOf(() =>
				emitCompilerProjectDeclaration(fixture.inputs, emissionLimits({ maxOutputBytes: -1 }))
			).code
		).toBe('INPUT_INVALID');
		expect(
			errorOf(() =>
				emitCompilerProjectDeclaration(fixture.inputs, emissionLimits({ maxDurationMs: 0 }))
			).code
		).toBe('INPUT_INVALID');

		const runtimeAccessor = {};
		Object.defineProperty(runtimeAccessor, 'now', {
			enumerable: true,
			get() {
				accessorReads += 1;
				return () => 0;
			}
		});
		for (const runtime of [
			null,
			{ checkpoint() {}, now() {}, onInput() {}, extra() {} },
			{ unknown() {} },
			{ now: 0 },
			runtimeAccessor
		])
			expect(
				errorOf(() => emitCompilerProjectDeclaration(fixture.inputs, emissionLimits(), runtime))
					.code
			).toBe('INPUT_INVALID');
		expect(accessorReads).toBe(0);
		expect(
			errorOf(() =>
				emitCompilerProjectDeclaration(fixture.inputs, emissionLimits(), {
					now: () => {
						throw new Error('clock fault');
					}
				})
			).code
		).toBe('BUDGET_EXCEEDED');
		expect(
			errorOf(() =>
				emitCompilerProjectDeclaration(fixture.inputs, emissionLimits(), { now: () => -1 })
			).code
		).toBe('BUDGET_EXCEEDED');
		let clockReads = 0;
		expect(
			errorOf(() =>
				emitCompilerProjectDeclaration(fixture.inputs, emissionLimits({ maxDurationMs: 1 }), {
					now: () => (clockReads++ === 0 ? 0 : 1)
				})
			).code
		).toBe('BUDGET_EXCEEDED');
	});

	it('maps every compiler-session capability failure code to a typed provider refusal', () => {
		for (const [sessionCode, providerCode] of [
			['BUDGET_EXCEEDED', 'BUDGET_EXCEEDED'],
			['INPUT_INVALID', 'INPUT_INVALID'],
			['CAPTURE_UNAVAILABLE', 'CAPTURE_UNAVAILABLE'],
			['PROGRAM_UNAVAILABLE', 'PROVIDER_FAILURE']
		] as const) {
			const spy = vi
				.spyOn(
					compilerProjectDeclarationEmissionCompilerProgramCapability,
					'createCompilerProjectProgramSession'
				)
				.mockImplementationOnce(() => {
					throw new CompilerProjectProgramCapabilityError(sessionCode, 'session refusal');
				});
			expect(
				errorOf(() => emitCompilerProjectDeclaration(fixture.inputs, emissionLimits())).code
			).toBe(providerCode);
			spy.mockRestore();
		}
	});

	it('preflights snapshot populations and rejects inconsistent semantic source populations', () => {
		const hugeProjects = Object.freeze(
			new Array(1_000_001)
		) as unknown as StaticSemanticSnapshot['projects'];
		const hugeSnapshot = Object.freeze({
			...fixture.semanticSnapshot,
			projects: hugeProjects
		}) as StaticSemanticSnapshot;
		expect(
			errorOf(() =>
				emitCompilerProjectDeclaration(
					{ ...fixture.inputs, semanticSnapshot: hugeSnapshot },
					emissionLimits({ maxInputRecords: Number.MAX_SAFE_INTEGER })
				)
			).code
		).toBe('BUDGET_EXCEEDED');

		const wrongSubject = Object.freeze({
			...fixture.semanticSnapshot,
			subjectId: `${fixture.semanticSnapshot.subjectId}:wrong`
		}) as StaticSemanticSnapshot;
		expect(
			errorOf(() =>
				emitCompilerProjectDeclaration(
					{ ...fixture.inputs, semanticSnapshot: wrongSubject },
					emissionLimits()
				)
			).code
		).toBe('CAPTURE_UNAVAILABLE');

		const project = fixture.semanticSnapshot.projects.find(
			(candidate) => candidate.id === fixture.semanticProjectId
		)!;
		const inconsistentProject = Object.freeze({
			...fixture.semanticSnapshot,
			projects: Object.freeze(
				fixture.semanticSnapshot.projects.map((candidate) =>
					candidate === project
						? Object.freeze({ ...candidate, programId: 'semantic-program:wrong' })
						: candidate
				)
			)
		}) as StaticSemanticSnapshot;
		expect(
			errorOf(() =>
				emitCompilerProjectDeclaration(
					{ ...fixture.inputs, semanticSnapshot: inconsistentProject },
					emissionLimits()
				)
			).code
		).toBe('SELECTION_UNAVAILABLE');

		const selected = fixture.semanticSnapshot.sources.find(
			(candidate) => candidate.id === fixture.semanticSourceId
		)!;
		for (const [extra, expectedCode] of [
			[
				Object.freeze({ ...selected, id: `${selected.id}:other-program`, programId: 'other' }),
				'CAPTURE_UNAVAILABLE'
			],
			[
				Object.freeze({
					...selected,
					id: `${selected.id}:long`,
					logicalPath: 'x'.repeat(4_097)
				}),
				'CAPTURE_UNAVAILABLE'
			],
			[Object.freeze({ ...selected, id: `${selected.id}:duplicate` }), 'CAPTURE_UNAVAILABLE'],
			[
				Object.freeze({
					...selected,
					id: `${selected.id}:extra`,
					logicalPath: 'packages/origin/src/extra.ts'
				}),
				'CAPTURE_UNAVAILABLE'
			]
		] as const) {
			const snapshot = Object.freeze({
				...fixture.semanticSnapshot,
				sources: Object.freeze([...fixture.semanticSnapshot.sources, extra])
			}) as StaticSemanticSnapshot;
			expect(
				errorOf(() =>
					emitCompilerProjectDeclaration(
						{ ...fixture.inputs, semanticSnapshot: snapshot },
						emissionLimits()
					)
				).code
			).toBe(expectedCode);
		}
	});

	it('refuses every unsupported compiler-option precondition', () => {
		const cases: ReadonlyArray<Readonly<Partial<ts.CompilerOptions>>> = [
			{ declaration: false },
			{ declarationMap: false },
			{ noEmit: true },
			{ outFile: 'dist/all.d.ts' }
		];
		for (const override of cases) {
			const spy = vi
				.spyOn(compilerProjectDeclarationEmissionTypeScriptPublicApi, 'getCompilerOptions')
				.mockImplementation((program) => ({ ...program.getCompilerOptions(), ...override }));
			expect(
				errorOf(() => emitCompilerProjectDeclaration(fixture.inputs, emissionLimits())).code
			).toBe('OPTIONS_UNSUPPORTED');
			spy.mockRestore();
		}
	});

	it('copies nested compiler-option values and refuses non-semantic nested containers', () => {
		const getCompilerOptions =
			compilerProjectDeclarationEmissionTypeScriptPublicApi.getCompilerOptions;
		const validSpy = vi
			.spyOn(compilerProjectDeclarationEmissionTypeScriptPublicApi, 'getCompilerOptions')
			.mockImplementation((program) => ({
				...getCompilerOptions(program),
				paths: { '@fixture/*': ['src/*'] }
			}));
		expect(emitCompilerProjectDeclaration(fixture.inputs, emissionLimits()).outputs).toHaveLength(
			2
		);
		validSpy.mockRestore();

		const cycle: Record<string, unknown> = {};
		cycle.self = cycle;
		const tooManyNestedKeys = Object.fromEntries(
			Array.from({ length: 513 }, (_, index) => [`key${index}`, index])
		);
		const symbolNested = { [Symbol('hostile')]: true };
		const invalidValues: readonly unknown[] = [
			'\ud800',
			Number.NaN,
			() => undefined,
			cycle,
			new Date(0),
			tooManyNestedKeys,
			symbolNested
		];
		for (const invalidValue of invalidValues) {
			const spy = vi
				.spyOn(compilerProjectDeclarationEmissionTypeScriptPublicApi, 'getCompilerOptions')
				.mockImplementation(
					(program) =>
						({
							...getCompilerOptions(program),
							hostileNested: invalidValue
						}) as unknown as ts.CompilerOptions
				);
			expect(
				errorOf(() => emitCompilerProjectDeclaration(fixture.inputs, emissionLimits())).code
			).toBe('PROVIDER_FAILURE');
			spy.mockRestore();
		}
		for (const invalidOptions of [
			[],
			Object.fromEntries(Array.from({ length: 513 }, (_, index) => [`key${index}`, index])),
			{ [Symbol('hostile')]: true }
		]) {
			const spy = vi
				.spyOn(compilerProjectDeclarationEmissionTypeScriptPublicApi, 'getCompilerOptions')
				.mockReturnValue(invalidOptions as ts.CompilerOptions);
			expect(
				errorOf(() => emitCompilerProjectDeclaration(fixture.inputs, emissionLimits())).code
			).toBe('PROVIDER_FAILURE');
			spy.mockRestore();
		}
	});

	it('refuses skipped/diagnostic provider results and thrown provider calls', () => {
		vi.spyOn(compilerProjectDeclarationEmissionTypeScriptPublicApi, 'emit').mockReturnValueOnce({
			diagnostics: [],
			emitSkipped: true
		} as ts.EmitResult);
		expect(
			errorOf(() => emitCompilerProjectDeclaration(fixture.inputs, emissionLimits())).code
		).toBe('EMIT_UNAVAILABLE');

		vi.spyOn(compilerProjectDeclarationEmissionTypeScriptPublicApi, 'emit').mockReturnValueOnce({
			diagnostics: [{} as ts.Diagnostic],
			emitSkipped: false
		} as ts.EmitResult);
		expect(
			errorOf(() => emitCompilerProjectDeclaration(fixture.inputs, emissionLimits())).code
		).toBe('EMIT_UNAVAILABLE');

		vi.spyOn(
			compilerProjectDeclarationEmissionTypeScriptPublicApi,
			'getSourceFiles'
		).mockImplementationOnce(() => {
			throw new Error('provider fault');
		});
		expect(
			errorOf(() => emitCompilerProjectDeclaration(fixture.inputs, emissionLimits())).code
		).toBe('PROVIDER_FAILURE');
	});

	it('descriptor-checks hostile public TypeScript return containers without invoking accessors', () => {
		const getSourceFiles = compilerProjectDeclarationEmissionTypeScriptPublicApi.getSourceFiles;
		let sourceIndexReads = 0;
		const sourceFilesSpy = vi
			.spyOn(compilerProjectDeclarationEmissionTypeScriptPublicApi, 'getSourceFiles')
			.mockImplementation((program) => {
				const sources = [...getSourceFiles(program)];
				Object.defineProperty(sources, '0', {
					enumerable: true,
					get() {
						sourceIndexReads += 1;
						throw new Error('source index accessor');
					}
				});
				return sources;
			});
		expect(
			errorOf(() => emitCompilerProjectDeclaration(fixture.inputs, emissionLimits())).code
		).toBe('PROVIDER_FAILURE');
		expect(sourceIndexReads).toBe(0);
		sourceFilesSpy.mockRestore();

		for (const extraKey of ['extra', Symbol('extra')]) {
			const extraPropertySpy = vi
				.spyOn(compilerProjectDeclarationEmissionTypeScriptPublicApi, 'getSourceFiles')
				.mockImplementation((program) => {
					const sources = [...getSourceFiles(program)];
					Object.defineProperty(sources, extraKey, {
						configurable: true,
						value: true
					});
					return sources;
				});
			expect(
				errorOf(() => emitCompilerProjectDeclaration(fixture.inputs, emissionLimits())).code
			).toBe('PROVIDER_FAILURE');
			extraPropertySpy.mockRestore();
		}

		const getCompilerOptions =
			compilerProjectDeclarationEmissionTypeScriptPublicApi.getCompilerOptions;
		let compilerOptionReads = 0;
		const compilerOptionsSpy = vi
			.spyOn(compilerProjectDeclarationEmissionTypeScriptPublicApi, 'getCompilerOptions')
			.mockImplementation((program) => {
				const options = { ...getCompilerOptions(program) };
				Object.defineProperty(options, 'declaration', {
					enumerable: true,
					get() {
						compilerOptionReads += 1;
						throw new Error('compiler option accessor');
					}
				});
				return options as ts.CompilerOptions;
			});
		expect(
			errorOf(() => emitCompilerProjectDeclaration(fixture.inputs, emissionLimits())).code
		).toBe('PROVIDER_FAILURE');
		expect(compilerOptionReads).toBe(0);
		compilerOptionsSpy.mockRestore();

		const nestedCompilerOptionsSpy = vi
			.spyOn(compilerProjectDeclarationEmissionTypeScriptPublicApi, 'getCompilerOptions')
			.mockImplementation((program) => {
				const options = { ...getCompilerOptions(program) } as ts.CompilerOptions & {
					hostileNested?: object;
				};
				const nested = {};
				Object.defineProperty(nested, 'value', {
					enumerable: true,
					get() {
						compilerOptionReads += 1;
						throw new Error('nested compiler option accessor');
					}
				});
				options.hostileNested = nested;
				return options;
			});
		expect(
			errorOf(() => emitCompilerProjectDeclaration(fixture.inputs, emissionLimits())).code
		).toBe('PROVIDER_FAILURE');
		expect(compilerOptionReads).toBe(0);
		nestedCompilerOptionsSpy.mockRestore();

		let outputSourceIndexReads = 0;
		const writeFileSourcesSpy = vi
			.spyOn(compilerProjectDeclarationEmissionTypeScriptPublicApi, 'emit')
			.mockImplementation((_program, sourceFile, writeFile) => {
				const paths = outputPaths(sourceFile.fileName);
				const hostileSources = [sourceFile];
				Object.defineProperty(hostileSources, '0', {
					enumerable: true,
					get() {
						outputSourceIndexReads += 1;
						throw new Error('output source index accessor');
					}
				});
				writeFile(paths.map, '{"version":3}\n', false, undefined, hostileSources);
				return { diagnostics: [], emitSkipped: false } as ts.EmitResult;
			});
		expect(
			errorOf(() => emitCompilerProjectDeclaration(fixture.inputs, emissionLimits())).code
		).toBe('EMIT_UNAVAILABLE');
		expect(outputSourceIndexReads).toBe(0);
		writeFileSourcesSpy.mockRestore();

		let emitResultReads = 0;
		const emitResultSpy = vi
			.spyOn(compilerProjectDeclarationEmissionTypeScriptPublicApi, 'emit')
			.mockImplementation((_program, sourceFile, writeFile) => {
				const paths = outputPaths(sourceFile.fileName);
				writeFile(paths.map, '{"version":3}\n', false, undefined, [sourceFile]);
				writeFile(paths.declaration, 'export {};\n', false, undefined, [sourceFile]);
				const result = { diagnostics: [] };
				Object.defineProperty(result, 'emitSkipped', {
					enumerable: true,
					get() {
						emitResultReads += 1;
						throw new Error('emit result accessor');
					}
				});
				return result as unknown as ts.EmitResult;
			});
		expect(
			errorOf(() => emitCompilerProjectDeclaration(fixture.inputs, emissionLimits())).code
		).toBe('PROVIDER_FAILURE');
		expect(emitResultReads).toBe(0);
		emitResultSpy.mockRestore();

		let diagnosticReads = 0;
		vi.spyOn(compilerProjectDeclarationEmissionTypeScriptPublicApi, 'emit').mockImplementation(
			(_program, sourceFile, writeFile) => {
				const paths = outputPaths(sourceFile.fileName);
				writeFile(paths.map, '{"version":3}\n', false, undefined, [sourceFile]);
				writeFile(paths.declaration, 'export {};\n', false, undefined, [sourceFile]);
				const diagnostics: ts.Diagnostic[] = [];
				Object.defineProperty(diagnostics, '0', {
					enumerable: true,
					get() {
						diagnosticReads += 1;
						throw new Error('diagnostic accessor');
					}
				});
				return { diagnostics, emitSkipped: false };
			}
		);
		expect(
			errorOf(() => emitCompilerProjectDeclaration(fixture.inputs, emissionLimits())).code
		).toBe('EMIT_UNAVAILABLE');
		expect(diagnosticReads).toBe(0);
	});

	it('refuses malformed Program source populations and logical-path reconciliation', () => {
		const getSourceFiles = compilerProjectDeclarationEmissionTypeScriptPublicApi.getSourceFiles;
		const createSession =
			compilerProjectDeclarationEmissionCompilerProgramCapability.createCompilerProjectProgramSession;
		const runSources = (
			produce: (program: ts.Program) => readonly ts.SourceFile[],
			limits = emissionLimits()
		): CompilerProjectDeclarationEmissionError => {
			const spy = vi
				.spyOn(compilerProjectDeclarationEmissionTypeScriptPublicApi, 'getSourceFiles')
				.mockImplementation(produce);
			const error = errorOf(() => emitCompilerProjectDeclaration(fixture.inputs, limits));
			spy.mockRestore();
			return error;
		};
		expect(
			runSources(
				(program) => [...getSourceFiles(program), { fileName: 'extra.ts' } as ts.SourceFile],
				emissionLimits({ maxProgramSourceFiles: 1 })
			).code
		).toBe('BUDGET_EXCEEDED');
		expect(runSources(() => [{ fileName: '' } as ts.SourceFile]).code).toBe('PROVIDER_FAILURE');
		expect(runSources(() => []).code).toBe('SELECTION_UNAVAILABLE');

		const nativeSources = getSourceFiles(
			createSession(
				fixture.semanticSnapshot,
				fixture.semanticSnapshot.projects[0]!.configPath,
				compilerProgramLimits()
			).program
		);
		const nativeSelected = nativeSources.find((source) => source.fileName.endsWith('index.ts'))!;
		expect(
			runSources(() => [
				{
					fileName: nativeSelected.fileName,
					isDeclarationFile: true,
					text: nativeSelected.text
				} as ts.SourceFile
			]).code
		).toBe('SELECTION_UNAVAILABLE');
		expect(
			runSources(() => [
				{
					fileName: nativeSelected.fileName,
					isDeclarationFile: false,
					text: ''
				} as ts.SourceFile
			]).code
		).toBe('CAPTURE_UNAVAILABLE');
		const alteredText = `${nativeSelected.text[0] === 'x' ? 'y' : 'x'}${nativeSelected.text.slice(1)}`;
		expect(
			runSources(() => [
				{
					fileName: nativeSelected.fileName,
					isDeclarationFile: false,
					text: alteredText
				} as ts.SourceFile
			]).code
		).toBe('CAPTURE_UNAVAILABLE');
		expect(runSources(() => [nativeSelected, nativeSelected]).code).toBe('CAPTURE_UNAVAILABLE');

		const logicalSpy = vi
			.spyOn(
				compilerProjectDeclarationEmissionCompilerProgramCapability,
				'createCompilerProjectProgramSession'
			)
			.mockImplementation((snapshot, configPath, limits, runtime) => {
				const session = createSession(snapshot, configPath, limits, runtime);
				return Object.freeze({ ...session, toLogicalPath: () => '' });
			});
		expect(
			errorOf(() => emitCompilerProjectDeclaration(fixture.inputs, emissionLimits())).code
		).toBe('CAPTURE_UNAVAILABLE');
		logicalSpy.mockRestore();

		const extraPath = 'packages/origin/src/extra.ts';
		const populationSpy = vi
			.spyOn(
				compilerProjectDeclarationEmissionCompilerProgramCapability,
				'createCompilerProjectProgramSession'
			)
			.mockImplementation((snapshot, configPath, limits, runtime) => {
				const session = createSession(snapshot, configPath, limits, runtime);
				return Object.freeze({
					...session,
					toLogicalPath: (path: string) =>
						path === extraPath ? extraPath : session.toLogicalPath(path)
				});
			});
		const populationSourcesSpy = vi
			.spyOn(compilerProjectDeclarationEmissionTypeScriptPublicApi, 'getSourceFiles')
			.mockImplementation((program) => [
				...getSourceFiles(program),
				{ fileName: extraPath } as ts.SourceFile
			]);
		expect(
			errorOf(() => emitCompilerProjectDeclaration(fixture.inputs, emissionLimits())).code
		).toBe('CAPTURE_UNAVAILABLE');
		populationSourcesSpy.mockRestore();
		populationSpy.mockRestore();
	});

	it('counts and hashes scalar UTF-8 output incrementally and rejects lone surrogates', () => {
		const spy = vi
			.spyOn(compilerProjectDeclarationEmissionTypeScriptPublicApi, 'emit')
			.mockImplementation((_program, sourceFile, writeFile) => {
				const paths = outputPaths(sourceFile.fileName);
				writeFile(paths.map, '{"version":3}\n', false, undefined, [sourceFile]);
				writeFile(
					paths.declaration,
					`// é中😀${'x'.repeat(5_000)}\nexport {};\n`,
					false,
					undefined,
					[sourceFile]
				);
				return { diagnostics: [], emitSkipped: false };
			});
		const result = emitCompilerProjectDeclaration(fixture.inputs, emissionLimits());
		const declaration = result.outputs.find((output) => output.kind === 'DECLARATION')!;
		expect(declaration.bytes).toBe(Buffer.byteLength(declaration.content, 'utf8'));
		spy.mockRestore();

		for (const surrogate of ['\ud800', '\udc00']) {
			const surrogateSpy = vi
				.spyOn(compilerProjectDeclarationEmissionTypeScriptPublicApi, 'emit')
				.mockImplementation((_program, sourceFile, writeFile) => {
					const paths = outputPaths(sourceFile.fileName);
					writeFile(paths.map, '{"version":3}\n', false, undefined, [sourceFile]);
					writeFile(paths.declaration, surrogate, false, undefined, [sourceFile]);
					return { diagnostics: [], emitSkipped: false };
				});
			expect(
				errorOf(() => emitCompilerProjectDeclaration(fixture.inputs, emissionLimits())).code
			).toBe('EMIT_UNAVAILABLE');
			surrogateSpy.mockRestore();
		}
	});

	it('descriptor-checks and validates finalized session evidence before semantic inspection', () => {
		const createSession =
			compilerProjectDeclarationEmissionCompilerProgramCapability.createCompilerProjectProgramSession;
		let evidenceReads = 0;
		const accessorSpy = vi
			.spyOn(
				compilerProjectDeclarationEmissionCompilerProgramCapability,
				'createCompilerProjectProgramSession'
			)
			.mockImplementation((snapshot, configPath, limits, runtime) => {
				const session = createSession(snapshot, configPath, limits, runtime);
				return Object.freeze({
					...session,
					finalize() {
						const evidence = { ...session.finalize() };
						Object.defineProperty(evidence, 'subjectId', {
							enumerable: true,
							get() {
								evidenceReads += 1;
								throw new Error('evidence accessor');
							}
						});
						return evidence as unknown as CompilerProjectProgramEvidence;
					}
				});
			});
		expect(
			errorOf(() => emitCompilerProjectDeclaration(fixture.inputs, emissionLimits())).code
		).toBe('PROVIDER_FAILURE');
		expect(evidenceReads).toBe(0);
		accessorSpy.mockRestore();

		const invalidFlagSpy = vi
			.spyOn(
				compilerProjectDeclarationEmissionCompilerProgramCapability,
				'createCompilerProjectProgramSession'
			)
			.mockImplementation((snapshot, configPath, limits, runtime) => {
				const session = createSession(snapshot, configPath, limits, runtime);
				return Object.freeze({
					...session,
					finalize: () =>
						({
							...session.finalize(),
							declarationEmitCallbacksUseOnlyAttributedQueries: false
						}) as unknown as CompilerProjectProgramEvidence
				});
			});
		expect(
			errorOf(() => emitCompilerProjectDeclaration(fixture.inputs, emissionLimits())).code
		).toBe('CAPTURE_UNAVAILABLE');
		invalidFlagSpy.mockRestore();

		vi.spyOn(
			compilerProjectDeclarationEmissionCompilerProgramCapability,
			'createCompilerProjectProgramSession'
		).mockImplementation((snapshot, configPath, limits, runtime) => {
			const session = createSession(snapshot, configPath, limits, runtime);
			return Object.freeze({
				...session,
				finalize: () =>
					({
						...session.finalize(),
						declarationEmitReadBytes: -1
					}) as CompilerProjectProgramEvidence
			});
		});
		expect(
			errorOf(() => emitCompilerProjectDeclaration(fixture.inputs, emissionLimits())).code
		).toBe('CAPTURE_UNAVAILABLE');
	});

	it('descriptor-copies finalized input record, query, and observation shells without invoking accessors', () => {
		let accessorReads = 0;
		for (const target of ['RECORD', 'QUERY', 'OBSERVATION'] as const) {
			const spy = mockFinalizedEvidence((evidence) => {
				const records = [...evidence.inputRecords];
				const original = records[0]!;
				if (target === 'RECORD') {
					const record = { ...original };
					Object.defineProperty(record, 'ordinal', {
						enumerable: true,
						get() {
							accessorReads += 1;
							throw new Error('record accessor');
						}
					});
					records[0] = record;
				} else {
					const nested = {
						...(target === 'QUERY' ? original.query : original.observation)
					};
					Object.defineProperty(nested, 'operation', {
						enumerable: true,
						get() {
							accessorReads += 1;
							throw new Error('nested record accessor');
						}
					});
					records[0] = {
						...original,
						...(target === 'QUERY'
							? { query: nested as typeof original.query }
							: { observation: nested as typeof original.observation })
					};
				}
				return { ...evidence, inputRecords: records };
			});
			expect(
				errorOf(() => emitCompilerProjectDeclaration(fixture.inputs, emissionLimits())).code
			).toBe('PROVIDER_FAILURE');
			expect(accessorReads).toBe(0);
			spy.mockRestore();
		}
	});

	it('accepts every canonical test, verification, and script input origin in finalized evidence', () => {
		const origins = ['TEST', 'VERIFICATION', 'SCRIPT'] as const;
		const spy = mockFinalizedEvidence((evidence) => {
			const records = [...evidence.inputRecords];
			for (let index = 0; index < origins.length; index += 1) {
				const record = records[index]!;
				records[index] = {
					...record,
					observation: { ...record.observation, origin: origins[index]! }
				};
			}
			return { ...evidence, inputRecords: records };
		});

		const result = emitCompilerProjectDeclaration(fixture.inputs, emissionLimits());
		expect(result.emissionWitness.programInputAttemptPopulationDigest).toMatch(/^[a-f0-9]{64}$/u);
		spy.mockRestore();
	});

	it('validates every retained compiler input query/observation container variant', () => {
		const replacements: Array<
			(record: CompilerProjectProgramEvidence['inputRecords'][number]) => {
				readonly observation: unknown;
				readonly query: unknown;
			}
		> = [
			(record) => {
				const logicalPath = 'packages/origin/src';
				return {
					observation: {
						depth: null,
						excludes: ['excluded'],
						extensions: ['.ts'],
						id: record.observation.id,
						includes: ['**/*'],
						invocationCount: record.observation.invocationCount,
						logicalPath,
						operation: 'READ_DIRECTORY',
						origin: record.observation.origin,
						result: 'DIRECTORY',
						resultDigest: record.observation.resultDigest,
						resultEntries: ['index.ts'],
						scannedEntries: 1
					},
					query: {
						depth: null,
						excludes: ['excluded'],
						extensions: ['.ts'],
						includes: ['**/*'],
						logicalPath,
						operation: 'READ_DIRECTORY'
					}
				};
			},
			(record) => {
				const logicalPath = 'packages/origin/src';
				return {
					observation: {
						id: record.observation.id,
						invocationCount: record.observation.invocationCount,
						logicalPath,
						operation: 'GET_DIRECTORIES',
						origin: record.observation.origin,
						result: 'DIRECTORY',
						resultDigest: record.observation.resultDigest,
						resultEntries: ['nested'],
						scannedEntries: 1
					},
					query: { logicalPath, operation: 'GET_DIRECTORIES' }
				};
			},
			(record) => ({
				observation: {
					id: record.observation.id,
					invocationCount: record.observation.invocationCount,
					logicalPath: 'link.ts',
					operation: 'REALPATH',
					origin: record.observation.origin,
					resolvedLogicalPath: 'real.ts',
					result: 'RESOLVED',
					resultDigest: record.observation.resultDigest
				},
				query: { logicalPath: 'link.ts', operation: 'REALPATH' }
			}),
			(record) => ({
				observation: {
					id: record.observation.id,
					invocationCount: record.observation.invocationCount,
					logicalPath: '.',
					operation: 'CURRENT_DIRECTORY',
					origin: record.observation.origin,
					resolvedLogicalPath: '.',
					result: 'RESOLVED',
					resultDigest: record.observation.resultDigest
				},
				query: { logicalPath: '.', operation: 'CURRENT_DIRECTORY' }
			})
		];
		for (const replacement of replacements) {
			const spy = mockFinalizedEvidence((evidence) => {
				const records = [...evidence.inputRecords];
				const record = records[0]!;
				const next = replacement(record);
				records[0] = {
					...record,
					observation: next.observation as typeof record.observation,
					query: next.query as typeof record.query
				};
				return { ...evidence, artifactParseInputRecords: 1, inputRecords: records };
			});
			expect(
				errorOf(() => emitCompilerProjectDeclaration(fixture.inputs, emissionLimits())).code
			).toBe('CAPTURE_UNAVAILABLE');
			spy.mockRestore();
		}

		const invalidReplacements: Array<
			(record: CompilerProjectProgramEvidence['inputRecords'][number]) => {
				readonly observation: unknown;
				readonly query: unknown;
			}
		> = [
			(record) => ({
				observation: record.observation,
				query: { logicalPath: '.', operation: 'BAD' }
			}),
			(record) => ({
				observation: record.observation,
				query: { logicalPath: '', operation: 'FILE_EXISTS' }
			}),
			(record) => ({
				observation: record.observation,
				query: {
					depth: -1,
					excludes: [],
					extensions: [],
					includes: [],
					logicalPath: '.',
					operation: 'READ_DIRECTORY'
				}
			}),
			(record) => ({
				observation: {
					id: record.observation.id,
					invocationCount: record.observation.invocationCount,
					logicalPath: '.',
					operation: 'BAD',
					origin: record.observation.origin,
					result: 'BAD',
					resultDigest: record.observation.resultDigest
				},
				query: record.query
			}),
			(record) => ({
				observation: { ...record.observation, id: '' },
				query: record.query
			}),
			(record) => ({
				observation: { ...record.observation, origin: 'OUTSIDER' },
				query: record.query
			}),
			(record) => ({
				observation: {
					byteBudgetClass: 'BAD',
					contentBytes: -1,
					contentSha256: '0'.repeat(64),
					id: record.observation.id,
					invocationCount: record.observation.invocationCount,
					logicalPath: 'file.ts',
					operation: 'READ_FILE',
					origin: record.observation.origin,
					result: 'PRESENT',
					resultDigest: record.observation.resultDigest
				},
				query: { logicalPath: 'file.ts', operation: 'READ_FILE' }
			}),
			(record) => ({
				observation: {
					id: record.observation.id,
					invocationCount: record.observation.invocationCount,
					logicalPath: '.',
					operation: 'GET_DIRECTORIES',
					origin: record.observation.origin,
					result: 'DIRECTORY',
					resultDigest: record.observation.resultDigest,
					resultEntries: ['nested'],
					scannedEntries: 0
				},
				query: { logicalPath: '.', operation: 'GET_DIRECTORIES' }
			}),
			(record) => ({
				observation: {
					depth: -1,
					excludes: [],
					extensions: [],
					id: record.observation.id,
					includes: [],
					invocationCount: record.observation.invocationCount,
					logicalPath: '.',
					operation: 'READ_DIRECTORY',
					origin: record.observation.origin,
					result: 'DIRECTORY',
					resultDigest: record.observation.resultDigest,
					resultEntries: [],
					scannedEntries: 0
				},
				query: {
					depth: null,
					excludes: [],
					extensions: [],
					includes: [],
					logicalPath: '.',
					operation: 'READ_DIRECTORY'
				}
			}),
			(record) => ({
				observation: {
					id: record.observation.id,
					invocationCount: record.observation.invocationCount,
					logicalPath: '.',
					operation: 'CURRENT_DIRECTORY',
					origin: record.observation.origin,
					resolvedLogicalPath: '',
					result: 'RESOLVED',
					resultDigest: record.observation.resultDigest
				},
				query: { logicalPath: '.', operation: 'CURRENT_DIRECTORY' }
			}),
			(record) => ({
				observation: record.observation,
				query: {
					logicalPath: record.query.logicalPath === 'different.ts' ? 'other.ts' : 'different.ts',
					operation: record.query.operation
				}
			})
		];
		for (const replacement of invalidReplacements) {
			const spy = mockFinalizedEvidence((evidence) => {
				const records = [...evidence.inputRecords];
				const record = records[0]!;
				const next = replacement(record);
				records[0] = {
					...record,
					observation: next.observation as typeof record.observation,
					query: next.query as typeof record.query
				};
				return { ...evidence, inputRecords: records };
			});
			expect(
				errorOf(() => emitCompilerProjectDeclaration(fixture.inputs, emissionLimits())).code
			).toBe('CAPTURE_UNAVAILABLE');
			spy.mockRestore();
		}

		const replayReadSpy = mockFinalizedEvidence((evidence) => {
			const records = [...evidence.inputRecords];
			const emitIndex = records.findIndex((record) => record.stage === 'DECLARATION_EMIT');
			const readRecord = records.find(
				(record) =>
					record.observation.operation === 'READ_FILE' && record.observation.result === 'PRESENT'
			)!;
			records[emitIndex] = {
				...records[emitIndex]!,
				observation: readRecord.observation,
				query: readRecord.query
			};
			return { ...evidence, artifactParseInputRecords: 1, inputRecords: records };
		});
		expect(
			errorOf(() => emitCompilerProjectDeclaration(fixture.inputs, emissionLimits())).code
		).toBe('CAPTURE_UNAVAILABLE');
		replayReadSpy.mockRestore();
	});

	it('rejects forged evidence budgets, identity, state, record ordinals, stages, and replay bytes', () => {
		const cases: Array<
			readonly [
				(evidence: CompilerProjectProgramEvidence) => CompilerProjectProgramEvidence,
				CompilerProjectDeclarationEmissionError['code']
			]
		> = [
			[
				(evidence) =>
					({ ...evidence, compilerHostCallbacks: 100_001 }) as CompilerProjectProgramEvidence,
				'BUDGET_EXCEEDED'
			],
			[
				(evidence) =>
					({
						...evidence,
						subjectId: `${evidence.subjectId}:wrong`
					}) as CompilerProjectProgramEvidence,
				'CAPTURE_UNAVAILABLE'
			],
			[
				(evidence) =>
					({ ...evidence, state: 'wrong' }) as unknown as CompilerProjectProgramEvidence,
				'CAPTURE_UNAVAILABLE'
			],
			[
				(evidence) => ({ ...evidence, programContextDigest: '' }) as CompilerProjectProgramEvidence,
				'CAPTURE_UNAVAILABLE'
			],
			[
				(evidence) => ({ ...evidence, extra: true }) as CompilerProjectProgramEvidence,
				'PROVIDER_FAILURE'
			],
			[
				(evidence) => {
					const { version: _version, ...rest } = evidence;
					return { ...rest, unknown: _version } as unknown as CompilerProjectProgramEvidence;
				},
				'PROVIDER_FAILURE'
			],
			[
				(evidence) => {
					const records = [...evidence.inputRecords];
					records[0] = { ...records[0]!, ordinal: -1 };
					return { ...evidence, inputRecords: records };
				},
				'CAPTURE_UNAVAILABLE'
			],
			[
				(evidence) => {
					const records = [...evidence.inputRecords];
					records[0] = {
						...records[0]!,
						attributedInvocationCount: 0,
						invocationOrdinal: Number.NaN
					};
					return { ...evidence, inputRecords: records };
				},
				'CAPTURE_UNAVAILABLE'
			],
			[
				(evidence) => {
					const records = [...evidence.inputRecords];
					records[0] = { ...records[0]!, stage: 'CALLER_ANALYSIS' };
					records[1] = { ...records[1]!, stage: 'PROGRAM_CONSTRUCTION' };
					return { ...evidence, inputRecords: records };
				},
				'CAPTURE_UNAVAILABLE'
			],
			[
				(evidence) => {
					const records = [...evidence.inputRecords];
					records[0] = {
						...records[0]!,
						stage: 'UNKNOWN'
					} as unknown as (typeof records)[number];
					return { ...evidence, inputRecords: records };
				},
				'CAPTURE_UNAVAILABLE'
			],
			[
				(evidence) => {
					const records = [...evidence.inputRecords];
					const emitIndex = records.findIndex((record) => record.stage === 'DECLARATION_EMIT');
					const readRecord = records.find(
						(record) =>
							record.observation.operation === 'READ_FILE' &&
							record.observation.result === 'PRESENT'
					)!;
					records[emitIndex] = {
						...records[emitIndex]!,
						observation: {
							...readRecord.observation,
							contentBytes: -1
						} as typeof readRecord.observation
					};
					return { ...evidence, inputRecords: records };
				},
				'CAPTURE_UNAVAILABLE'
			]
		];
		for (const [transform, expectedCode] of cases) {
			const spy = mockFinalizedEvidence(transform);
			expect(
				errorOf(() => emitCompilerProjectDeclaration(fixture.inputs, emissionLimits())).code
			).toBe(expectedCode);
			spy.mockRestore();
		}
	});

	it.each([
		'MISSING_SOURCE',
		'WRONG_SOURCE',
		'DUPLICATE_PATH',
		'BOM',
		'EXTRA_KIND',
		'ONE_OUTPUT'
	] as const)('refuses malformed provider output: %s', (scenario) => {
		vi.spyOn(compilerProjectDeclarationEmissionTypeScriptPublicApi, 'emit').mockImplementation(
			(_program, sourceFile, writeFile) => {
				const paths = outputPaths(sourceFile.fileName);
				const sourceFiles =
					scenario === 'MISSING_SOURCE'
						? undefined
						: [
								{
									fileName:
										scenario === 'WRONG_SOURCE'
											? sourceFile.fileName.replace(/index\.ts$/u, 'other.ts')
											: sourceFile.fileName
								} as ts.SourceFile
							];
				const firstPath = scenario === 'EXTRA_KIND' ? `${paths.declaration}.js` : paths.map;
				const firstContent = scenario === 'BOM' ? '\ufeff{"version":3}\n' : '{"version":3}\n';
				writeFile(firstPath, firstContent, false, undefined, sourceFiles);
				if (scenario !== 'ONE_OUTPUT')
					writeFile(
						scenario === 'DUPLICATE_PATH' ? firstPath : paths.declaration,
						'export {};\n',
						false,
						undefined,
						sourceFiles
					);
				return { diagnostics: [], emitSkipped: false } as ts.EmitResult;
			}
		);
		expect(
			errorOf(() => emitCompilerProjectDeclaration(fixture.inputs, emissionLimits())).code
		).toBe('EMIT_UNAVAILABLE');
	});

	it('rejects invalid output values, source populations, and normalized paths', () => {
		const scenarios = [
			'INVALID_CONTENT',
			'INVALID_PATH',
			'EMPTY_SOURCES',
			'INVALID_SOURCE_NAME'
		] as const;
		for (const scenario of scenarios) {
			const spy = vi
				.spyOn(compilerProjectDeclarationEmissionTypeScriptPublicApi, 'emit')
				.mockImplementation((_program, sourceFile, writeFile) => {
					const paths = outputPaths(sourceFile.fileName);
					const sourceFiles =
						scenario === 'EMPTY_SOURCES'
							? []
							: [
									(scenario === 'INVALID_SOURCE_NAME'
										? { fileName: '' }
										: sourceFile) as ts.SourceFile
								];
					writeFile(
						scenario === 'INVALID_PATH' ? '\ud800.d.ts.map' : paths.map,
						scenario === 'INVALID_CONTENT' ? (undefined as unknown as string) : '{"version":3}\n',
						false,
						undefined,
						sourceFiles
					);
					return { diagnostics: [], emitSkipped: false };
				});
			expect(
				errorOf(() => emitCompilerProjectDeclaration(fixture.inputs, emissionLimits())).code
			).toBe('EMIT_UNAVAILABLE');
			spy.mockRestore();
		}

		const createSession =
			compilerProjectDeclarationEmissionCompilerProgramCapability.createCompilerProjectProgramSession;
		for (const duplicate of [false, true]) {
			const sessionSpy = vi
				.spyOn(
					compilerProjectDeclarationEmissionCompilerProgramCapability,
					'createCompilerProjectProgramSession'
				)
				.mockImplementation((snapshot, configPath, limits, runtime) => {
					const session = createSession(snapshot, configPath, limits, runtime);
					return Object.freeze({
						...session,
						toLogicalPath(path: string) {
							if (!path.endsWith('.d.ts') && !path.endsWith('.d.ts.map'))
								return session.toLogicalPath(path);
							return duplicate ? 'same-output' : '';
						}
					});
				});
			const emitSpy = vi
				.spyOn(compilerProjectDeclarationEmissionTypeScriptPublicApi, 'emit')
				.mockImplementation((_program, sourceFile, writeFile) => {
					const paths = outputPaths(sourceFile.fileName);
					writeFile(paths.map, '{"version":3}\n', false, undefined, [sourceFile]);
					if (duplicate)
						writeFile(paths.declaration, 'export {};\n', false, undefined, [sourceFile]);
					return { diagnostics: [], emitSkipped: false };
				});
			expect(
				errorOf(() => emitCompilerProjectDeclaration(fixture.inputs, emissionLimits())).code
			).toBe('EMIT_UNAVAILABLE');
			emitSpy.mockRestore();
			sessionSpy.mockRestore();
		}
	});

	it.each([
		['maxInputRecords', { maxInputRecords: 0 }],
		['maxOutputBytes', { maxOutputBytes: 0 }],
		['maxOutputFiles', { maxOutputFiles: 1 }],
		['maxOutputStringCharacters', { maxOutputStringCharacters: 0 }],
		['maxPathCharacters', { maxPathCharacters: 1 }],
		['maxProgramSourceFiles', { maxProgramSourceFiles: 0 }],
		['maxReadBytes', { maxReadBytes: 0 }],
		['maxTraversalSteps', { maxTraversalSteps: 0 }]
	] as const)('enforces %s', (_label, override) => {
		expect(
			errorOf(() => emitCompilerProjectDeclaration(fixture.inputs, emissionLimits(override))).code
		).toBe('BUDGET_EXCEEDED');
	});

	it('enforces duration/checkpoint failures and compiler-session budgets', () => {
		let time = 0;
		expect(
			errorOf(() =>
				emitCompilerProjectDeclaration(fixture.inputs, emissionLimits({ maxDurationMs: 1 }), {
					now: () => time++
				})
			).code
		).toBe('BUDGET_EXCEEDED');
		expect(
			errorOf(() =>
				emitCompilerProjectDeclaration(fixture.inputs, emissionLimits(), {
					checkpoint: () => {
						throw new Error('stop');
					}
				})
			).code
		).toBe('BUDGET_EXCEEDED');
		expect(
			errorOf(() =>
				emitCompilerProjectDeclaration(
					{
						...fixture.inputs,
						compilerProgramLimits: compilerProgramLimits({ maxProgramSourceFiles: 0 })
					},
					emissionLimits()
				)
			).code
		).toBe('BUDGET_EXCEEDED');
	});

	it('gives elapsed duration deterministic precedence over late provider failures', () => {
		let providerEntered = false;
		vi.spyOn(
			compilerProjectDeclarationEmissionCompilerProgramCapability,
			'createCompilerProjectProgramSession'
		).mockImplementationOnce(() => {
			providerEntered = true;
			throw new Error('late provider fault');
		});
		const lateProviderError = errorOf(() =>
			emitCompilerProjectDeclaration(fixture.inputs, emissionLimits({ maxDurationMs: 1 }), {
				now: () => (providerEntered ? 2 : 0)
			})
		);
		expect(lateProviderError).toMatchObject({
			code: 'BUDGET_EXCEEDED',
			message: 'Declaration emission exceeded maxDurationMs.'
		});

		vi.restoreAllMocks();
		providerEntered = false;
		vi.spyOn(
			compilerProjectDeclarationEmissionCompilerProgramCapability,
			'createCompilerProjectProgramSession'
		).mockImplementationOnce(() => {
			providerEntered = true;
			throw new CompilerProjectDeclarationEmissionError(
				'BUDGET_EXCEEDED',
				'provider budget refusal'
			);
		});
		const providerBudgetError = errorOf(() =>
			emitCompilerProjectDeclaration(fixture.inputs, emissionLimits({ maxDurationMs: 1 }), {
				now: () => (providerEntered ? 2 : 0)
			})
		);
		expect(providerBudgetError).toMatchObject({
			code: 'BUDGET_EXCEEDED',
			message: 'provider budget refusal'
		});

		vi.restoreAllMocks();
		providerEntered = false;
		vi.spyOn(
			compilerProjectDeclarationEmissionCompilerProgramCapability,
			'createCompilerProjectProgramSession'
		).mockImplementationOnce(() => {
			providerEntered = true;
			throw new CompilerProjectProgramCapabilityError('BUDGET_EXCEEDED', 'session budget refusal');
		});
		const sessionBudgetError = errorOf(() =>
			emitCompilerProjectDeclaration(fixture.inputs, emissionLimits({ maxDurationMs: 1 }), {
				now: () => (providerEntered ? 2 : 0)
			})
		);
		expect(sessionBudgetError).toMatchObject({
			code: 'BUDGET_EXCEEDED',
			message: 'session budget refusal'
		});
	});

	it('fails closed for a substituted compiler-session provider', () => {
		vi.spyOn(
			compilerProjectDeclarationEmissionCompilerProgramCapability,
			'createCompilerProjectProgramSession'
		).mockImplementationOnce(() => {
			throw new Error('session provider fault');
		});
		expect(
			errorOf(() => emitCompilerProjectDeclaration(fixture.inputs, emissionLimits())).code
		).toBe('PROVIDER_FAILURE');
	});
});
