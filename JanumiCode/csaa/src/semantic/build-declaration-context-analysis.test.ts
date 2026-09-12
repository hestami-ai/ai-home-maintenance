import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import ts from 'typescript';

import type {
	DeclarationContextAnalysisBuildInputs,
	DeclarationContextAnalysisBuildOutcome,
	DeclarationContextAnalysisSnapshot,
	DeclarationContextProgramSourceIdentity
} from '../contracts/declaration-context-analysis.js';
import * as graphValidator from '../graph/validate-project-context-graph.js';
import { sha256 } from '../inventory/canonical.js';
import * as conditionalValidator from '../resolution/validate-conditional-export-resolution.js';
import * as traceValidator from '../resolution/validate-module-resolution-trace.js';
import {
	buildDeclarationContextAnalysis,
	declarationContextAnalysisCompilerProgramCapability,
	declarationContextAnalysisTypeScriptPublicApi
} from './build-declaration-context-analysis.js';
import { canonicalSemanticJson, canonicalSemanticJsonPrefixedSha256 } from './canonical.js';
import {
	CompilerProjectProgramCapabilityError,
	type CompilerProjectProgramSession
} from './compiler-project-program-capability.js';
import {
	createDeclarationContextAnalysisFixture,
	declarationContextAnalysisInputs,
	type DeclarationContextAnalysisFixture
} from './declaration-context-analysis-fixture.test-support.js';
import { validateDeclarationContextAnalysis } from './validate-declaration-context-analysis.js';
import { declarationContextProgramSourcePopulationDigest } from './declaration-context-analysis-canonical.js';
import * as semanticValidator from './validate-snapshot.js';

const VALID = { issues: [], state: 'VALID' } as const;

function expectUnavailable(
	outcome: DeclarationContextAnalysisBuildOutcome,
	code: string,
	message: string
): void {
	expect(outcome.outcome).toBe('unavailable');
	if (outcome.outcome === 'unavailable') {
		expect(outcome.diagnostics[0]).toMatchObject({ code, message });
	}
}

function acceptCorruptPredecessors(): void {
	vi.spyOn(semanticValidator, 'validateStaticSemanticSnapshot').mockReturnValue(VALID as never);
	vi.spyOn(graphValidator, 'validateConstructedProjectContextGraph').mockReturnValue(
		VALID as never
	);
	vi.spyOn(conditionalValidator, 'validateConstructedConditionalExportResolution').mockReturnValue(
		VALID as never
	);
	vi.spyOn(traceValidator, 'validateConstructedModuleResolutionTrace').mockReturnValue(
		VALID as never
	);
}

function withBudgets(
	inputs: DeclarationContextAnalysisBuildInputs,
	overrides: Partial<DeclarationContextAnalysisBuildInputs['request']['budgets']>
): DeclarationContextAnalysisBuildInputs {
	return {
		...inputs,
		request: {
			...inputs.request,
			budgets: { ...inputs.request.budgets, ...overrides }
		}
	};
}

function mockCompilerSession(
	transform: (session: CompilerProjectProgramSession) => CompilerProjectProgramSession
): void {
	const original =
		declarationContextAnalysisCompilerProgramCapability.createCompilerProjectProgramSession;
	vi.spyOn(
		declarationContextAnalysisCompilerProgramCapability,
		'createCompilerProjectProgramSession'
	).mockImplementation((snapshot, configPath, limits, runtimeOptions) =>
		transform(original(snapshot, configPath, limits, runtimeOptions))
	);
}

function withProgramSourceFiles(
	session: CompilerProjectProgramSession,
	getSourceFiles: CompilerProjectProgramSession['program']['getSourceFiles']
): CompilerProjectProgramSession {
	const program = new Proxy(session.program, {
		get(target, key) {
			if (key === 'getSourceFiles') return getSourceFiles;
			const value = Reflect.get(target, key, target) as unknown;
			return typeof value === 'function' ? value.bind(target) : value;
		}
	});
	return { ...session, program };
}

function requireAnalysis(
	inputs: DeclarationContextAnalysisBuildInputs
): DeclarationContextAnalysisSnapshot {
	const outcome = buildDeclarationContextAnalysis(inputs);
	if (outcome.outcome !== 'partial')
		throw new Error(`Expected partial CAP-013 analysis: ${JSON.stringify(outcome)}`);
	expect(outcome.diagnostics).toEqual([]);
	expect(validateDeclarationContextAnalysis(outcome.analysis, inputs)).toEqual({
		issues: [],
		state: 'VALID'
	});
	return outcome.analysis;
}

function expectDeeplyFrozen(value: unknown, seen = new WeakSet<object>()): void {
	if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return;
	const object = value as object;
	if (seen.has(object)) return;
	seen.add(object);
	expect(Object.isFrozen(object)).toBe(true);
	for (const key of Reflect.ownKeys(object)) {
		const descriptor = Reflect.getOwnPropertyDescriptor(object, key);
		if (descriptor !== undefined && 'value' in descriptor)
			expectDeeplyFrozen(descriptor.value, seen);
	}
}

describe('buildDeclarationContextAnalysis', () => {
	let mergedFixture: DeclarationContextAnalysisFixture;
	let singleFixture: DeclarationContextAnalysisFixture;

	beforeAll(() => {
		mergedFixture = createDeclarationContextAnalysisFixture({ declarationState: 'MERGED' });
		singleFixture = createDeclarationContextAnalysisFixture({ declarationState: 'SINGLE' });
	}, 120_000);

	afterAll(() => {
		mergedFixture.cleanup();
		singleFixture.cleanup();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('emits one byte-bound alias-to-interface/namespace merge with exact coverage', () => {
		const inputs = declarationContextAnalysisInputs(mergedFixture);
		const analysis = requireAnalysis(inputs);

		expect(analysis.exportBinding.exportName).toBe(mergedFixture.exportName);
		expect(analysis.exportBinding.resolutionKind).toBe('ALIASED_TO_TERMINAL_SYMBOL');
		expect(analysis.exportBinding.aliasHops).toHaveLength(1);
		expect(analysis.exportBinding.aliasHops[0]).toMatchObject({
			aliasName: mergedFixture.exportName,
			ordinal: 0,
			targetName: 'FixtureContract'
		});
		expect(analysis.terminalSymbol).toMatchObject({
			mergeState: 'MERGED',
			name: 'FixtureContract'
		});
		expect(analysis.declarations.map((declaration) => declaration.kind)).toEqual([
			'INTERFACE',
			'NAMESPACE'
		]);
		expect(analysis.merges).toHaveLength(1);
		expect(analysis.artifacts).toHaveLength(1);
		expect(analysis.artifacts[0]?.roles).toEqual([
			'CAP011_SELECTED_DECLARATION_TARGET',
			'SELECTED_EXPORT_BINDING_CARRIER',
			'ALIAS_DECLARATION_CONTAINER',
			'TERMINAL_DECLARATION_CONTAINER'
		]);
		expect(analysis.parseWitnesses).toHaveLength(1);
		expect(analysis.parseWitnesses[0]).toMatchObject({
			bytes: mergedFixture.moduleResolutionTrace.targetWitness.bytes,
			contentSha256: mergedFixture.moduleResolutionTrace.targetWitness.contentSha256,
			externalModule: true,
			parseDiagnostics: [],
			parseHealth: 'VALID',
			sourceEncoding: 'UTF8'
		});
		expect(analysis.coverage.inputRecords).toBe(
			analysis.coverage.programCompilerInputAttempts + analysis.coverage.artifactReadWitnesses
		);
		expect(analysis.programWitness.attributedCompilerInputAttempts).toBeGreaterThanOrEqual(
			analysis.coverage.programCompilerInputAttempts
		);
		expect(analysis.programWitness.attributedProgramReadBytes).toBeGreaterThanOrEqual(
			analysis.coverage.programReadBytes
		);
		expect(analysis.programWitness.attributedUniqueQueries).toBeGreaterThan(0);
		expect(analysis.programWitness.attributedCompilerInputAttempts).toBeLessThanOrEqual(
			analysis.budgets.maxCompilerInputAttempts
		);
		expect(analysis.programWitness.attributedProgramReadBytes).toBeLessThanOrEqual(
			analysis.budgets.maxProgramReadBytes
		);
		expect(analysis.coverage.readBytes).toBe(
			analysis.coverage.programReadBytes + analysis.coverage.artifactReadBytes
		);
		expect(analysis.coverage.relationRecords).toBe(6);
		expect(analysis.coverage.mergesWithRelations).toBe(2);
		expect(
			analysis.programInputAttempts.every((attempt, ordinal) => attempt.ordinal === ordinal)
		).toBe(true);
		expect(
			analysis.programInputAttempts.every((attempt) =>
				['PROGRAM_CONSTRUCTION', 'TYPE_CHECKER_CREATE', 'CALLER_ANALYSIS'].includes(attempt.stage)
			)
		).toBe(true);
		expectDeeplyFrozen(analysis);
		expect(analysis.budgets).not.toBe(inputs.request.budgets);
		expect(analysis.selection).not.toBe(inputs.request.selection);
		expect(analysis.projectContextGraph).not.toBe(inputs.request.projectContextGraph);
		const captured = inputs.semanticSnapshot.compilerInputs.find(
			(observation) => observation.id === analysis.programInputAttempts[0]?.observation.id
		);
		if (captured !== undefined)
			expect(analysis.programInputAttempts[0]?.observation).not.toBe(captured);
	}, 120_000);

	it('emits SINGLE for the same compiler-backed criterion without a merge record', () => {
		const inputs = declarationContextAnalysisInputs(singleFixture);
		const analysis = requireAnalysis(inputs);
		expect(analysis.terminalSymbol.mergeState).toBe('SINGLE');
		expect(analysis.declarations.map((declaration) => declaration.kind)).toEqual(['INTERFACE']);
		expect(analysis.merges).toEqual([]);
		expect(analysis.coverage.mergeRecords).toBe(0);
		expect(analysis.coverage.mergesWithRelations).toBe(0);
		expect(analysis.coverage.relationRecords).toBe(2);
	}, 120_000);

	it('is deterministic for the exact same frozen capture and request', () => {
		const inputs = declarationContextAnalysisInputs(mergedFixture);
		const first = requireAnalysis(inputs);
		const second = requireAnalysis(inputs);
		expect(second).toEqual(first);
		expect(second).not.toBe(first);
	}, 180_000);

	it('isolates asynchronous telemetry observer failures', async () => {
		const inputs = declarationContextAnalysisInputs(singleFixture);
		const events: string[] = [];
		const outcome = buildDeclarationContextAnalysis(inputs, {
			onProgress(event) {
				events.push(`${event.sequence}:${event.phase}:${event.state}`);
				throw new Error('observer failure');
			}
		});

		expect(outcome.outcome).toBe('partial');
		expect(events).toEqual([]);
		await Promise.resolve();
		expect(events[0]).toBe('0:REQUEST_BIND:STARTED');
		expect(events.at(-1)).toContain('ANALYSIS_VALIDATE:COMPLETED');
	}, 120_000);

	it('preserves the legacy domain-prefixed canonical content-digest bytes while streaming', () => {
		const analysis = requireAnalysis(declarationContextAnalysisInputs(mergedFixture));
		const { contentDigest, ...content } = analysis;
		const prefix = 'JAN-CSAA-DECLARATION-CONTEXT-ANALYSIS-CONTENT\u00001\u0000';
		const streamed = canonicalSemanticJsonPrefixedSha256(prefix, content);

		expect(streamed).toBe(sha256(`${prefix}${canonicalSemanticJson(content)}`));
		expect(contentDigest).toBe(streamed);
	}, 120_000);

	it('preserves canonical whole-record source ordering with bounded string comparison', () => {
		const sources: DeclarationContextProgramSourceIdentity[] = [
			{
				bytes: 2,
				contentSha256: 'a'.repeat(64),
				declarationFile: true,
				logicalPath: 'packages/z\n🧪.d.ts',
				origin: 'WORKSPACE_BUILD_DECLARATION',
				semanticSourceId:
					'semantic-source-z' as DeclarationContextProgramSourceIdentity['semanticSourceId']
			},
			{
				bytes: 10,
				contentSha256: '"'.repeat(64),
				declarationFile: false,
				logicalPath: 'packages/\\a.d.ts',
				origin: 'AUTHORED',
				semanticSourceId:
					'semantic-source-a' as DeclarationContextProgramSourceIdentity['semanticSourceId']
			}
		];
		const sorted = [...sources].sort((left, right) => {
			const leftCanonical = canonicalSemanticJson(left);
			const rightCanonical = canonicalSemanticJson(right);
			return leftCanonical < rightCanonical ? -1 : leftCanonical > rightCanonical ? 1 : 0;
		});
		const prefix = 'JAN-CSAA-DECLARATION-CONTEXT-PROGRAM-SOURCE-POPULATION\0' + '1\0';
		expect(declarationContextProgramSourcePopulationDigest(sources)).toBe(
			sha256(`${prefix}${canonicalSemanticJson(sorted)}`)
		);
		expect(declarationContextProgramSourcePopulationDigest([...sources].reverse())).toBe(
			declarationContextProgramSourcePopulationDigest(sources)
		);

		const base: DeclarationContextProgramSourceIdentity = {
			bytes: 7,
			contentSha256: 'a'.repeat(64),
			declarationFile: false,
			logicalPath: 'packages/a.d.ts',
			origin: 'AUTHORED',
			semanticSourceId:
				'semantic-source-a' as DeclarationContextProgramSourceIdentity['semanticSourceId']
		};
		const fieldOrderedPairs: readonly (readonly [
			DeclarationContextProgramSourceIdentity,
			DeclarationContextProgramSourceIdentity
		])[] = [
			[
				{ ...base, contentSha256: 'a'.repeat(64) },
				{ ...base, contentSha256: 'b'.repeat(64) }
			],
			[
				{ ...base, declarationFile: false },
				{ ...base, declarationFile: true }
			],
			[
				{ ...base, logicalPath: 'packages/a.d.ts' },
				{ ...base, logicalPath: 'packages/b.d.ts' }
			],
			[
				{ ...base, origin: 'AUTHORED' },
				{ ...base, origin: 'WORKSPACE_BUILD_DECLARATION' }
			],
			[
				{
					...base,
					semanticSourceId:
						'semantic-source-a' as DeclarationContextProgramSourceIdentity['semanticSourceId']
				},
				{
					...base,
					semanticSourceId:
						'semantic-source-b' as DeclarationContextProgramSourceIdentity['semanticSourceId']
				}
			]
		];
		for (const pair of fieldOrderedPairs) {
			const legacySorted = [...pair].sort((left, right) => {
				const leftCanonical = canonicalSemanticJson(left);
				const rightCanonical = canonicalSemanticJson(right);
				return leftCanonical < rightCanonical ? -1 : leftCanonical > rightCanonical ? 1 : 0;
			});
			expect(
				declarationContextProgramSourcePopulationDigest([...pair].reverse(), () => undefined)
			).toBe(sha256(`${prefix}${canonicalSemanticJson(legacySorted)}`));
		}
	});

	it('fails closed on a nested selection disagreement and compiler capability edge failures', () => {
		const inputs = declarationContextAnalysisInputs(singleFixture);
		const selectionMismatch = buildDeclarationContextAnalysis({
			...inputs,
			request: {
				...inputs.request,
				selection: {
					...inputs.request.selection,
					declarationKindProfile: {
						...inputs.request.selection.declarationKindProfile,
						ClassDeclaration: 'UNSUPPORTED_CLASS_KIND'
					}
				} as never
			}
		});
		expectUnavailable(
			selectionMismatch,
			'UNSUPPORTED_REQUEST',
			'The declaration-context request version, operation, or selection is unsupported.'
		);

		vi.spyOn(
			declarationContextAnalysisCompilerProgramCapability,
			'createCompilerProjectProgramSession'
		).mockImplementation(() => {
			throw new CompilerProjectProgramCapabilityError(
				'PROGRAM_UNAVAILABLE',
				'injected unavailable Program'
			);
		});
		expectUnavailable(
			buildDeclarationContextAnalysis(inputs),
			'PROGRAM_CONSTRUCTION_UNAVAILABLE',
			'Fresh captured TypeScript Program operation failed closed.'
		);
		vi.restoreAllMocks();

		mockCompilerSession((session) => ({
			...session,
			finalize() {
				return {
					...session.finalize(),
					programCompilerHostCallbacks: Number.MAX_SAFE_INTEGER
				};
			}
		}));
		expectUnavailable(
			buildDeclarationContextAnalysis(inputs),
			'BUDGET_EXCEEDED',
			'An exact declaration-context population exceeds safe-integer range.'
		);
	}, 180_000);

	it('rejects corrupt semantic and trace populations at their exact binding boundaries', () => {
		const inputs = declarationContextAnalysisInputs(singleFixture);
		const target = inputs.moduleResolutionTrace.targetWitness;
		const targetProgram = inputs.semanticSnapshot.programs.find(
			(program) => program.id === target.semanticProgramId
		)!;
		const targetSource = inputs.semanticSnapshot.sources.find(
			(source) => source.id === target.semanticSourceId
		)!;
		const cases: readonly {
			readonly candidate: DeclarationContextAnalysisBuildInputs;
			readonly message: string;
			readonly code?: string;
		}[] = [
			{
				candidate: {
					...inputs,
					semanticSnapshot: {
						...inputs.semanticSnapshot,
						programs: [...inputs.semanticSnapshot.programs, { ...targetProgram }]
					}
				},
				message: 'The CAP-011 target semantic Program is not uniquely present.'
			},
			{
				candidate: {
					...inputs,
					semanticSnapshot: {
						...inputs.semanticSnapshot,
						sources: [...inputs.semanticSnapshot.sources, { ...targetSource }]
					}
				},
				message: 'The selected semantic Program repeats a logical source path.'
			},
			{
				candidate: {
					...inputs,
					semanticSnapshot: {
						...inputs.semanticSnapshot,
						programs: inputs.semanticSnapshot.programs.map((program) =>
							program.id === targetProgram.id ? { ...program, sourceIds: [] } : program
						)
					}
				},
				message: 'The semantic Program source population does not reproduce its source IDs.'
			},
			{
				candidate: {
					...inputs,
					moduleResolutionTrace: {
						...inputs.moduleResolutionTrace,
						targetWitness: {
							...target,
							semanticSourceId: 'semantic:missing-source' as never
						}
					}
				},
				message: 'The CAP-011 declaration target source is not uniquely present in its Program.'
			},
			{
				candidate: {
					...inputs,
					moduleResolutionTrace: {
						...inputs.moduleResolutionTrace,
						targetWitness: { ...target, bytes: target.bytes + 1 }
					}
				},
				message: 'The CAP-011 target does not reproduce one exact context-only semantic source.'
			},
			{
				candidate: {
					...inputs,
					semanticSnapshot: {
						...inputs.semanticSnapshot,
						programs: inputs.semanticSnapshot.programs.map((program) =>
							program.id === targetProgram.id
								? { ...program, projectId: 'semantic:missing-project' as never }
								: program
						)
					}
				},
				message: 'The target semantic project and Program do not bind bidirectionally.'
			},
			{
				candidate: {
					...inputs,
					moduleResolutionTrace: {
						...inputs.moduleResolutionTrace,
						importerWitness: {
							...inputs.moduleResolutionTrace.importerWitness,
							projectContextProgramId: 'project-context:missing-program' as never
						}
					}
				},
				code: 'INPUT_IDENTITY_MISMATCH',
				message: 'The CAP-011 importer and CAP-010 target Program context do not bind exactly.'
			}
		];

		for (const { candidate, code = 'INPUT_POPULATION_MISMATCH', message } of cases) {
			acceptCorruptPredecessors();
			expectUnavailable(buildDeclarationContextAnalysis(candidate), code, message);
			vi.restoreAllMocks();
		}
	}, 180_000);

	it('rejects corrupt CAP-010 source populations after fresh Program construction', () => {
		const inputs = declarationContextAnalysisInputs(singleFixture);
		const targetProgramId = inputs.moduleResolutionTrace.targetWitness.semanticProgramId;
		const semanticProgram = inputs.semanticSnapshot.programs.find(
			(program) => program.id === targetProgramId
		)!;
		const contextProgram = inputs.projectContextGraph.programs.find(
			(program) => program.semanticProgramId === targetProgramId
		)!;
		const sourceIds = [...contextProgram.sourceIds];
		expect(sourceIds.length).toBeGreaterThan(1);

		const withContextSourceIds = (
			updatedSourceIds: readonly (typeof sourceIds)[number][]
		): DeclarationContextAnalysisBuildInputs => ({
			...inputs,
			projectContextGraph: {
				...inputs.projectContextGraph,
				programs: inputs.projectContextGraph.programs.map((program) =>
					program.id === contextProgram.id ? { ...program, sourceIds: updatedSourceIds } : program
				)
			}
		});
		const cases: readonly {
			readonly candidate: DeclarationContextAnalysisBuildInputs;
			readonly code: string;
			readonly message: string;
		}[] = [
			{
				candidate: withBudgets(withContextSourceIds([...sourceIds, sourceIds[0]!]), {
					maxProgramSourceFiles: semanticProgram.sourceIds.length
				}),
				code: 'BUDGET_EXCEEDED',
				message:
					'The selected project-context Program source population exceeds maxProgramSourceFiles.'
			},
			{
				candidate: withContextSourceIds(sourceIds.slice(0, -1)),
				code: 'INPUT_POPULATION_MISMATCH',
				message: 'The fresh Program and selected project-context Program source populations differ.'
			},
			{
				candidate: withContextSourceIds([...sourceIds.slice(0, -1), sourceIds[0]!]),
				code: 'INPUT_POPULATION_MISMATCH',
				message: 'The selected project-context Program repeats a source identity.'
			},
			{
				candidate: withContextSourceIds([
					...sourceIds.slice(0, -1),
					'project-context:missing-source' as never
				]),
				code: 'INPUT_POPULATION_MISMATCH',
				message: 'The selected project-context Program contains an unavailable source identity.'
			},
			{
				candidate: {
					...inputs,
					projectContextGraph: {
						...inputs.projectContextGraph,
						sources: inputs.projectContextGraph.sources.map((source) =>
							source.id === sourceIds[0]
								? { ...source, semanticSourceId: 'semantic:missing-source' as never }
								: source
						)
					}
				},
				code: 'INPUT_POPULATION_MISMATCH',
				message: 'The fresh Program source population does not reconcile exactly with CAP-010.'
			}
		];

		for (const { candidate, code, message } of cases) {
			acceptCorruptPredecessors();
			expectUnavailable(buildDeclarationContextAnalysis(candidate), code, message);
			vi.restoreAllMocks();
		}
	}, 180_000);

	it('enforces the fresh Program population and AST root budgets independently', () => {
		const inputs = declarationContextAnalysisInputs(singleFixture);
		const targetProgram = inputs.semanticSnapshot.programs.find(
			(program) => program.id === inputs.moduleResolutionTrace.targetWitness.semanticProgramId
		)!;

		mockCompilerSession((session) => {
			const sourceFiles = session.program.getSourceFiles();
			return withProgramSourceFiles(session, () => [...sourceFiles, sourceFiles[0]!]);
		});
		expectUnavailable(
			buildDeclarationContextAnalysis(
				withBudgets(inputs, { maxProgramSourceFiles: targetProgram.sourceIds.length })
			),
			'BUDGET_EXCEEDED',
			'The fresh Program source population exceeds maxProgramSourceFiles.'
		);
		vi.restoreAllMocks();

		vi.spyOn(declarationContextAnalysisTypeScriptPublicApi, 'forEachChild').mockImplementation(
			() => undefined
		);
		expectUnavailable(
			buildDeclarationContextAnalysis(withBudgets(inputs, { maxProgramAstNodes: 1 })),
			'BUDGET_EXCEEDED',
			'Public TypeScript AST traversal exhausted its exact node budget.'
		);
	}, 180_000);

	it('fails closed when checker declaration and root-export censuses disagree with exact parses', () => {
		const inputs = declarationContextAnalysisInputs(mergedFixture);
		const getDeclarations = declarationContextAnalysisTypeScriptPublicApi.getDeclarations;
		let declarationCalls = 0;
		vi.spyOn(declarationContextAnalysisTypeScriptPublicApi, 'getDeclarations').mockImplementation(
			(symbol) => {
				const declarations = getDeclarations(symbol);
				declarationCalls += 1;
				if (declarationCalls !== 2 || declarations?.[0] === undefined) return declarations;
				const duplicate = new Proxy(declarations[0], {
					get(target, key) {
						const value = Reflect.get(target, key, target) as unknown;
						return typeof value === 'function' ? value.bind(target) : value;
					}
				});
				return [...declarations, duplicate];
			}
		);
		expectUnavailable(
			buildDeclarationContextAnalysis(inputs),
			'TARGET_UNAVAILABLE',
			'The independently parsed terminal declaration census does not reproduce the complete checker declaration multiset.'
		);
		vi.restoreAllMocks();

		declarationCalls = 0;
		vi.spyOn(declarationContextAnalysisTypeScriptPublicApi, 'getDeclarations').mockImplementation(
			(symbol) => {
				const declarations = getDeclarations(symbol);
				declarationCalls += 1;
				if (declarationCalls !== 1 || declarations?.[0] === undefined) return declarations;
				const declaration = declarations[0];
				const shifted = new Proxy(declaration, {
					get(target, key) {
						if (key === 'getStart')
							return (...args: unknown[]) => target.getStart(...(args as [])) + 1;
						const value = Reflect.get(target, key, target) as unknown;
						return typeof value === 'function' ? value.bind(target) : value;
					}
				});
				return [shifted];
			}
		);
		expectUnavailable(
			buildDeclarationContextAnalysis(inputs),
			'TARGET_UNAVAILABLE',
			'The independently parsed selected-name root ExportSpecifier census does not reproduce the checker alias declaration.'
		);
	}, 180_000);

	it('rejects a declaration target whose reconciled logical path has an unsupported extension', () => {
		const inputs = declarationContextAnalysisInputs(singleFixture);
		const target = inputs.moduleResolutionTrace.targetWitness;
		const unsupportedPath = target.logicalPath.replace(/\.d\.(?:c|m)?ts$/u, '.declaration');
		const candidate: DeclarationContextAnalysisBuildInputs = {
			...inputs,
			moduleResolutionTrace: {
				...inputs.moduleResolutionTrace,
				targetWitness: { ...target, logicalPath: unsupportedPath }
			},
			projectContextGraph: {
				...inputs.projectContextGraph,
				sources: inputs.projectContextGraph.sources.map((source) =>
					source.semanticSourceId === target.semanticSourceId
						? { ...source, logicalPath: unsupportedPath }
						: source
				)
			},
			semanticSnapshot: {
				...inputs.semanticSnapshot,
				sources: inputs.semanticSnapshot.sources.map((source) =>
					source.id === target.semanticSourceId
						? { ...source, logicalPath: unsupportedPath }
						: source
				)
			}
		};
		acceptCorruptPredecessors();
		const createSession =
			declarationContextAnalysisCompilerProgramCapability.createCompilerProjectProgramSession;
		vi.spyOn(
			declarationContextAnalysisCompilerProgramCapability,
			'createCompilerProjectProgramSession'
		).mockImplementation((_snapshot, configPath, limits, runtimeOptions) => {
			const session = createSession(inputs.semanticSnapshot, configPath, limits, runtimeOptions);
			return {
				...session,
				toLogicalPath(path) {
					const logicalPath = session.toLogicalPath(path);
					return logicalPath === target.logicalPath ? unsupportedPath : logicalPath;
				}
			};
		});

		expectUnavailable(
			buildDeclarationContextAnalysis(candidate),
			'UNSUPPORTED_REQUEST',
			'Consumed declaration artifacts must use a supported declaration extension.'
		);
	}, 180_000);

	it('fails closed on malformed public AST child populations at independent parse time', () => {
		const inputs = declarationContextAnalysisInputs(singleFixture);
		const forEachChild = declarationContextAnalysisTypeScriptPublicApi.forEachChild;

		const runWithInjectedNode = (
			createNode: (sourceFile: ts.SourceFile) => ts.Node
		): DeclarationContextAnalysisBuildOutcome => {
			let parsedRoot: ts.SourceFile | undefined;
			let injectedNode: ts.Node | undefined;
			mockCompilerSession((session) => ({
				...session,
				parseCapturedSourceFile(logicalPath) {
					const parsed = session.parseCapturedSourceFile(logicalPath);
					parsedRoot = parsed.sourceFile;
					injectedNode = createNode(parsed.sourceFile);
					return parsed;
				}
			}));
			vi.spyOn(declarationContextAnalysisTypeScriptPublicApi, 'forEachChild').mockImplementation(((
				node,
				callback,
				callbackNodes
			) => {
				if (node === injectedNode) return undefined;
				const result = forEachChild(node, callback, callbackNodes);
				if (node === parsedRoot && injectedNode !== undefined) callback(injectedNode);
				return result;
			}) as typeof forEachChild);
			return buildDeclarationContextAnalysis(inputs);
		};

		const nestedBinding = runWithInjectedNode(
			(sourceFile) =>
				({
					kind: ts.SyntaxKind.BindingElement,
					name: { kind: ts.SyntaxKind.Identifier, text: 'NestedBinding' },
					parent: {
						kind: ts.SyntaxKind.ObjectBindingPattern,
						parent: {
							kind: ts.SyntaxKind.VariableDeclaration,
							parent: {
								kind: ts.SyntaxKind.VariableDeclarationList,
								parent: {
									kind: ts.SyntaxKind.VariableStatement,
									parent: { kind: ts.SyntaxKind.ModuleBlock, parent: sourceFile }
								}
							}
						}
					}
				}) as unknown as ts.Node
		);
		expectUnavailable(
			nestedBinding,
			'VALIDATION_FAILED',
			'The constructed declaration-context analysis failed independent validation: The candidate differs from the independently replayed declaration-context analysis.'
		);
		vi.restoreAllMocks();

		const unsupportedTerminal = runWithInjectedNode(
			(sourceFile) =>
				({
					kind: ts.SyntaxKind.MethodDeclaration,
					name: { kind: ts.SyntaxKind.Identifier, text: 'FixtureContract' },
					parent: sourceFile
				}) as unknown as ts.Node
		);
		expectUnavailable(
			unsupportedTerminal,
			'UNSUPPORTED_REQUEST',
			'An independently parsed top-level terminal-name binding has an unsupported declaration kind.'
		);
	}, 180_000);

	it('rejects a checker terminal population spanning two declaration artifacts', () => {
		const crossFileFixture = createDeclarationContextAnalysisFixture({
			declarationState: 'SINGLE',
			targetDeclarationText:
				"interface FixtureContract { readonly value: string; }\nexport { FixtureContract as SelectedContract };\nimport type {} from './terminal.js';\n",
			targetSiblingDeclarationText: 'export interface SiblingContract {}\n'
		});
		try {
			const inputs = declarationContextAnalysisInputs(crossFileFixture);
			let siblingSource: ts.SourceFile | undefined;
			mockCompilerSession((session) => {
				siblingSource = session.program
					.getSourceFiles()
					.find((source) => session.toLogicalPath(source.fileName).endsWith('/terminal.d.ts'));
				return session;
			});
			const getDeclarations = declarationContextAnalysisTypeScriptPublicApi.getDeclarations;
			let declarationCalls = 0;
			vi.spyOn(declarationContextAnalysisTypeScriptPublicApi, 'getDeclarations').mockImplementation(
				(symbol) => {
					const declarations = getDeclarations(symbol);
					declarationCalls += 1;
					if (
						declarationCalls !== 2 ||
						declarations?.[0] === undefined ||
						siblingSource === undefined
					)
						return declarations;
					const sourceFile = siblingSource;
					const crossFile = new Proxy(declarations[0], {
						get(target, key) {
							if (key === 'getSourceFile') return () => sourceFile;
							const value = Reflect.get(target, key, target) as unknown;
							return typeof value === 'function' ? value.bind(target) : value;
						}
					});
					return [...declarations, crossFile];
				}
			);

			expectUnavailable(
				buildDeclarationContextAnalysis(inputs),
				'UNSUPPORTED_REQUEST',
				'Cross-file terminal symbol declaration merging is unsupported by the v1 slice.'
			);
		} finally {
			crossFileFixture.cleanup();
		}
	}, 180_000);

	it('fails closed when collection providers corrupt canonical artifact populations', () => {
		const inputs = declarationContextAnalysisInputs(singleFixture);
		const mapGet = Map.prototype.get;
		const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
			value !== null && typeof value === 'object';
		const isParseWitness = (value: unknown): boolean =>
			isRecord(value) &&
			value.parseMethod === 'TYPESCRIPT_PUBLIC_CREATE_SOURCE_FILE_OVER_EXACT_CAPTURED_BYTES';
		const isArtifactRecord = (value: unknown): boolean =>
			isRecord(value) && value.artifactClass === 'CONTEXT_ONLY' && 'parseWitnessId' in value;
		const cases = [
			{
				message: 'One declaration artifact lacks its parse witness.',
				ordinal: 1,
				shouldLose: isParseWitness
			},
			{
				message: 'One terminal declaration lacks artifact and parse identities.',
				ordinal: 1,
				shouldLose: isArtifactRecord
			},
			{
				message: 'The terminal symbol artifact is unavailable after canonical ordering.',
				ordinal: 2,
				shouldLose: isArtifactRecord
			},
			{
				message: 'One alias hop lost all declaration-artifact identities.',
				ordinal: 3,
				shouldLose: isArtifactRecord
			},
			{
				message: 'The CAP-011 root artifact is unavailable after canonical ordering.',
				ordinal: 4,
				shouldLose: isArtifactRecord
			}
		] as const;

		for (const { message, ordinal, shouldLose } of cases) {
			let matchingGets = 0;
			vi.spyOn(Map.prototype, 'get').mockImplementation(function (
				this: Map<unknown, unknown>,
				key: unknown
			) {
				const value = Reflect.apply(mapGet, this, [key]) as unknown;
				if (!shouldLose(value)) return value;
				matchingGets += 1;
				return matchingGets === ordinal ? undefined : value;
			} as never);
			expectUnavailable(
				buildDeclarationContextAnalysis(inputs),
				'INPUT_POPULATION_MISMATCH',
				message
			);
			vi.restoreAllMocks();
		}
	}, 180_000);

	it('charges canonical artifact ordering before refusing an injected collection entry', () => {
		const inputs = declarationContextAnalysisInputs(singleFixture);
		const targetPath = inputs.moduleResolutionTrace.targetWitness.logicalPath;
		const mapSet = Map.prototype.set;
		let injected = false;
		vi.spyOn(Map.prototype, 'set').mockImplementation(function (
			this: Map<unknown, unknown>,
			key: unknown,
			value: unknown
		) {
			const result = Reflect.apply(mapSet, this, [key, value]);
			if (
				!injected &&
				key === targetPath &&
				value !== null &&
				typeof value === 'object' &&
				'roles' in value &&
				value.roles instanceof Set &&
				'sourceFile' in value
			) {
				Reflect.apply(mapSet, this, [
					'zz-injected-artifact.d.ts',
					{
						logicalPath: 'zz-injected-artifact.d.ts',
						roles: new Set(),
						source: { id: 'semantic:injected-source' },
						sourceFile: null
					}
				]);
				injected = true;
			}
			return result;
		} as never);

		expectUnavailable(
			buildDeclarationContextAnalysis(inputs),
			'PROGRAM_CONSTRUCTION_UNAVAILABLE',
			'Fresh captured TypeScript Program operation failed closed.'
		);
	}, 180_000);
});
