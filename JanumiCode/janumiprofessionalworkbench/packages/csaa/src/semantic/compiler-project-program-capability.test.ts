import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	COMPILER_PROJECT_PROGRAM_CAPABILITY_VERSION,
	CompilerProjectProgramCapabilityError,
	createCompilerProjectProgramSession,
	type CompilerProjectProgramLimits
} from './compiler-project-program-capability.js';
import { canonicalSemanticJson } from './canonical.js';
import * as compilerCaptureCapability from './compiler-capture-capability.js';
import type { StaticSemanticSnapshot } from '../contracts/semantic.js';
import {
	CompilerInputCaptureError,
	type BorrowedVerifiedCompilerProjectInputEntry,
	type CompilerInputQuery,
	type VerifiedCompilerProjectInputEntry,
	type VerifiedCompilerProjectInputLookup
} from '../providers/typescript/compiler-input-journal.js';
import * as frozenCompilerHost from '../providers/typescript/frozen-compiler-host.js';
import { materializeProgramRecipe } from '../providers/typescript/materialize-program-recipe.js';
import { createModuleResolutionTraceFixture } from '../resolution/module-resolution-trace-fixture.test-support.js';
import { createSourceOriginCorrelationFixture } from './source-origin-correlation-fixture.test-support.js';

function limits(
	overrides: Partial<CompilerProjectProgramLimits> = {}
): CompilerProjectProgramLimits {
	return {
		maxDurationMs: 120_000,
		maxProgramInputRecords: 100_000,
		maxProgramReadBytes: 32 * 1024 * 1024,
		maxProgramSourceFiles: 10_000,
		maxTotalInputRecords: 100_010,
		maxTotalReadBytes: 64 * 1024 * 1024,
		...overrides
	};
}

function consumerConfigPath(
	fixture: ReturnType<typeof createModuleResolutionTraceFixture>
): string {
	const project = fixture.semanticSnapshot.projects.find(
		(candidate) => candidate.programId === fixture.importerProgramId
	);
	if (project === undefined) throw new Error('Fixture lacks the consumer semantic project.');
	return project.configPath;
}

function capabilityError(action: () => unknown): CompilerProjectProgramCapabilityError {
	try {
		action();
	} catch (error) {
		if (error instanceof CompilerProjectProgramCapabilityError) return error;
		throw error;
	}
	throw new Error('Expected CompilerProjectProgramCapabilityError.');
}

function captureError(action: () => unknown): CompilerInputCaptureError {
	try {
		action();
	} catch (error) {
		if (error instanceof CompilerInputCaptureError) return error;
		throw error;
	}
	throw new Error('Expected CompilerInputCaptureError.');
}

function projectLookup(
	fixture: ReturnType<typeof createModuleResolutionTraceFixture>,
	configPath: string
): VerifiedCompilerProjectInputLookup {
	const lookup = compilerCaptureCapability.getStaticSemanticSnapshotCompilerProjectInputLookup(
		fixture.semanticSnapshot,
		configPath
	);
	if (lookup === undefined) throw new Error('Fixture lacks its verified compiler lookup.');
	return lookup;
}

function lookupWith(
	lookup: VerifiedCompilerProjectInputLookup,
	overrides: Partial<
		Pick<VerifiedCompilerProjectInputLookup, 'attribution' | 'lookupAttributedQuery'>
	>
): VerifiedCompilerProjectInputLookup {
	const lookupAttributedQuery =
		overrides.lookupAttributedQuery ??
		((query: CompilerInputQuery, onProgress?: () => void) =>
			lookup.lookupAttributedQuery(query, onProgress));
	return Object.freeze({
		attribution: overrides.attribution ?? lookup.attribution,
		lookupAttributedQuery,
		subjectId: lookup.subjectId,
		toRecordedAbsolute: (logicalPath: string) => lookup.toRecordedAbsolute(logicalPath),
		toRecordedLogical: (path: string) => lookup.toRecordedLogical(path),
		withAttributedQueryForVerifiedHost(
			query: CompilerInputQuery,
			onProgress: () => void,
			consumer: (entry: BorrowedVerifiedCompilerProjectInputEntry) => void
		) {
			const entry = lookupAttributedQuery(query, onProgress);
			if (entry === undefined) return false;
			consumer(entry);
			return true;
		}
	});
}

function frozenSnapshot(
	snapshot: StaticSemanticSnapshot,
	overrides: Partial<StaticSemanticSnapshot>
): StaticSemanticSnapshot {
	return Object.freeze({ ...snapshot, ...overrides });
}

describe('verified compiler project Program capability', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('opens a fresh public Program over exact captured inputs and separately charges a CAP-001 parse', () => {
		const fixture = createModuleResolutionTraceFixture();
		try {
			const configPath = consumerConfigPath(fixture);
			const stages: string[] = [];
			const first = createCompilerProjectProgramSession(
				fixture.semanticSnapshot,
				configPath,
				limits(),
				{ onInput: (stage) => stages.push(stage) }
			);
			const second = createCompilerProjectProgramSession(
				fixture.semanticSnapshot,
				configPath,
				limits()
			);
			expect(second.program).not.toBe(first.program);
			expect(second.checker).not.toBe(first.checker);
			second.finalize();

			const targetSource = first.program
				.getSourceFiles()
				.find((source) => first.toLogicalPath(source.fileName) === fixture.targetPath);
			expect(targetSource?.isDeclarationFile).toBe(true);
			const moduleSymbol = targetSource && first.checker.getSymbolAtLocation(targetSource);
			expect(moduleSymbol).toBeDefined();
			expect(
				first.checker.getExportsOfModule(moduleSymbol!).map((symbol) => symbol.name)
			).toContain('target');

			const parsed = first.parseCapturedSourceFile(fixture.targetPath);
			expect(parsed).toMatchObject({
				contentBytes: 32,
				encoding: 'UTF8',
				logicalPath: fixture.targetPath,
				textLength: 32
			});
			expect(parsed.contentSha256).toMatch(/^[a-f0-9]{64}$/u);
			expect(parsed.sourceFile.isDeclarationFile).toBe(true);
			expect(parsed.sourceFile.statements).toHaveLength(1);

			const evidence = first.finalize();
			expect(stages).toEqual(evidence.inputRecords.map((record) => record.stage));
			expect(evidence).toMatchObject({
				artifactParseInputRecords: 1,
				artifactParseReadBytes: 32,
				compilerHostCallbacks: evidence.programCompilerHostCallbacks + 1,
				compilerHostReadBytes: evidence.programCompilerHostReadBytes + 32,
				configPath,
				programCallbacksWithinAttributedInvocationBounds: true,
				programSourceFiles: first.program.getSourceFiles().length,
				semanticProgramId: fixture.importerProgramId,
				state: 'VERIFIED_PROJECT_SCOPED_FRESH_PROGRAM',
				subjectId: fixture.frozenSubject.descriptor.subjectId
			});
			expect(evidence.inputRecords.map((record) => record.ordinal)).toEqual(
				evidence.inputRecords.map((_, index) => index)
			);
			expect(evidence.inputRecords[parsed.inputRecordOrdinal]).toMatchObject({
				observation: { contentBytes: 32, operation: 'READ_FILE', result: 'PRESENT' },
				query: { logicalPath: fixture.targetPath, operation: 'READ_FILE' },
				stage: 'DECLARATION_ARTIFACT_PARSE'
			});
			expect(Object.isFrozen(evidence)).toBe(true);
			expect(Object.isFrozen(evidence.inputRecords)).toBe(true);
			expect(Object.isFrozen(evidence.inputRecords[0]?.query)).toBe(true);
			expect(Object.isFrozen(evidence.inputRecords[0]?.observation)).toBe(true);
			expect('bytes' in (evidence.inputRecords[0]?.observation ?? {})).toBe(false);
			expect(capabilityError(() => first.parseCapturedSourceFile(fixture.targetPath)).code).toBe(
				'CAPTURE_UNAVAILABLE'
			);
		} finally {
			fixture.cleanup();
		}
	}, 180_000);

	it('replays only captured declaration-emit queries while preserving construction bounds and charging every callback', () => {
		const fixture = createSourceOriginCorrelationFixture();
		try {
			const project = fixture.semanticSnapshot.projects.find(
				(candidate) => candidate.id === fixture.semanticProjectId
			);
			if (project === undefined) throw new Error('Fixture lacks its selected semantic project.');
			const stages: string[] = [];
			const session = createCompilerProjectProgramSession(
				fixture.semanticSnapshot,
				project.configPath,
				limits(),
				{ onInput: (stage) => stages.push(stage) }
			);
			const selectedSource = session.program
				.getSourceFiles()
				.find((source) => session.toLogicalPath(source.fileName) === fixture.sourcePath);
			if (selectedSource === undefined)
				throw new Error('Fixture fresh Program lacks its selected source.');

			expect(
				capabilityError(() =>
					session.withDeclarationEmit(() => session.withDeclarationEmit(() => undefined))
				).code
			).toBe('CAPTURE_UNAVAILABLE');
			expect(
				capabilityError(() => session.withDeclarationEmit(null as unknown as () => undefined)).code
			).toBe('INPUT_INVALID');
			let outputCount = 0;
			const emitResult = session.withDeclarationEmit(() => {
				expect(session.toLogicalPath(selectedSource.fileName)).toBe(fixture.sourcePath);
				expect(capabilityError(() => session.finalize()).code).toBe('CAPTURE_UNAVAILABLE');
				expect(
					capabilityError(() => session.parseCapturedSourceFile(fixture.sourcePath)).code
				).toBe('CAPTURE_UNAVAILABLE');
				return session.program.emit(
					selectedSource,
					() => {
						outputCount += 1;
					},
					undefined,
					true
				);
			});
			expect(emitResult.emitSkipped).toBe(false);
			expect(emitResult.diagnostics).toEqual([]);
			expect(outputCount).toBe(2);

			const evidence = session.finalize();
			const emitRecords = evidence.inputRecords.filter(
				(record) => record.stage === 'DECLARATION_EMIT'
			);
			const presentReadBytes = evidence.inputRecords.reduce(
				(total, record) =>
					total +
					(record.observation.operation === 'READ_FILE' && record.observation.result === 'PRESENT'
						? record.observation.contentBytes
						: 0),
				0
			);
			const emitReadBytes = emitRecords.reduce(
				(total, record) =>
					total +
					(record.observation.operation === 'READ_FILE' && record.observation.result === 'PRESENT'
						? record.observation.contentBytes
						: 0),
				0
			);
			expect(stages).toEqual(evidence.inputRecords.map((record) => record.stage));
			expect(evidence.version).toBe(COMPILER_PROJECT_PROGRAM_CAPABILITY_VERSION);
			expect(evidence.version).toBe('jan-csaa-verified-compiler-project-program/1.1.0');
			expect(evidence.declarationEmitCallbacksUseOnlyAttributedQueries).toBe(true);
			expect(evidence.declarationEmitInputRecords).toBe(emitRecords.length);
			expect(evidence.declarationEmitInputRecords).toBeGreaterThan(0);
			expect(evidence.declarationEmitReadBytes).toBe(emitReadBytes);
			expect(evidence.compilerHostCallbacks).toBe(evidence.inputRecords.length);
			expect(evidence.compilerHostCallbacks).toBe(
				evidence.programCompilerHostCallbacks + evidence.declarationEmitInputRecords
			);
			expect(evidence.compilerHostReadBytes).toBe(presentReadBytes);
			expect(evidence.compilerHostReadBytes).toBe(
				evidence.programCompilerHostReadBytes + evidence.declarationEmitReadBytes
			);
			expect(evidence.programCallbacksWithinAttributedInvocationBounds).toBe(true);
			expect(
				evidence.inputRecords
					.filter((record) => record.stage !== 'DECLARATION_EMIT')
					.every((record) => record.invocationOrdinal < record.attributedInvocationCount)
			).toBe(true);
			expect(evidence.inputRecords.map((record) => record.ordinal)).toEqual(
				evidence.inputRecords.map((_, index) => index)
			);
			const stageRank = {
				CALLER_ANALYSIS: 2,
				DECLARATION_ARTIFACT_PARSE: 4,
				DECLARATION_EMIT: 3,
				PROGRAM_CONSTRUCTION: 0,
				TYPE_CHECKER_CREATE: 1
			} as const;
			expect(
				evidence.inputRecords.every(
					(record, index, records) =>
						index === 0 || stageRank[records[index - 1]!.stage] <= stageRank[record.stage]
				)
			).toBe(true);
			expect(emitRecords).toContainEqual(
				expect.objectContaining({
					attributedInvocationCount: 22,
					invocationOrdinal: 22,
					query: {
						logicalPath: '.',
						operation: 'USE_CASE_SENSITIVE_FILE_NAMES'
					},
					stage: 'DECLARATION_EMIT'
				})
			);

			const baselineSession = createCompilerProjectProgramSession(
				fixture.semanticSnapshot,
				project.configPath,
				limits()
			);
			const baseline = baselineSession.finalize();
			expect(baseline).toMatchObject({
				declarationEmitCallbacksUseOnlyAttributedQueries: true,
				declarationEmitInputRecords: 0,
				declarationEmitReadBytes: 0,
				programCompilerHostCallbacks: evidence.programCompilerHostCallbacks,
				programCompilerHostReadBytes: evidence.programCompilerHostReadBytes,
				version: COMPILER_PROJECT_PROGRAM_CAPABILITY_VERSION
			});
			expect(capabilityError(() => baselineSession.withDeclarationEmit(() => undefined)).code).toBe(
				'CAPTURE_UNAVAILABLE'
			);
		} finally {
			fixture.cleanup();
		}
	}, 180_000);

	it('restores the caller-analysis stage after a declaration-emit operation throws', () => {
		const fixture = createSourceOriginCorrelationFixture();
		try {
			const project = fixture.semanticSnapshot.projects.find(
				(candidate) => candidate.id === fixture.semanticProjectId
			);
			if (project === undefined) throw new Error('Fixture lacks its selected semantic project.');
			const session = createCompilerProjectProgramSession(
				fixture.semanticSnapshot,
				project.configPath,
				limits()
			);
			const fault = new Error('emit operation fault');
			expect(() =>
				session.withDeclarationEmit(() => {
					throw fault;
				})
			).toThrow(fault);
			const evidence = session.finalize();
			expect(evidence.declarationEmitInputRecords).toBe(0);
			expect(evidence.declarationEmitReadBytes).toBe(0);
		} finally {
			fixture.cleanup();
		}
	}, 180_000);

	it('exercises documented internal capture-provider and verified-host path/refusal boundaries', () => {
		const fixture = createModuleResolutionTraceFixture();
		try {
			const configPath = consumerConfigPath(fixture);
			const lookup = projectLookup(fixture, configPath);
			const project = fixture.semanticSnapshot.projects.find(
				(candidate) => candidate.programId === fixture.importerProgramId
			);
			if (project === undefined) throw new Error('Fixture lacks its importer semantic project.');
			const recipe = project.programRecipe;
			const materialized = materializeProgramRecipe(recipe, fixture.root);
			const callbacks = {
				assertWithinDeadline() {},
				onInput() {}
			};
			const capturingEnvironment = frozenCompilerHost.createCapturingCompilerEnvironment(
				fixture.frozenSubject,
				fixture.root,
				fixture.semanticSnapshot.budgets
			);
			const capturingHost = capturingEnvironment.createProjectHost(recipe, materialized);
			if (capturingHost.getDirectories === undefined)
				throw new Error('Capturing compiler host lacks getDirectories.');
			expect(capturingHost.getDirectories(fixture.root).length).toBeGreaterThan(0);
			capturingEnvironment.finalizeCapture();
			const host = frozenCompilerHost.createVerifiedCompilerProjectInputHost(
				recipe,
				materialized,
				lookup,
				fixture.semanticSnapshot.budgets,
				callbacks
			);
			expect(host.toLogicalPath(fixture.root)).toBe('.');
			const absent = captureError(() =>
				host.readDirectory(fixture.root, ['.tsx', '.ts', '.js'], [], ['**/*'])
			);
			expect(absent.code).toBe('CONTEXT_UNAVAILABLE');

			const mismatchedLookup = lookupWith(lookup, {
				attribution: { ...lookup.attribution, projectResolutionDigest: '0'.repeat(64) }
			});
			const mismatch = captureError(() =>
				frozenCompilerHost.createVerifiedCompilerProjectInputHost(
					recipe,
					materialized,
					mismatchedLookup,
					fixture.semanticSnapshot.budgets,
					callbacks
				)
			);
			expect(mismatch.code).toBe('INVALID_CAPTURE');

			const oversizedPathLookup: VerifiedCompilerProjectInputLookup = Object.freeze({
				...lookup,
				toRecordedLogical: () => 'x'.repeat(fixture.semanticSnapshot.budgets.maxPathCharacters + 1)
			});
			const oversizedPath = captureError(() =>
				frozenCompilerHost.createVerifiedCompilerProjectInputHost(
					recipe,
					materialized,
					oversizedPathLookup,
					fixture.semanticSnapshot.budgets,
					callbacks
				)
			);
			expect(oversizedPath.code).toBe('BUDGET_EXCEEDED');
		} finally {
			fixture.cleanup();
		}
	}, 180_000);

	it('preflights exact attributed input, byte, and source populations before Program construction', () => {
		const fixture = createModuleResolutionTraceFixture();
		try {
			const configPath = consumerConfigPath(fixture);
			const baseline = createCompilerProjectProgramSession(
				fixture.semanticSnapshot,
				configPath,
				limits()
			).finalize();
			const exact = limits({
				maxProgramInputRecords: baseline.attributedInputRecords,
				maxProgramReadBytes: baseline.attributedReadBytes,
				maxProgramSourceFiles: baseline.programSourceFiles,
				maxTotalInputRecords: baseline.attributedInputRecords,
				maxTotalReadBytes: baseline.attributedReadBytes
			});
			expect(
				createCompilerProjectProgramSession(fixture.semanticSnapshot, configPath, exact).finalize()
					.state
			).toBe('VERIFIED_PROJECT_SCOPED_FRESH_PROGRAM');
			expect(
				capabilityError(() =>
					createCompilerProjectProgramSession(
						fixture.semanticSnapshot,
						configPath,
						limits({
							maxProgramInputRecords: baseline.attributedInputRecords - 1
						})
					)
				).code
			).toBe('BUDGET_EXCEEDED');
			expect(
				capabilityError(() =>
					createCompilerProjectProgramSession(
						fixture.semanticSnapshot,
						configPath,
						limits({ maxProgramReadBytes: baseline.attributedReadBytes - 1 })
					)
				).code
			).toBe('BUDGET_EXCEEDED');
			expect(
				capabilityError(() =>
					createCompilerProjectProgramSession(
						fixture.semanticSnapshot,
						configPath,
						limits({ maxProgramSourceFiles: baseline.programSourceFiles - 1 })
					)
				).code
			).toBe('BUDGET_EXCEEDED');
		} finally {
			fixture.cleanup();
		}
	}, 180_000);

	it('has no live-filesystem fallback and loses capability across structured cloning', () => {
		const fixture = createModuleResolutionTraceFixture();
		const configPath = consumerConfigPath(fixture);
		const snapshot = fixture.semanticSnapshot;
		const targetPath = fixture.targetPath;
		fixture.cleanup();

		const session = createCompilerProjectProgramSession(snapshot, configPath, limits());
		expect(session.parseCapturedSourceFile(targetPath).sourceFile.statements).toHaveLength(1);
		expect(session.finalize().artifactParseInputRecords).toBe(1);

		const cloned = structuredClone(snapshot);
		expect(
			capabilityError(() => createCompilerProjectProgramSession(cloned, configPath, limits())).code
		).toBe('CAPTURE_UNAVAILABLE');
	}, 180_000);

	it('rejects hostile and incoherent limit ingress without invoking accessors', () => {
		const fixture = createModuleResolutionTraceFixture();
		try {
			const configPath = consumerConfigPath(fixture);
			let calls = 0;
			const hostile = {
				get maxDurationMs() {
					calls += 1;
					return 1;
				},
				maxProgramInputRecords: 1,
				maxProgramReadBytes: 1,
				maxProgramSourceFiles: 1,
				maxTotalInputRecords: 1,
				maxTotalReadBytes: 1
			};
			expect(
				capabilityError(() =>
					createCompilerProjectProgramSession(fixture.semanticSnapshot, configPath, hostile)
				).code
			).toBe('INPUT_INVALID');
			let callbackAttempts = 0;
			expect(
				capabilityError(() =>
					createCompilerProjectProgramSession(fixture.semanticSnapshot, configPath, limits(), {
						onInput() {
							callbackAttempts += 1;
							throw new CompilerProjectProgramCapabilityError(
								'BUDGET_EXCEEDED',
								'injected shared traversal exhaustion'
							);
						}
					})
				).code
			).toBe('BUDGET_EXCEEDED');
			expect(callbackAttempts).toBe(1);
			expect(calls).toBe(0);
			expect(
				capabilityError(() =>
					createCompilerProjectProgramSession(
						fixture.semanticSnapshot,
						configPath,
						limits({ maxProgramInputRecords: 10, maxTotalInputRecords: 9 })
					)
				).code
			).toBe('INPUT_INVALID');
		} finally {
			fixture.cleanup();
		}
	}, 180_000);

	it('rejects malformed limits, project bindings, lost capture, and expired clocks', () => {
		const fixture = createModuleResolutionTraceFixture();
		try {
			const configPath = consumerConfigPath(fixture);
			expect(
				capabilityError(() =>
					createCompilerProjectProgramSession(fixture.semanticSnapshot, configPath, null)
				).code
			).toBe('INPUT_INVALID');
			expect(
				capabilityError(() =>
					createCompilerProjectProgramSession(fixture.semanticSnapshot, configPath, {
						...limits(),
						extra: 1
					})
				).code
			).toBe('INPUT_INVALID');
			expect(
				capabilityError(() =>
					createCompilerProjectProgramSession(
						fixture.semanticSnapshot,
						configPath,
						limits({ maxDurationMs: 0 })
					)
				).code
			).toBe('INPUT_INVALID');
			expect(
				capabilityError(() =>
					createCompilerProjectProgramSession(fixture.semanticSnapshot, '', limits())
				).code
			).toBe('INPUT_INVALID');

			const noProjects = frozenSnapshot(fixture.semanticSnapshot, { projects: [] });
			expect(
				capabilityError(() => createCompilerProjectProgramSession(noProjects, configPath, limits()))
					.code
			).toBe('INPUT_INVALID');
			const noPrograms = frozenSnapshot(fixture.semanticSnapshot, { programs: [] });
			expect(
				capabilityError(() => createCompilerProjectProgramSession(noPrograms, configPath, limits()))
					.code
			).toBe('INPUT_INVALID');
			const detached = frozenSnapshot(fixture.semanticSnapshot, {});
			expect(
				capabilityError(() => createCompilerProjectProgramSession(detached, configPath, limits()))
					.code
			).toBe('CAPTURE_UNAVAILABLE');

			let clockCalls = 0;
			expect(
				capabilityError(() =>
					createCompilerProjectProgramSession(
						fixture.semanticSnapshot,
						configPath,
						limits({ maxDurationMs: 1 }),
						{ now: () => (clockCalls++ === 0 ? 0 : 2) }
					)
				).code
			).toBe('BUDGET_EXCEEDED');
			expect(
				capabilityError(() =>
					createCompilerProjectProgramSession(fixture.semanticSnapshot, configPath, limits(), {
						now() {
							throw new Error('injected clock failure');
						}
					})
				).code
			).toBe('BUDGET_EXCEEDED');
			const maxSafeClockSession = createCompilerProjectProgramSession(
				fixture.semanticSnapshot,
				configPath,
				limits({ maxDurationMs: Number.MAX_SAFE_INTEGER }),
				{ now: () => Number.MAX_SAFE_INTEGER }
			);
			expect(maxSafeClockSession.finalize().state).toBe('VERIFIED_PROJECT_SCOPED_FRESH_PROGRAM');
			let regressingClockCalls = 0;
			expect(
				capabilityError(() =>
					createCompilerProjectProgramSession(fixture.semanticSnapshot, configPath, limits(), {
						now: () => (regressingClockCalls++ === 0 ? 10 : 9)
					})
				).code
			).toBe('BUDGET_EXCEEDED');

			const session = createCompilerProjectProgramSession(
				fixture.semanticSnapshot,
				configPath,
				limits()
			);
			expect(capabilityError(() => session.parseCapturedSourceFile('')).code).toBe('INPUT_INVALID');
			session.finalize();
			expect(capabilityError(() => session.finalize()).code).toBe('CAPTURE_UNAVAILABLE');
		} finally {
			fixture.cleanup();
		}
	}, 180_000);

	it('materializes array paths and project references and retains exact BOM evidence', () => {
		const variants = [
			{
				expectedEncoding: 'UTF8' as const,
				options: {
					consumerCompilerOptions: { rootDirs: ['generated', 'src'] },
					consumerProjectReferences: ['../module-target']
				}
			},
			{
				expectedEncoding: 'UTF8' as const,
				options: {
					consumerCompilerOptions: {
						paths: { '@fixture/*': ['../module-target/*'] },
						typeRoots: ['../module-target/dist']
					}
				}
			},
			{
				expectedEncoding: 'UTF16LE_BOM' as const,
				options: { consumerSourceEncoding: 'UTF16LE' as const }
			},
			{
				expectedEncoding: 'UTF16BE_BOM' as const,
				options: { consumerSourceEncoding: 'UTF16BE' as const }
			},
			{
				expectedEncoding: 'UTF8_BOM' as const,
				options: {
					importerText:
						"\ufeffimport { target } from '@fixture/module-target';\nexport const value = target;\n"
				}
			},
			{
				expectedEncoding: 'UTF8' as const,
				options: {
					consumerCompilerOptions: { jsx: 'preserve' },
					importerExtension: 'tsx' as const
				}
			},
			{
				expectedEncoding: 'UTF8' as const,
				options: {
					consumerCompilerOptions: { allowJs: true, checkJs: true },
					importerExtension: 'js' as const
				}
			},
			{
				expectedEncoding: 'UTF8' as const,
				options: {
					consumerCompilerOptions: { allowJs: true, checkJs: true, jsx: 'preserve' },
					importerExtension: 'jsx' as const
				}
			}
		] as const;
		for (const variant of variants) {
			const fixture = createModuleResolutionTraceFixture(variant.options);
			try {
				const session = createCompilerProjectProgramSession(
					fixture.semanticSnapshot,
					consumerConfigPath(fixture),
					limits()
				);
				expect(session.parseCapturedSourceFile(fixture.importerPath).encoding).toBe(
					variant.expectedEncoding
				);
				session.finalize();
			} finally {
				fixture.cleanup();
			}
		}
	}, 180_000);

	it('translates lookup capture failures and rejects contradictory attribution', () => {
		const fixture = createModuleResolutionTraceFixture();
		try {
			const configPath = consumerConfigPath(fixture);
			const lookup = projectLookup(fixture, configPath);
			const lookupSpy = vi.spyOn(
				compilerCaptureCapability,
				'getStaticSemanticSnapshotCompilerProjectInputLookup'
			);

			lookupSpy.mockReturnValueOnce(
				lookupWith(lookup, {
					lookupAttributedQuery() {
						throw new CompilerInputCaptureError('BUDGET_EXCEEDED', 'injected lookup budget');
					}
				})
			);
			expect(
				capabilityError(() =>
					createCompilerProjectProgramSession(fixture.semanticSnapshot, configPath, limits())
				).code
			).toBe('BUDGET_EXCEEDED');

			lookupSpy.mockReturnValueOnce(
				lookupWith(lookup, {
					lookupAttributedQuery() {
						throw new CompilerInputCaptureError('INVALID_CAPTURE', 'injected invalid capture');
					}
				})
			);
			expect(
				capabilityError(() =>
					createCompilerProjectProgramSession(fixture.semanticSnapshot, configPath, limits())
				).code
			).toBe('CAPTURE_UNAVAILABLE');

			lookupSpy.mockReturnValueOnce(
				lookupWith(lookup, {
					lookupAttributedQuery() {
						throw new Error('injected unknown lookup failure');
					}
				})
			);
			expect(() =>
				createCompilerProjectProgramSession(fixture.semanticSnapshot, configPath, limits())
			).toThrow('injected unknown lookup failure');

			lookupSpy.mockReturnValueOnce(lookupWith(lookup, { lookupAttributedQuery: () => undefined }));
			expect(
				capabilityError(() =>
					createCompilerProjectProgramSession(fixture.semanticSnapshot, configPath, limits())
				).code
			).toBe('CAPTURE_UNAVAILABLE');

			const readDirectoryQuery: CompilerInputQuery = Object.freeze({
				depth: 1,
				excludes: Object.freeze(['**/node_modules/**']),
				extensions: Object.freeze(['.ts', '.d.ts']),
				includes: Object.freeze(['**/*']),
				logicalPath: '/synthetic/read-directory',
				operation: 'READ_DIRECTORY'
			});
			const mismatchedReadDirectoryQuery: CompilerInputQuery = Object.freeze({
				...readDirectoryQuery,
				includes: Object.freeze(['**/*.ts'])
			});
			const seedAttribution = lookup.attribution.queryInvocations[0]!;
			const seedEntry = lookup.lookupAttributedQuery(seedAttribution.query);
			if (seedEntry === undefined) throw new Error('Fixture lacks its first attributed input.');
			lookupSpy.mockReturnValueOnce(
				lookupWith(lookup, {
					attribution: {
						...lookup.attribution,
						queryInvocations: [
							...lookup.attribution.queryInvocations,
							{ invocationCount: 1, query: readDirectoryQuery }
						]
					},
					lookupAttributedQuery(query) {
						return query === readDirectoryQuery
							? {
									...seedEntry,
									attributedInvocationCount: 1,
									query: mismatchedReadDirectoryQuery
								}
							: lookup.lookupAttributedQuery(query);
					}
				})
			);
			expect(
				capabilityError(() =>
					createCompilerProjectProgramSession(fixture.semanticSnapshot, configPath, limits())
				).code
			).toBe('CAPTURE_UNAVAILABLE');

			lookupSpy.mockReturnValueOnce(
				lookupWith(lookup, {
					attribution: {
						...lookup.attribution,
						queryInvocations: [
							...lookup.attribution.queryInvocations,
							lookup.attribution.queryInvocations[0]!
						]
					}
				})
			);
			expect(
				capabilityError(() =>
					createCompilerProjectProgramSession(fixture.semanticSnapshot, configPath, limits())
				).code
			).toBe('CAPTURE_UNAVAILABLE');

			lookupSpy.mockReturnValueOnce(
				lookupWith(lookup, {
					attribution: {
						...lookup.attribution,
						materializedRecipeDigest: '0'.repeat(64)
					}
				})
			);
			expect(
				capabilityError(() =>
					createCompilerProjectProgramSession(fixture.semanticSnapshot, configPath, limits())
				).code
			).toBe('CAPTURE_UNAVAILABLE');

			const presentRead = lookup.attribution.queryInvocations
				.map((attribution) => ({
					attribution,
					entry: lookup.lookupAttributedQuery(attribution.query)
				}))
				.find(
					(candidate) =>
						candidate.entry?.observation.operation === 'READ_FILE' &&
						candidate.entry.observation.result === 'PRESENT' &&
						candidate.entry.observation.contentBytes > 1
				);
			if (presentRead?.entry === undefined)
				throw new Error('Fixture attribution lacks one present captured read.');
			const presentReadEntry = presentRead.entry;
			lookupSpy.mockReturnValueOnce(
				lookupWith(lookup, {
					attribution: {
						...lookup.attribution,
						queryInvocations: [
							{
								invocationCount: Number.MAX_SAFE_INTEGER,
								query: presentRead.attribution.query
							}
						]
					},
					lookupAttributedQuery(query) {
						return canonicalSemanticJson(query) ===
							canonicalSemanticJson(presentRead.attribution.query)
							? {
									...presentReadEntry,
									attributedInvocationCount: Number.MAX_SAFE_INTEGER
								}
							: lookup.lookupAttributedQuery(query);
					}
				})
			);
			expect(
				capabilityError(() =>
					createCompilerProjectProgramSession(
						fixture.semanticSnapshot,
						configPath,
						limits({
							maxProgramInputRecords: Number.MAX_SAFE_INTEGER,
							maxProgramReadBytes: Number.MAX_SAFE_INTEGER,
							maxTotalInputRecords: Number.MAX_SAFE_INTEGER,
							maxTotalReadBytes: Number.MAX_SAFE_INTEGER
						})
					)
				).code
			).toBe('BUDGET_EXCEEDED');
		} finally {
			fixture.cleanup();
		}
	}, 180_000);

	it('enforces actual callback totals and exact attributed query bounds', () => {
		const fixture = createModuleResolutionTraceFixture();
		try {
			const configPath = consumerConfigPath(fixture);
			const baseline = createCompilerProjectProgramSession(
				fixture.semanticSnapshot,
				configPath,
				limits()
			).finalize();

			const inputLimited = createCompilerProjectProgramSession(
				fixture.semanticSnapshot,
				configPath,
				limits({
					maxProgramInputRecords: baseline.attributedInputRecords,
					maxTotalInputRecords: baseline.attributedInputRecords
				})
			);
			const successfulParses =
				baseline.attributedInputRecords - baseline.programCompilerHostCallbacks;
			for (let index = 0; index < successfulParses; index += 1)
				inputLimited.parseCapturedSourceFile(fixture.targetPath);
			expect(
				capabilityError(() => inputLimited.parseCapturedSourceFile(fixture.targetPath)).code
			).toBe('BUDGET_EXCEEDED');

			const readLimited = createCompilerProjectProgramSession(
				fixture.semanticSnapshot,
				configPath,
				limits({
					maxProgramReadBytes: baseline.attributedReadBytes,
					maxTotalReadBytes: baseline.attributedReadBytes
				})
			);
			const targetBytes = fixture.semanticSnapshot.sources.find(
				(source) => source.logicalPath === fixture.targetPath
			)?.bytes;
			if (targetBytes === undefined || targetBytes === 0)
				throw new Error('Fixture target lacks a positive captured byte population.');
			const successfulReadParses = Math.floor(
				(baseline.attributedReadBytes - baseline.programCompilerHostReadBytes) / targetBytes
			);
			for (let index = 0; index < successfulReadParses; index += 1)
				readLimited.parseCapturedSourceFile(fixture.targetPath);
			expect(
				capabilityError(() => readLimited.parseCapturedSourceFile(fixture.targetPath)).code
			).toBe('BUDGET_EXCEEDED');

			const lookup = projectLookup(fixture, configPath);
			const firstActualQuery = baseline.inputRecords[0]!.query;
			const firstActualKey = canonicalSemanticJson(firstActualQuery);
			const withoutFirst = lookupWith(lookup, {
				attribution: {
					...lookup.attribution,
					queryInvocations: lookup.attribution.queryInvocations.filter(
						(entry) => canonicalSemanticJson(entry.query) !== firstActualKey
					)
				}
			});
			const lookupSpy = vi
				.spyOn(compilerCaptureCapability, 'getStaticSemanticSnapshotCompilerProjectInputLookup')
				.mockReturnValueOnce(withoutFirst);
			expect(
				capabilityError(() =>
					createCompilerProjectProgramSession(fixture.semanticSnapshot, configPath, limits())
				).code
			).toBe('CAPTURE_UNAVAILABLE');

			lookupSpy.mockReturnValueOnce(
				lookupWith(lookup, {
					attribution: {
						...lookup.attribution,
						queryInvocations: lookup.attribution.queryInvocations.map((entry) =>
							canonicalSemanticJson(entry.query) === firstActualKey
								? { ...entry, invocationCount: 0 }
								: entry
						)
					},
					lookupAttributedQuery(query): VerifiedCompilerProjectInputEntry | undefined {
						const entry = lookup.lookupAttributedQuery(query);
						return entry !== undefined && canonicalSemanticJson(query) === firstActualKey
							? { ...entry, attributedInvocationCount: 0 }
							: entry;
					}
				})
			);
			expect(
				capabilityError(() =>
					createCompilerProjectProgramSession(fixture.semanticSnapshot, configPath, limits())
				).code
			).toBe('CAPTURE_UNAVAILABLE');
		} finally {
			fixture.cleanup();
		}
	}, 180_000);

	it('maps host boundary failures and rejects mismatched semantic source populations', () => {
		const fixture = createModuleResolutionTraceFixture();
		try {
			const configPath = consumerConfigPath(fixture);
			const lookup = projectLookup(fixture, configPath);
			const lookupSpy = vi.spyOn(
				compilerCaptureCapability,
				'getStaticSemanticSnapshotCompilerProjectInputLookup'
			);
			const program = fixture.semanticSnapshot.programs.find(
				(candidate) => candidate.id === fixture.importerProgramId
			);
			if (program === undefined || program.sourceIds.length < 2)
				throw new Error('Fixture lacks the expected two-source Program.');
			const removedSourceId = program.sourceIds[0]!;

			lookupSpy.mockReturnValueOnce(lookup);
			const mismatchedProvider = frozenSnapshot(fixture.semanticSnapshot, {
				provider: Object.freeze({
					...fixture.semanticSnapshot.provider,
					version: '0.0.0' as typeof fixture.semanticSnapshot.provider.version
				})
			});
			expect(
				capabilityError(() =>
					createCompilerProjectProgramSession(mismatchedProvider, configPath, limits())
				).code
			).toBe('PROGRAM_UNAVAILABLE');

			lookupSpy.mockReturnValueOnce(lookup);
			const inconsistentCount = frozenSnapshot(fixture.semanticSnapshot, {
				programs: fixture.semanticSnapshot.programs.map((candidate) =>
					candidate.id === program.id
						? Object.freeze({ ...candidate, sourceIds: candidate.sourceIds.slice(1) })
						: candidate
				)
			});
			expect(
				capabilityError(() =>
					createCompilerProjectProgramSession(inconsistentCount, configPath, limits())
				).code
			).toBe('CAPTURE_UNAVAILABLE');

			lookupSpy.mockReturnValueOnce(lookup);
			const missingExpectedSource = frozenSnapshot(fixture.semanticSnapshot, {
				programs: fixture.semanticSnapshot.programs.map((candidate) =>
					candidate.id === program.id
						? Object.freeze({ ...candidate, sourceIds: candidate.sourceIds.slice(1) })
						: candidate
				),
				sources: fixture.semanticSnapshot.sources.filter((source) => source.id !== removedSourceId)
			});
			expect(
				capabilityError(() =>
					createCompilerProjectProgramSession(missingExpectedSource, configPath, limits())
				).code
			).toBe('CAPTURE_UNAVAILABLE');

			lookupSpy.mockReturnValueOnce(lookup);
			const absentExpectedSource = frozenSnapshot(fixture.semanticSnapshot, {
				programs: fixture.semanticSnapshot.programs.map((candidate) =>
					candidate.id === program.id
						? Object.freeze({
								...candidate,
								sourceIds: [
									...candidate.sourceIds,
									'f'.repeat(64) as (typeof candidate.sourceIds)[number]
								]
							})
						: candidate
				)
			});
			expect(
				capabilityError(() =>
					createCompilerProjectProgramSession(absentExpectedSource, configPath, limits())
				).code
			).toBe('CAPTURE_UNAVAILABLE');

			const originalHostFactory =
				frozenCompilerHost.createPrevalidatedVerifiedCompilerProjectInputHost;
			const hostSpy = vi.spyOn(
				frozenCompilerHost,
				'createPrevalidatedVerifiedCompilerProjectInputHost'
			);
			hostSpy.mockImplementationOnce(() => {
				throw new CompilerInputCaptureError('INVALID_CAPTURE', 'injected host capture failure');
			});
			expect(
				capabilityError(() =>
					createCompilerProjectProgramSession(fixture.semanticSnapshot, configPath, limits())
				).code
			).toBe('CAPTURE_UNAVAILABLE');

			let postHostNow = 0;
			hostSpy.mockImplementationOnce((...args) => {
				const host = originalHostFactory(...args);
				postHostNow = 2;
				return new Proxy(host, {
					ownKeys() {
						throw new Error('host inspection must not precede the provider deadline check');
					}
				});
			});
			expect(
				capabilityError(() =>
					createCompilerProjectProgramSession(
						fixture.semanticSnapshot,
						configPath,
						limits({ maxDurationMs: 1 }),
						{ now: () => postHostNow }
					)
				).code
			).toBe('BUDGET_EXCEEDED');

			hostSpy.mockImplementationOnce((materialized, digest, boundLookup, budgets, callbacks) => {
				let progressCalls = 0;
				return originalHostFactory(materialized, digest, boundLookup, budgets, {
					...callbacks,
					assertWithinDeadline() {
						progressCalls += 1;
						if (progressCalls === 8)
							throw new CompilerProjectProgramCapabilityError(
								'BUDGET_EXCEEDED',
								'injected materialized-recipe deadline'
							);
						callbacks.assertWithinDeadline();
					}
				});
			});
			expect(
				capabilityError(() =>
					createCompilerProjectProgramSession(fixture.semanticSnapshot, configPath, limits())
				).code
			).toBe('BUDGET_EXCEEDED');

			hostSpy.mockImplementationOnce(() => {
				throw new Error('injected host construction failure');
			});
			expect(
				capabilityError(() =>
					createCompilerProjectProgramSession(fixture.semanticSnapshot, configPath, limits())
				).code
			).toBe('PROGRAM_UNAVAILABLE');

			hostSpy.mockImplementationOnce((...args) => {
				const host = originalHostFactory(...args);
				return {
					...host,
					getSourceFile() {
						throw new Error('injected Program host failure');
					}
				};
			});
			expect(
				capabilityError(() =>
					createCompilerProjectProgramSession(fixture.semanticSnapshot, configPath, limits())
				).code
			).toBe('PROGRAM_UNAVAILABLE');
		} finally {
			fixture.cleanup();
		}
	}, 180_000);

	it('gives deadline exhaustion precedence over an absent verified-host lookup return', () => {
		const fixture = createModuleResolutionTraceFixture();
		try {
			const configPath = consumerConfigPath(fixture);
			const lookup = projectLookup(fixture, configPath);
			let expired = false;
			const expiringLookup: VerifiedCompilerProjectInputLookup = Object.freeze({
				attribution: lookup.attribution,
				lookupAttributedQuery: (query: CompilerInputQuery, onProgress?: () => void) =>
					lookup.lookupAttributedQuery(query, onProgress),
				subjectId: lookup.subjectId,
				toRecordedAbsolute: (logicalPath: string) => lookup.toRecordedAbsolute(logicalPath),
				toRecordedLogical: (path: string) => lookup.toRecordedLogical(path),
				withAttributedQueryForVerifiedHost(
					query: CompilerInputQuery,
					onProgress: () => void,
					consumer: (entry: BorrowedVerifiedCompilerProjectInputEntry) => void
				) {
					lookup.withAttributedQueryForVerifiedHost(query, onProgress, consumer);
					expired = true;
					return false;
				}
			});
			vi.spyOn(
				compilerCaptureCapability,
				'getStaticSemanticSnapshotCompilerProjectInputLookup'
			).mockReturnValue(expiringLookup);
			expect(
				capabilityError(() =>
					createCompilerProjectProgramSession(
						fixture.semanticSnapshot,
						configPath,
						limits({ maxDurationMs: 1 }),
						{ now: () => (expired ? 2 : 0) }
					)
				).code
			).toBe('BUDGET_EXCEEDED');
		} finally {
			fixture.cleanup();
		}
	}, 180_000);

	it('fails an explicit parse when its captured read is absent', () => {
		const fixture = createModuleResolutionTraceFixture();
		try {
			const configPath = consumerConfigPath(fixture);
			const lookup = projectLookup(fixture, configPath);
			const targetRead = lookup.lookupAttributedQuery({
				logicalPath: fixture.targetPath,
				operation: 'READ_FILE'
			});
			if (
				targetRead === undefined ||
				targetRead.observation.operation !== 'READ_FILE' ||
				targetRead.observation.result !== 'PRESENT'
			)
				throw new Error('Fixture attribution lacks its present target read.');
			const {
				byteBudgetClass: _byteBudgetClass,
				contentBytes: _contentBytes,
				contentSha256: _contentSha256,
				...targetObservationBase
			} = targetRead.observation;
			const absentTargetRead: VerifiedCompilerProjectInputEntry = {
				attributedInvocationCount: targetRead.attributedInvocationCount,
				observation: { ...targetObservationBase, result: 'ABSENT' },
				query: targetRead.query
			};
			let sessionReady = false;
			const wrappedLookup = lookupWith(lookup, {
				lookupAttributedQuery(query) {
					const entry = lookup.lookupAttributedQuery(query);
					if (
						sessionReady &&
						query.operation === 'READ_FILE' &&
						query.logicalPath === fixture.targetPath &&
						entry !== undefined
					)
						return {
							...absentTargetRead,
							attributedInvocationCount: entry.attributedInvocationCount,
							query
						};
					return entry;
				}
			});
			vi.spyOn(
				compilerCaptureCapability,
				'getStaticSemanticSnapshotCompilerProjectInputLookup'
			).mockReturnValueOnce(wrappedLookup);
			const session = createCompilerProjectProgramSession(
				fixture.semanticSnapshot,
				configPath,
				limits()
			);
			sessionReady = true;
			expect(capabilityError(() => session.parseCapturedSourceFile(fixture.targetPath)).code).toBe(
				'CAPTURE_UNAVAILABLE'
			);

			const originalHostFactory =
				frozenCompilerHost.createPrevalidatedVerifiedCompilerProjectInputHost;
			const hostSpy = vi.spyOn(
				frozenCompilerHost,
				'createPrevalidatedVerifiedCompilerProjectInputHost'
			);
			hostSpy.mockImplementationOnce((materialized, digest, boundLookup, budgets, callbacks) =>
				originalHostFactory(materialized, digest, boundLookup, budgets, {
					...callbacks,
					onInput(entry) {
						callbacks.onInput(entry, null);
					}
				})
			);
			const missingEncodingSession = createCompilerProjectProgramSession(
				fixture.semanticSnapshot,
				configPath,
				limits()
			);
			expect(
				capabilityError(() => missingEncodingSession.parseCapturedSourceFile(fixture.targetPath))
					.code
			).toBe('CAPTURE_UNAVAILABLE');

			let bypassCapturedRead = false;
			hostSpy.mockImplementationOnce((...args) => {
				const host = originalHostFactory(...args);
				return {
					...host,
					readFile(path: string) {
						return bypassCapturedRead ? 'export declare const target: 7;\n' : host.readFile(path);
					}
				};
			});
			const missingWitnessSession = createCompilerProjectProgramSession(
				fixture.semanticSnapshot,
				configPath,
				limits()
			);
			bypassCapturedRead = true;
			expect(
				capabilityError(() => missingWitnessSession.parseCapturedSourceFile(fixture.targetPath))
					.code
			).toBe('CAPTURE_UNAVAILABLE');
		} finally {
			fixture.cleanup();
		}
	}, 180_000);

	it('checks elapsed duration again around explicit parse and final evidence work', () => {
		const fixture = createModuleResolutionTraceFixture();
		try {
			const configPath = consumerConfigPath(fixture);
			let parseClockCalls = 0;
			let parseExpiryCall = Number.MAX_SAFE_INTEGER;
			const parseSession = createCompilerProjectProgramSession(
				fixture.semanticSnapshot,
				configPath,
				limits({ maxDurationMs: 1 }),
				{ now: () => (++parseClockCalls >= parseExpiryCall ? 2 : 0) }
			);
			parseExpiryCall = parseClockCalls + 2;
			expect(
				capabilityError(() => parseSession.parseCapturedSourceFile(fixture.targetPath)).code
			).toBe('BUDGET_EXCEEDED');

			let finalizeClockCalls = 0;
			let finalizeExpiryCall = Number.MAX_SAFE_INTEGER;
			const finalizeSession = createCompilerProjectProgramSession(
				fixture.semanticSnapshot,
				configPath,
				limits({ maxDurationMs: 1 }),
				{ now: () => (++finalizeClockCalls >= finalizeExpiryCall ? 2 : 0) }
			);
			finalizeExpiryCall = finalizeClockCalls + 3;
			expect(capabilityError(() => finalizeSession.finalize()).code).toBe('BUDGET_EXCEEDED');
		} finally {
			fixture.cleanup();
		}
	}, 180_000);
});
