import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import ts from 'typescript';

import {
	DECLARATION_CONTEXT_ANALYSIS_PROGRESS_SCHEMA_VERSION,
	DECLARATION_CONTEXT_ANALYSIS_SELECTION,
	type DeclarationContextAnalysisBuildInputs,
	type DeclarationContextAnalysisBuildOutcome,
	type DeclarationContextAnalysisProgressEvent,
	type DeclarationContextAnalysisSnapshot,
	type DeclarationContextAnalysisValidationResult
} from '../contracts/declaration-context-analysis.js';
import * as graphValidator from '../graph/validate-project-context-graph.js';
import * as conditionalValidator from '../resolution/validate-conditional-export-resolution.js';
import * as traceValidator from '../resolution/validate-module-resolution-trace.js';
import * as compilerProgramCapability from './compiler-project-program-capability.js';
import type { CompilerProjectProgramSession } from './compiler-project-program-capability.js';
import {
	buildDeclarationContextAnalysis,
	declarationContextAnalysisCompilerProgramCapability,
	declarationContextAnalysisTypeScriptPublicApi
} from './build-declaration-context-analysis.js';
import {
	createDeclarationContextAnalysisFixture,
	declarationContextAnalysisInputs,
	type DeclarationContextAnalysisFixture
} from './declaration-context-analysis-fixture.test-support.js';
import { declarationContextAnalysisContentDigest } from './declaration-context-analysis-canonical.js';
import * as operationClock from './monotonic-operation-clock.js';
import * as semanticValidator from './validate-snapshot.js';
import * as analysisValidator from './validate-declaration-context-analysis.js';

const VALID = { issues: [], state: 'VALID' } as const;

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

function withRequest(
	inputs: DeclarationContextAnalysisBuildInputs,
	overrides: Partial<DeclarationContextAnalysisBuildInputs['request']>
): DeclarationContextAnalysisBuildInputs {
	return { ...inputs, request: { ...inputs.request, ...overrides } };
}

function expectUnavailable(
	outcome: DeclarationContextAnalysisBuildOutcome,
	code?: DeclarationContextAnalysisBuildOutcome extends never ? never : string
): void {
	expect(outcome.outcome).toBe('unavailable');
	if (outcome.outcome === 'unavailable' && code !== undefined)
		expect(outcome.diagnostics[0]?.code).toBe(code);
}

function requirePartial(
	inputs: DeclarationContextAnalysisBuildInputs
): DeclarationContextAnalysisSnapshot {
	const outcome = buildDeclarationContextAnalysis(inputs);
	if (outcome.outcome !== 'partial')
		throw new Error(`Expected partial analysis: ${JSON.stringify(outcome)}`);
	return outcome.analysis;
}

function invalidValidation(
	state: 'BUDGET_EXHAUSTED' | 'INVALID' = 'INVALID'
): DeclarationContextAnalysisValidationResult {
	return {
		issues: [
			{
				code: state === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXHAUSTED' : 'INPUT_INVALID',
				message: 'injected invalid predecessor',
				path: '$injected'
			}
		],
		state
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

function withProgramOverrides(
	session: CompilerProjectProgramSession,
	overrides: Partial<
		Pick<ts.Program, 'getCompilerOptions' | 'getSourceFiles' | 'getSyntacticDiagnostics'>
	>
): CompilerProjectProgramSession {
	const program = new Proxy(session.program, {
		get(target, key) {
			const override = Reflect.get(overrides, key);
			if (override !== undefined) return override;
			const value = Reflect.get(target, key, target) as unknown;
			return typeof value === 'function' ? value.bind(target) : value;
		}
	});
	return { ...session, program };
}

describe('declaration-context analysis producer coverage', () => {
	let fixture: DeclarationContextAnalysisFixture;
	let inputs: DeclarationContextAnalysisBuildInputs;
	let baseline: DeclarationContextAnalysisSnapshot;
	let descriptorRecords = 0;
	let descriptorStringCharacters = 0;
	let successfulEvents: DeclarationContextAnalysisProgressEvent[] = [];

	beforeAll(async () => {
		fixture = createDeclarationContextAnalysisFixture({ declarationState: 'MERGED' });
		inputs = declarationContextAnalysisInputs(fixture);
		const events: DeclarationContextAnalysisProgressEvent[] = [];
		const outcome = buildDeclarationContextAnalysis(inputs, {
			onProgress(event) {
				events.push(event);
			}
		});
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		baseline = outcome.analysis;
		await Promise.resolve();
		successfulEvents = events;
		const requestBind = events.find(
			(event) => event.phase === 'REQUEST_BIND' && event.state === 'COMPLETED'
		);
		descriptorRecords = requestBind?.counts.inputRecords ?? 0;
		descriptorStringCharacters = requestBind?.counts.inputStringCharacters ?? 0;
		expect(descriptorRecords).toBeGreaterThan(baseline.coverage.inputRecords);
		expect(descriptorStringCharacters).toBeGreaterThan(0);
	}, 120_000);

	afterEach(() => {
		vi.restoreAllMocks();
	});

	afterAll(() => {
		fixture.cleanup();
	});

	it('accepts every exact measured operational boundary and rejects each one-below boundary', () => {
		const exact = withBudgets(inputs, {
			maxAliasHops: baseline.coverage.aliasHops,
			maxArtifacts: baseline.coverage.artifacts,
			maxCompilerInputAttempts: baseline.programWitness.attributedCompilerInputAttempts,
			maxDeclarations: baseline.coverage.declarations,
			maxExportSymbols: baseline.coverage.exportSymbolsExamined,
			maxInputRecords: descriptorRecords,
			maxInputStringCharacters: descriptorStringCharacters,
			maxOutputRecords: baseline.coverage.outputRecords,
			maxParsedArtifactAstNodes: baseline.coverage.selectedAstNodes,
			maxProgramAstNodes: baseline.coverage.programParsedAstNodes,
			maxProgramReadBytes: baseline.programWitness.attributedProgramReadBytes,
			maxProgramSourceFiles: baseline.coverage.programSourceFiles,
			maxReadBytes: Math.max(
				baseline.coverage.readBytes,
				baseline.programWitness.attributedProgramReadBytes
			),
			maxRelations: baseline.coverage.relationRecords,
			maxTraversalSteps: baseline.coverage.chargedTraversalSteps
		});
		const exactOutcome = buildDeclarationContextAnalysis(exact);
		if (exactOutcome.outcome !== 'partial') throw new Error(JSON.stringify(exactOutcome));

		const boundaries: Array<
			readonly [keyof DeclarationContextAnalysisBuildInputs['request']['budgets'], number]
		> = [
			['maxCompilerInputAttempts', baseline.programWitness.attributedCompilerInputAttempts - 1],
			['maxInputRecords', descriptorRecords - 1],
			['maxInputStringCharacters', descriptorStringCharacters - 1],
			['maxProgramReadBytes', baseline.programWitness.attributedProgramReadBytes - 1],
			['maxProgramSourceFiles', baseline.coverage.programSourceFiles - 1],
			['maxProgramAstNodes', baseline.coverage.programParsedAstNodes - 1],
			['maxParsedArtifactAstNodes', baseline.coverage.selectedAstNodes - 1],
			['maxDeclarations', baseline.coverage.declarations - 1],
			['maxRelations', baseline.coverage.relationRecords - 1],
			['maxTraversalSteps', baseline.coverage.chargedTraversalSteps - 1],
			['maxOutputRecords', baseline.coverage.outputRecords - 1]
		];
		for (const [key, value] of boundaries)
			expectUnavailable(
				buildDeclarationContextAnalysis(withBudgets(exact, { [key]: value })),
				'BUDGET_EXCEEDED'
			);

		if (baseline.coverage.readBytes > baseline.programWitness.attributedProgramReadBytes) {
			expectUnavailable(
				buildDeclarationContextAnalysis(
					withBudgets(exact, { maxReadBytes: baseline.coverage.readBytes - 1 })
				),
				'BUDGET_EXCEEDED'
			);
		} else {
			// This fixture's captured Program-read upper bound dominates its actual total reads,
			// so a one-below total-read cap would violate the request coherence invariant first.
			expectUnavailable(
				buildDeclarationContextAnalysis(
					withBudgets(exact, {
						maxReadBytes: baseline.programWitness.attributedProgramReadBytes - 1
					})
				),
				'REQUEST_INVALID'
			);
		}
		expectUnavailable(
			buildDeclarationContextAnalysis(withBudgets(inputs, { maxTraversalSteps: 1 })),
			'BUDGET_EXCEEDED'
		);
	}, 180_000);

	it('emits the exact successful phase sequence and terminates failures on the active phase', async () => {
		const phases = [
			'REQUEST_BIND',
			'INPUT_BUDGET',
			'SEMANTIC_SNAPSHOT_VALIDATE',
			'PROJECT_CONTEXT_GRAPH_VALIDATE',
			'CONDITIONAL_EXPORT_RESOLUTION_VALIDATE',
			'MODULE_RESOLUTION_TRACE_VALIDATE',
			'PROGRAM_CONSTRUCT',
			'PROGRAM_SOURCE_ACCOUNT',
			'ROOT_EXPORT_ENUMERATE',
			'ALIAS_RESOLVE',
			'TERMINAL_DECLARATION_BIND',
			'ARTIFACT_BIND',
			'ARTIFACT_PARSE_ACCOUNT',
			'MATERIALIZE',
			'SERIALIZE',
			'ANALYSIS_VALIDATE'
		] as const;
		expect(successfulEvents).toHaveLength(phases.length * 2);
		expect(successfulEvents.map((event) => event.sequence)).toEqual(
			Array.from({ length: phases.length * 2 }, (_, index) => index)
		);
		for (const [index, phase] of phases.entries()) {
			const started = successfulEvents[index * 2];
			const completed = successfulEvents[index * 2 + 1];
			expect([started?.phase, started?.state, started?.detailCode]).toEqual([
				phase,
				'STARTED',
				null
			]);
			expect([completed?.phase, completed?.state, completed?.detailCode]).toEqual([
				phase,
				'COMPLETED',
				null
			]);
		}
		for (const event of successfulEvents) {
			expect(Object.keys(event).sort()).toEqual([
				'counts',
				'detailCode',
				'phase',
				'schemaVersion',
				'sequence',
				'state'
			]);
			expect(event.schemaVersion).toBe(DECLARATION_CONTEXT_ANALYSIS_PROGRESS_SCHEMA_VERSION);
			expect(Object.isFrozen(event)).toBe(true);
			expect(Object.isFrozen(event.counts)).toBe(true);
			expect(Object.keys(event.counts)).toEqual(Object.keys(event.counts).sort());
			for (const count of Object.values(event.counts)) {
				expect(Number.isSafeInteger(count)).toBe(true);
				expect(count).toBeGreaterThanOrEqual(0);
			}
		}

		const failureEvents: DeclarationContextAnalysisProgressEvent[] = [];
		const failed = buildDeclarationContextAnalysis(withBudgets(inputs, { maxOutputRecords: 0 }), {
			onProgress(event) {
				failureEvents.push(event);
			}
		});
		expectUnavailable(failed, 'REQUEST_INVALID');
		await Promise.resolve();
		expect(failureEvents).toHaveLength(2);
		expect(
			failureEvents.map(({ detailCode, phase, sequence, state }) => ({
				detailCode,
				phase,
				sequence,
				state
			}))
		).toEqual([
			{ detailCode: null, phase: 'REQUEST_BIND', sequence: 0, state: 'STARTED' },
			{ detailCode: 'REQUEST_INVALID', phase: 'REQUEST_BIND', sequence: 1, state: 'FAILED' }
		]);
	});

	it('permits zero alias hops for a direct export and budgets an aliased export before its first hop', () => {
		const directFixture = createDeclarationContextAnalysisFixture({
			declarationState: 'SINGLE',
			targetDeclarationText: 'export interface SelectedContract { readonly direct: true; }\n'
		});
		try {
			const direct = requirePartial(
				withBudgets(declarationContextAnalysisInputs(directFixture), { maxAliasHops: 0 })
			);
			expect(direct.exportBinding.resolutionKind).toBe('DIRECT_TERMINAL_SYMBOL');
			expect(direct.exportBinding.aliasHops).toEqual([]);
		} finally {
			directFixture.cleanup();
		}
		expectUnavailable(
			buildDeclarationContextAnalysis(withBudgets(inputs, { maxAliasHops: 0 })),
			'BUDGET_EXCEEDED'
		);
	}, 120_000);

	it('rejects hostile ingress descriptor-first without invoking getters or proxy traps', () => {
		let getterCalls = 0;
		const accessor = { ...inputs } as Record<string, unknown>;
		Object.defineProperty(accessor, 'request', {
			enumerable: true,
			get() {
				getterCalls += 1;
				throw new Error('must not run');
			}
		});
		expectUnavailable(buildDeclarationContextAnalysis(accessor), 'REQUEST_INVALID');
		expect(getterCalls).toBe(0);

		const revoked = Proxy.revocable({}, {});
		revoked.revoke();
		expectUnavailable(buildDeclarationContextAnalysis(revoked.proxy), 'REQUEST_INVALID');

		let elementGetterCalls = 0;
		const checkerApis: unknown[] = [];
		Object.defineProperty(checkerApis, '0', {
			enumerable: true,
			get() {
				elementGetterCalls += 1;
				throw new Error('must not run');
			}
		});
		checkerApis.length = 1;
		const accessorSelection = {
			...DECLARATION_CONTEXT_ANALYSIS_SELECTION,
			checkerApis
		};
		expectUnavailable(
			buildDeclarationContextAnalysis(
				withRequest(inputs, { selection: accessorSelection as never })
			),
			'REQUEST_INVALID'
		);
		expect(elementGetterCalls).toBe(0);
	});

	it('rejects cycles, sparse/expando arrays, exotic prototypes, symbols, and non-scalar keys', () => {
		const cyclicSelection = {
			...DECLARATION_CONTEXT_ANALYSIS_SELECTION,
			checkerApis: [] as unknown[]
		};
		cyclicSelection.checkerApis.push(cyclicSelection);
		expectUnavailable(
			buildDeclarationContextAnalysis(withRequest(inputs, { selection: cyclicSelection as never })),
			'REQUEST_INVALID'
		);

		const sparse = new Array(2);
		sparse[1] = 'GET_DECLARATIONS';
		expectUnavailable(
			buildDeclarationContextAnalysis(
				withRequest(inputs, {
					selection: { ...DECLARATION_CONTEXT_ANALYSIS_SELECTION, checkerApis: sparse } as never
				})
			),
			'REQUEST_INVALID'
		);
		const expando = [...DECLARATION_CONTEXT_ANALYSIS_SELECTION.checkerApis] as unknown[] & {
			extra?: boolean;
		};
		expando.extra = true;
		expectUnavailable(
			buildDeclarationContextAnalysis(
				withRequest(inputs, {
					selection: { ...DECLARATION_CONTEXT_ANALYSIS_SELECTION, checkerApis: expando } as never
				})
			),
			'REQUEST_INVALID'
		);

		const exotic = Object.create(Date.prototype) as unknown;
		expectUnavailable(
			buildDeclarationContextAnalysis(
				withRequest(inputs, {
					selection: { ...DECLARATION_CONTEXT_ANALYSIS_SELECTION, checkerApis: exotic } as never
				})
			),
			'REQUEST_INVALID'
		);
		const symbolSelection = { ...DECLARATION_CONTEXT_ANALYSIS_SELECTION } as Record<
			PropertyKey,
			unknown
		>;
		symbolSelection[Symbol('hostile')] = true;
		expectUnavailable(
			buildDeclarationContextAnalysis(withRequest(inputs, { selection: symbolSelection as never })),
			'REQUEST_INVALID'
		);
		const scalarSelection = { ...DECLARATION_CONTEXT_ANALYSIS_SELECTION } as Record<
			string,
			unknown
		>;
		scalarSelection['\ud800'] = true;
		expectUnavailable(
			buildDeclarationContextAnalysis(withRequest(inputs, { selection: scalarSelection as never })),
			'REQUEST_INVALID'
		);
	});

	it('covers exact-record and plain-tree descriptor, prototype, and population refusals', () => {
		for (const candidate of [
			null,
			[],
			new Date(),
			{ ...inputs, extra: true },
			withBudgets(inputs, { maxInputRecords: 0 })
		])
			expectUnavailable(buildDeclarationContextAnalysis(candidate), 'REQUEST_INVALID');

		const selectionFirstInputs = (
			selection: unknown,
			maxInputRecords = inputs.request.budgets.maxInputRecords
		): DeclarationContextAnalysisBuildInputs => {
			const { request: _request, ...inputRest } = inputs;
			const { selection: _selection, ...requestRest } = inputs.request;
			return {
				request: {
					selection: selection as never,
					...requestRest,
					budgets: { ...inputs.request.budgets, maxInputRecords }
				},
				...inputRest
			};
		};
		const { checkerApis: _checkerApis, ...selectionRest } = DECLARATION_CONTEXT_ANALYSIS_SELECTION;

		const prototypeArray = [...DECLARATION_CONTEXT_ANALYSIS_SELECTION.checkerApis];
		Object.setPrototypeOf(prototypeArray, null);
		expectUnavailable(
			buildDeclarationContextAnalysis(
				selectionFirstInputs({ checkerApis: prototypeArray, ...selectionRest })
			),
			'REQUEST_INVALID'
		);

		const oversizedArray = new Array(100).fill('GET_DECLARATIONS');
		expectUnavailable(
			buildDeclarationContextAnalysis(
				selectionFirstInputs({ checkerApis: oversizedArray, ...selectionRest }, 50)
			),
			'BUDGET_EXCEEDED'
		);

		const oversizedRecord = Object.fromEntries(
			Array.from({ length: 100 }, (_, index) => [`extra${index}`, index])
		);
		expectUnavailable(
			buildDeclarationContextAnalysis(selectionFirstInputs(oversizedRecord, 50)),
			'BUDGET_EXCEEDED'
		);

		let getterCalls = 0;
		const accessorSelection = { ...DECLARATION_CONTEXT_ANALYSIS_SELECTION } as Record<
			string,
			unknown
		>;
		Object.defineProperty(accessorSelection, 'checkerApis', {
			enumerable: true,
			get() {
				getterCalls += 1;
				throw new Error('must not run');
			}
		});
		expectUnavailable(
			buildDeclarationContextAnalysis(selectionFirstInputs(accessorSelection)),
			'REQUEST_INVALID'
		);
		expect(getterCalls).toBe(0);
	});

	it('rejects invalid request constants, budgets, strings, identities, and total/program incoherence', () => {
		for (const candidate of [
			withBudgets(inputs, { maxDiagnostics: 100_001 }),
			withBudgets(inputs, { maxOutputRecords: 0 }),
			withBudgets(inputs, { maxOutputRecords: Number.MAX_SAFE_INTEGER + 1 }),
			withBudgets(inputs, { maxOutputRecords: -1 }),
			withBudgets(inputs, { maxReadBytes: inputs.request.budgets.maxProgramReadBytes - 1 }),
			withRequest(inputs, { operationVersion: 'unsupported' as never }),
			withRequest(inputs, { exportName: '' }),
			withRequest(inputs, { exportName: '\ud800' }),
			withRequest(inputs, { subjectId: 'not-a-digest' }),
			withRequest(inputs, { semanticSnapshotId: '' as never })
		])
			expectUnavailable(buildDeclarationContextAnalysis(candidate));
	});

	it('defensively rejects exact-shape selection and provider population disagreements', () => {
		const checkerApis = [...DECLARATION_CONTEXT_ANALYSIS_SELECTION.checkerApis];
		checkerApis[0] = 'UNSUPPORTED_CHECKER_API' as (typeof checkerApis)[number];
		expectUnavailable(
			buildDeclarationContextAnalysis(
				withRequest(inputs, {
					selection: { ...DECLARATION_CONTEXT_ANALYSIS_SELECTION, checkerApis } as never
				})
			),
			'UNSUPPORTED_REQUEST'
		);

		mockCompilerSession((session) => ({
			...session,
			finalize() {
				const evidence = session.finalize();
				return {
					...evidence,
					contextInputIds: evidence.contextInputIds.map((id, index) =>
						index === 0 ? ('0'.repeat(64) as typeof id) : id
					)
				};
			}
		}));
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'CAPTURE_INVALID');
	}, 180_000);

	it('rejects lost capability, direct identity mismatch, predecessor-chain mismatch, and unsupported target', () => {
		expectUnavailable(
			buildDeclarationContextAnalysis({ ...inputs, frozenSubject: { ...inputs.frozenSubject } }),
			'REQUEST_INVALID'
		);
		expectUnavailable(
			buildDeclarationContextAnalysis(withRequest(inputs, { subjectId: '0'.repeat(64) })),
			'INPUT_IDENTITY_MISMATCH'
		);
		expectUnavailable(
			buildDeclarationContextAnalysis({
				...inputs,
				conditionalExportRequest: {
					...inputs.conditionalExportRequest,
					projectContextGraph: {
						...inputs.conditionalExportRequest.projectContextGraph,
						graphId: 'wrong' as never
					}
				}
			}),
			'INPUT_IDENTITY_MISMATCH'
		);
		expectUnavailable(
			buildDeclarationContextAnalysis({
				...inputs,
				moduleResolutionTrace: {
					...inputs.moduleResolutionTrace,
					targetWitness: {
						...inputs.moduleResolutionTrace.targetWitness,
						declarationFile: false as true
					}
				}
			}),
			'UNSUPPORTED_REQUEST'
		);
	});

	it('uses one semantic pass followed by constructed CAP-010, CAP-012, CAP-011, and CAP-013', () => {
		vi.spyOn(operationClock, 'createMonotonicOperationClock').mockReturnValueOnce({
			now: () => 101,
			startedAtMs: 100
		});
		const semantic = vi.spyOn(semanticValidator, 'validateStaticSemanticSnapshot');
		const graph = vi.spyOn(graphValidator, 'validateConstructedProjectContextGraph');
		const conditional = vi.spyOn(
			conditionalValidator,
			'validateConstructedConditionalExportResolution'
		);
		const trace = vi.spyOn(traceValidator, 'validateConstructedModuleResolutionTrace');
		const final = vi.spyOn(analysisValidator, 'validateConstructedDeclarationContextAnalysis');
		const publicGraph = vi.spyOn(graphValidator, 'validateProjectContextGraph');
		const publicConditional = vi.spyOn(conditionalValidator, 'validateConditionalExportResolution');
		const publicTrace = vi.spyOn(traceValidator, 'validateModuleResolutionTrace');
		expect(buildDeclarationContextAnalysis(inputs).outcome).toBe('partial');
		expect(semantic).toHaveBeenCalledOnce();
		expect(graph).toHaveBeenCalledOnce();
		expect(conditional).toHaveBeenCalledOnce();
		expect(trace).toHaveBeenCalledOnce();
		expect(final).toHaveBeenCalledOnce();
		expect(publicGraph).not.toHaveBeenCalled();
		expect(publicConditional).not.toHaveBeenCalled();
		expect(publicTrace).not.toHaveBeenCalled();
		expect(semantic.mock.invocationCallOrder[0]).toBeLessThan(graph.mock.invocationCallOrder[0]!);
		expect(graph.mock.invocationCallOrder[0]).toBeLessThan(
			conditional.mock.invocationCallOrder[0]!
		);
		expect(conditional.mock.invocationCallOrder[0]).toBeLessThan(
			trace.mock.invocationCallOrder[0]!
		);
		expect(trace.mock.invocationCallOrder[0]).toBeLessThan(final.mock.invocationCallOrder[0]!);
		expect(final.mock.calls[0]?.[3]?.maxDurationMs).toBe(inputs.request.budgets.maxDurationMs - 1);
		const semanticLimits = semantic.mock.calls[0]?.[1];
		expect(semanticLimits?.maxRecords).toBe(
			Math.min(
				inputs.request.budgets.maxInputRecords,
				inputs.moduleResolutionRequest.budgets.maxInputRecords,
				inputs.projectContextGraph.budgets.maxInputRecords
			)
		);
		expect(semanticLimits?.maxStringCharacters).toBe(
			Math.min(
				inputs.request.budgets.maxInputStringCharacters,
				inputs.moduleResolutionRequest.budgets.maxInputStringCharacters,
				inputs.projectContextGraph.budgets.maxInputStringCharacters
			)
		);
	});

	it('maps every predecessor validation failure and budget state without continuing', () => {
		for (const state of ['INVALID', 'BUDGET_EXHAUSTED'] as const) {
			vi.spyOn(semanticValidator, 'validateStaticSemanticSnapshot').mockReturnValueOnce(
				invalidValidation(state) as never
			);
			expectUnavailable(
				buildDeclarationContextAnalysis(inputs),
				state === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXCEEDED' : 'SEMANTIC_SNAPSHOT_INVALID'
			);
			vi.restoreAllMocks();

			vi.spyOn(graphValidator, 'validateConstructedProjectContextGraph').mockReturnValueOnce(
				invalidValidation(state) as never
			);
			expectUnavailable(
				buildDeclarationContextAnalysis(inputs),
				state === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXCEEDED' : 'PROJECT_CONTEXT_GRAPH_INVALID'
			);
			vi.restoreAllMocks();

			vi.spyOn(
				conditionalValidator,
				'validateConstructedConditionalExportResolution'
			).mockReturnValueOnce(invalidValidation(state) as never);
			expectUnavailable(
				buildDeclarationContextAnalysis(inputs),
				state === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXCEEDED' : 'CONDITIONAL_EXPORT_RESOLUTION_INVALID'
			);
			vi.restoreAllMocks();

			vi.spyOn(traceValidator, 'validateConstructedModuleResolutionTrace').mockReturnValueOnce(
				invalidValidation(state) as never
			);
			expectUnavailable(
				buildDeclarationContextAnalysis(inputs),
				state === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXCEEDED' : 'MODULE_RESOLUTION_TRACE_INVALID'
			);
			vi.restoreAllMocks();
		}
	});

	it('gives outer duration exhaustion precedence over invalid validator returns', () => {
		const expectDeadlinePrecedence = (
			phase: DeclarationContextAnalysisProgressEvent['phase'],
			installInvalidReturn: (expire: () => void) => void
		): void => {
			let expired = false;
			vi.spyOn(operationClock, 'createMonotonicOperationClock').mockReturnValueOnce({
				now: () => (expired ? inputs.request.budgets.maxDurationMs + 1 : 0),
				startedAtMs: 0
			});
			try {
				installInvalidReturn(() => {
					expired = true;
				});
				const outcome = buildDeclarationContextAnalysis(inputs);
				expectUnavailable(outcome, 'BUDGET_EXCEEDED');
				if (outcome.outcome === 'unavailable') expect(outcome.diagnostics[0]?.phase).toBe(phase);
			} finally {
				vi.restoreAllMocks();
			}
		};

		expectDeadlinePrecedence('SEMANTIC_SNAPSHOT_VALIDATE', (expire) => {
			vi.spyOn(semanticValidator, 'validateStaticSemanticSnapshot').mockImplementationOnce(() => {
				expire();
				return invalidValidation() as never;
			});
		});
		expectDeadlinePrecedence('PROJECT_CONTEXT_GRAPH_VALIDATE', (expire) => {
			vi.spyOn(graphValidator, 'validateConstructedProjectContextGraph').mockImplementationOnce(
				() => {
					expire();
					return invalidValidation() as never;
				}
			);
		});
		expectDeadlinePrecedence('CONDITIONAL_EXPORT_RESOLUTION_VALIDATE', (expire) => {
			vi.spyOn(
				conditionalValidator,
				'validateConstructedConditionalExportResolution'
			).mockImplementationOnce(() => {
				expire();
				return invalidValidation() as never;
			});
		});
		expectDeadlinePrecedence('MODULE_RESOLUTION_TRACE_VALIDATE', (expire) => {
			vi.spyOn(traceValidator, 'validateConstructedModuleResolutionTrace').mockImplementationOnce(
				() => {
					expire();
					return invalidValidation() as never;
				}
			);
		});
		expectDeadlinePrecedence('ANALYSIS_VALIDATE', (expire) => {
			vi.spyOn(
				analysisValidator,
				'validateConstructedDeclarationContextAnalysis'
			).mockImplementationOnce(() => {
				expire();
				return invalidValidation();
			});
		});
	}, 180_000);

	it('gives outer duration exhaustion precedence over a mutable public compiler return', () => {
		let expired = false;
		vi.spyOn(operationClock, 'createMonotonicOperationClock').mockReturnValueOnce({
			now: () => (expired ? inputs.request.budgets.maxDurationMs + 1 : 0),
			startedAtMs: 0
		});
		vi.spyOn(
			declarationContextAnalysisTypeScriptPublicApi,
			'isExternalModule'
		).mockImplementationOnce(() => {
			expired = true;
			return false;
		});
		const outcome = buildDeclarationContextAnalysis(inputs);
		expectUnavailable(outcome, 'BUDGET_EXCEEDED');
		if (outcome.outcome === 'unavailable')
			expect(outcome.diagnostics[0]?.phase).toBe('ROOT_EXPORT_ENUMERATE');
	}, 180_000);

	it('maps constructed CAP-013 validation failure and exhaustion after truthful predecessors', () => {
		for (const state of ['INVALID', 'BUDGET_EXHAUSTED'] as const) {
			vi.spyOn(
				analysisValidator,
				'validateConstructedDeclarationContextAnalysis'
			).mockReturnValueOnce(invalidValidation(state));
			expectUnavailable(
				buildDeclarationContextAnalysis(inputs),
				state === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXCEEDED' : 'VALIDATION_FAILED'
			);
			vi.restoreAllMocks();
		}
	});

	it('rejects missing, duplicate, over-budget, and non-scalar package-root exports', () => {
		vi.spyOn(
			declarationContextAnalysisTypeScriptPublicApi,
			'getSymbolAtLocation'
		).mockReturnValueOnce(undefined);
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'TARGET_UNAVAILABLE');
		vi.restoreAllMocks();

		const original = declarationContextAnalysisTypeScriptPublicApi.getExportsOfModule;
		vi.spyOn(
			declarationContextAnalysisTypeScriptPublicApi,
			'getExportsOfModule'
		).mockImplementation((checker, symbol) => {
			original(checker, symbol);
			return [];
		});
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'TARGET_UNAVAILABLE');
		vi.restoreAllMocks();

		vi.spyOn(
			declarationContextAnalysisTypeScriptPublicApi,
			'getExportsOfModule'
		).mockImplementation((checker, symbol) => {
			const values = original(checker, symbol);
			return [...values, values[0]!];
		});
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'TARGET_UNAVAILABLE');
		vi.restoreAllMocks();

		vi.spyOn(
			declarationContextAnalysisTypeScriptPublicApi,
			'getExportsOfModule'
		).mockImplementation((checker, symbol) => [
			...original(checker, symbol),
			{ getName: () => 'other' } as never
		]);
		expectUnavailable(
			buildDeclarationContextAnalysis(withBudgets(inputs, { maxExportSymbols: 1 })),
			'BUDGET_EXCEEDED'
		);
		vi.restoreAllMocks();

		vi.spyOn(
			declarationContextAnalysisTypeScriptPublicApi,
			'getExportsOfModule'
		).mockReturnValueOnce([{ getName: () => '\ud800' } as never]);
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'TARGET_UNAVAILABLE');
	});

	it('rejects alias declaration loss, alias identity cycles, and unsupported terminal declarations', () => {
		vi.spyOn(declarationContextAnalysisTypeScriptPublicApi, 'getDeclarations').mockReturnValueOnce(
			undefined
		);
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'TARGET_UNAVAILABLE');
		vi.restoreAllMocks();

		vi.spyOn(
			declarationContextAnalysisTypeScriptPublicApi,
			'getAliasedSymbol'
		).mockImplementationOnce((_checker, symbol) => symbol);
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'TARGET_UNAVAILABLE');
		vi.restoreAllMocks();

		vi.spyOn(declarationContextAnalysisTypeScriptPublicApi, 'getAliasedSymbol').mockReturnValueOnce(
			{
				flags: ts.SymbolFlags.Alias,
				getName: () => 'IntermediateAlias'
			} as ts.Symbol
		);
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'UNSUPPORTED_REQUEST');
		vi.restoreAllMocks();

		const original = declarationContextAnalysisTypeScriptPublicApi.getDeclarations;
		let aliasDeclarations: readonly import('typescript').Declaration[] | undefined;
		vi.spyOn(declarationContextAnalysisTypeScriptPublicApi, 'getDeclarations').mockImplementation(
			(symbol) => {
				const declarations = original(symbol);
				if (aliasDeclarations === undefined) {
					aliasDeclarations = declarations;
					return declarations;
				}
				return aliasDeclarations;
			}
		);
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'UNSUPPORTED_REQUEST');
	}, 180_000);

	it('refuses unrepresentable symbol flags and hostile public symbol names/populations', () => {
		const originalExports = declarationContextAnalysisTypeScriptPublicApi.getExportsOfModule;
		vi.spyOn(
			declarationContextAnalysisTypeScriptPublicApi,
			'getExportsOfModule'
		).mockImplementation(() => [
			{ flags: -1, getName: () => inputs.request.exportName } as ts.Symbol
		]);
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'TARGET_UNAVAILABLE');
		vi.restoreAllMocks();

		vi.spyOn(
			declarationContextAnalysisTypeScriptPublicApi,
			'getExportsOfModule'
		).mockImplementation(() => [
			{ flags: 268_435_456, getName: () => inputs.request.exportName } as unknown as ts.Symbol
		]);
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'TARGET_UNAVAILABLE');
		vi.restoreAllMocks();

		const originalAlias = declarationContextAnalysisTypeScriptPublicApi.getAliasedSymbol;
		vi.spyOn(
			declarationContextAnalysisTypeScriptPublicApi,
			'getExportsOfModule'
		).mockImplementation((checker, moduleSymbol) => {
			const selected = originalExports(checker, moduleSymbol)[0]!;
			const terminal = originalAlias(checker, selected);
			return [
				{
					flags: 0,
					getDeclarations: () => terminal.getDeclarations(),
					getName: () => inputs.request.exportName
				} as ts.Symbol
			];
		});
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'TARGET_UNAVAILABLE');
		vi.restoreAllMocks();

		vi.spyOn(declarationContextAnalysisTypeScriptPublicApi, 'getAliasedSymbol').mockReturnValueOnce(
			{ flags: 0, getName: () => '\ud800' } as ts.Symbol
		);
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'TARGET_UNAVAILABLE');
		vi.restoreAllMocks();

		vi.spyOn(declarationContextAnalysisTypeScriptPublicApi, 'getAliasedSymbol').mockReturnValueOnce(
			{ flags: 0, getName: () => '' } as ts.Symbol
		);
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'TARGET_UNAVAILABLE');
		vi.restoreAllMocks();

		const originalDeclarations = declarationContextAnalysisTypeScriptPublicApi.getDeclarations;
		let declarationCalls = 0;
		vi.spyOn(declarationContextAnalysisTypeScriptPublicApi, 'getDeclarations').mockImplementation(
			(symbol) => {
				declarationCalls += 1;
				return declarationCalls === 2 ? undefined : originalDeclarations(symbol);
			}
		);
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'TARGET_UNAVAILABLE');
		vi.restoreAllMocks();

		declarationCalls = 0;
		vi.spyOn(declarationContextAnalysisTypeScriptPublicApi, 'getDeclarations').mockImplementation(
			(symbol) => {
				const declarations = originalDeclarations(symbol);
				declarationCalls += 1;
				return declarationCalls === 2 && declarations?.[0] !== undefined
					? [declarations[0], declarations[0]]
					: declarations;
			}
		);
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'TARGET_UNAVAILABLE');
	});

	it('fails closed on unrepresentable compiler enums and a non-context terminal carrier', () => {
		const syntaxKindTable = ts.SyntaxKind as unknown as Record<number, string | number | undefined>;
		const interfaceKind = ts.SyntaxKind.InterfaceDeclaration;
		const interfaceKindName = syntaxKindTable[interfaceKind];
		try {
			syntaxKindTable[interfaceKind] = undefined;
			expectUnavailable(buildDeclarationContextAnalysis(inputs), 'TARGET_UNAVAILABLE');
		} finally {
			syntaxKindTable[interfaceKind] = interfaceKindName;
		}

		const languageVersionCode = baseline.parseWitnesses[0]!.languageVersion.nativeCode;
		const scriptTargetTable = ts.ScriptTarget as unknown as Record<
			number,
			string | number | undefined
		>;
		const languageVersionName = scriptTargetTable[languageVersionCode];
		try {
			scriptTargetTable[languageVersionCode] = undefined;
			expectUnavailable(
				buildDeclarationContextAnalysis(inputs),
				'PROGRAM_CONSTRUCTION_UNAVAILABLE'
			);
		} finally {
			scriptTargetTable[languageVersionCode] = languageVersionName;
		}

		const originalDeclarations = declarationContextAnalysisTypeScriptPublicApi.getDeclarations;
		let declarationCalls = 0;
		vi.spyOn(declarationContextAnalysisTypeScriptPublicApi, 'getDeclarations').mockImplementation(
			(symbol) => {
				declarationCalls += 1;
				if (declarationCalls !== 2) return originalDeclarations(symbol);
				return [
					{
						getSourceFile: () => ({
							fileName: inputs.moduleResolutionTrace.importerWitness.logicalPath
						})
					} as unknown as ts.Declaration
				];
			}
		);
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'UNSUPPORTED_REQUEST');
	}, 180_000);

	it('refuses global, unsupported, and unnamed top-level terminal declarations', () => {
		const globalFixture = createDeclarationContextAnalysisFixture({
			declarationState: 'SINGLE',
			targetDeclarationText:
				'declare global { interface GlobalX {} }\ninterface FixtureContract {}\nexport { FixtureContract as SelectedContract };\n'
		});
		try {
			const originalDeclarations = declarationContextAnalysisTypeScriptPublicApi.getDeclarations;
			let declarationCalls = 0;
			vi.spyOn(declarationContextAnalysisTypeScriptPublicApi, 'getDeclarations').mockImplementation(
				(symbol) => {
					const declarations = originalDeclarations(symbol);
					declarationCalls += 1;
					if (declarationCalls !== 2) return declarations;
					const sourceFile = declarations![0]!.getSourceFile();
					const globalDeclaration = sourceFile.statements.find(
						(node): node is ts.ModuleDeclaration =>
							ts.isModuleDeclaration(node) && (node.flags & ts.NodeFlags.GlobalAugmentation) !== 0
					);
					return [globalDeclaration!];
				}
			);
			expectUnavailable(
				buildDeclarationContextAnalysis(declarationContextAnalysisInputs(globalFixture)),
				'UNSUPPORTED_REQUEST'
			);
		} finally {
			globalFixture.cleanup();
			vi.restoreAllMocks();
		}

		const mockTerminalDeclaration = (
			create: (sourceFile: ts.SourceFile) => ts.Declaration
		): void => {
			const originalDeclarations = declarationContextAnalysisTypeScriptPublicApi.getDeclarations;
			let declarationCalls = 0;
			vi.spyOn(declarationContextAnalysisTypeScriptPublicApi, 'getDeclarations').mockImplementation(
				(symbol) => {
					const declarations = originalDeclarations(symbol);
					declarationCalls += 1;
					return declarationCalls === 2
						? [create(declarations![0]!.getSourceFile())]
						: declarations;
				}
			);
		};
		mockTerminalDeclaration(
			(sourceFile) =>
				({
					getSourceFile: () => sourceFile,
					kind: ts.SyntaxKind.ExportDeclaration,
					parent: sourceFile
				}) as unknown as ts.Declaration
		);
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'UNSUPPORTED_REQUEST');
		vi.restoreAllMocks();

		mockTerminalDeclaration(
			(sourceFile) =>
				({
					getSourceFile: () => sourceFile,
					kind: ts.SyntaxKind.ClassDeclaration,
					name: undefined,
					parent: sourceFile
				}) as unknown as ts.Declaration
		);
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'UNSUPPORTED_REQUEST');
	}, 180_000);

	it('covers every supported public declaration kind with compiler-backed targets', () => {
		const cases = [
			[
				'CLASS',
				'declare class FixtureContract {}\nexport { FixtureContract as SelectedContract };\n'
			],
			[
				'ENUM',
				'declare enum FixtureContract { Value }\nexport { FixtureContract as SelectedContract };\n'
			],
			[
				'FUNCTION',
				'declare function FixtureContract(): void;\nexport { FixtureContract as SelectedContract };\n'
			],
			[
				'TYPE_ALIAS',
				'type FixtureContract = string;\nexport { FixtureContract as SelectedContract };\n'
			],
			[
				'VARIABLE',
				"declare const FixtureContract: 'value';\nexport { FixtureContract as SelectedContract };\n"
			]
		] as const;
		for (const [kind, targetDeclarationText] of cases) {
			const kindFixture = createDeclarationContextAnalysisFixture({
				declarationState: 'SINGLE',
				targetDeclarationText
			});
			try {
				const analysis = requirePartial(declarationContextAnalysisInputs(kindFixture));
				expect(analysis.declarations.map((declaration) => declaration.kind)).toContain(kind);
			} finally {
				kindFixture.cleanup();
			}
		}
	}, 180_000);

	it('refuses checker-collapsed duplicate terminal and selected export declarations', () => {
		const duplicateTargets = [
			'type FixtureContract = string;\ntype FixtureContract = number;\nexport { FixtureContract as SelectedContract };\n',
			'interface First {}\ninterface Second {}\nexport { First as SelectedContract };\nexport { Second as SelectedContract };\n',
			'interface FixtureContract {}\nexport { FixtureContract as SelectedContract };\nexport { FixtureContract as SelectedContract };\n',
			'interface FixtureContract {}\nexport { FixtureContract as SelectedContract, FixtureContract as SelectedContract };\n'
		] as const;
		for (const targetDeclarationText of duplicateTargets) {
			const duplicateFixture = createDeclarationContextAnalysisFixture({
				declarationState: 'SINGLE',
				targetDeclarationText
			});
			try {
				expectUnavailable(
					buildDeclarationContextAnalysis(declarationContextAnalysisInputs(duplicateFixture)),
					'TARGET_UNAVAILABLE'
				);
			} finally {
				duplicateFixture.cleanup();
			}
		}
	}, 180_000);

	it('refuses shorthand and indirect local aliases outside the narrow root ExportSpecifier path', () => {
		const targets = [
			'interface SelectedContract {}\nexport { SelectedContract };\n',
			"export interface A {}\nexport interface B {}\nimport { A as Local } from './index.js';\nimport { B as Local } from './index.js';\nexport { Local as SelectedContract };\n",
			"export interface A {}\nexport { A as SelectedContract } from './index.js';\n"
		] as const;
		for (const targetDeclarationText of targets) {
			const aliasFixture = createDeclarationContextAnalysisFixture({
				declarationState: 'SINGLE',
				targetDeclarationText
			});
			try {
				expectUnavailable(
					buildDeclarationContextAnalysis(declarationContextAnalysisInputs(aliasFixture))
				);
			} finally {
				aliasFixture.cleanup();
			}
		}
	}, 180_000);

	it('refuses unsupported top-level import and binding collisions with the terminal name', () => {
		const targets = [
			"export interface A {}\nexport interface SelectedContract {}\nimport { A as SelectedContract } from './index.js';\n",
			"export default interface DefaultContract {}\nexport interface SelectedContract {}\nimport SelectedContract from './index.js';\n",
			"export interface SelectedContract {}\nimport * as SelectedContract from './index.js';\n",
			"export interface SelectedContract {}\nimport SelectedContract = require('./index.js');\n",
			'export interface SelectedContract {}\ndeclare const { value: SelectedContract }: { value: unknown };\n'
		] as const;
		for (const targetDeclarationText of targets) {
			const collisionFixture = createDeclarationContextAnalysisFixture({
				declarationState: 'SINGLE',
				targetDeclarationText
			});
			try {
				expectUnavailable(
					buildDeclarationContextAnalysis(declarationContextAnalysisInputs(collisionFixture))
				);
			} finally {
				collisionFixture.cleanup();
			}
		}

		const collapsedBindingFixture = createDeclarationContextAnalysisFixture({
			declarationState: 'SINGLE',
			targetDeclarationText:
				'export interface SelectedContract {}\ndeclare const { outer: { SelectedContract } }: { outer: { SelectedContract: unknown } };\n'
		});
		const publicGetDeclarations = declarationContextAnalysisTypeScriptPublicApi.getDeclarations;
		vi.spyOn(declarationContextAnalysisTypeScriptPublicApi, 'getDeclarations').mockImplementation(
			(symbol) => {
				const declarations = publicGetDeclarations(symbol);
				return symbol.getName() === 'SelectedContract'
					? declarations?.filter((declaration) => !ts.isBindingElement(declaration))
					: declarations;
			}
		);
		try {
			expectUnavailable(
				buildDeclarationContextAnalysis(declarationContextAnalysisInputs(collapsedBindingFixture)),
				'TARGET_UNAVAILABLE'
			);
		} finally {
			collapsedBindingFixture.cleanup();
		}
	}, 180_000);

	it('refuses ambient modules, global effects, and triple-slash reference effects', () => {
		for (const ambientPrefix of [
			"declare module 'ambient-x' { interface X {} }\n",
			'declare global { interface GlobalX {} }\n',
			'export as namespace FixtureGlobal;\n',
			'/// <reference path="./other.d.ts" />\n',
			'/// <reference types="missing-fixture-types" />\n',
			'/// <reference lib="es2022" />\n',
			'/// <reference no-default-lib="true" />\n',
			'/// <amd-module name="fixture-amd-module" />\n',
			'/// <amd-dependency path="./fixture-amd-dependency" name="fixtureAmdDependency" />\n'
		]) {
			const ambientFixture = createDeclarationContextAnalysisFixture({
				declarationState: 'SINGLE',
				targetDeclarationText: `${ambientPrefix}interface FixtureContract {}\nexport { FixtureContract as SelectedContract };\n`
			});
			try {
				expectUnavailable(
					buildDeclarationContextAnalysis(declarationContextAnalysisInputs(ambientFixture)),
					'UNSUPPORTED_REQUEST'
				);
			} finally {
				ambientFixture.cleanup();
			}
		}
	}, 120_000);

	it('refuses a nested namespace-member terminal that the wire cannot represent', () => {
		const nestedFixture = createDeclarationContextAnalysisFixture({
			declarationState: 'SINGLE',
			targetDeclarationText:
				'declare namespace Container { interface FixtureContract {} }\nexport import SelectedContract = Container.FixtureContract;\n'
		});
		try {
			expectUnavailable(
				buildDeclarationContextAnalysis(declarationContextAnalysisInputs(nestedFixture)),
				'UNSUPPORTED_REQUEST'
			);
		} finally {
			nestedFixture.cleanup();
		}
	}, 120_000);

	it('refuses a star-reexported off-root terminal before and after the artifact cap', () => {
		const starReexportFixture = createDeclarationContextAnalysisFixture({
			declarationState: 'SINGLE',
			targetDeclarationText: "export * from './terminal.js';\n",
			targetSiblingDeclarationText: 'export interface SelectedContract {}\n'
		});
		try {
			const starReexportInputs = declarationContextAnalysisInputs(starReexportFixture);
			expectUnavailable(
				buildDeclarationContextAnalysis(withBudgets(starReexportInputs, { maxArtifacts: 1 })),
				'BUDGET_EXCEEDED'
			);
			expectUnavailable(buildDeclarationContextAnalysis(starReexportInputs), 'UNSUPPORTED_REQUEST');
		} finally {
			starReexportFixture.cleanup();
		}
	}, 120_000);

	it('rejects non-external root and independently parsed artifacts', () => {
		vi.spyOn(declarationContextAnalysisTypeScriptPublicApi, 'isExternalModule').mockReturnValueOnce(
			false
		);
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'TARGET_UNAVAILABLE');
		vi.restoreAllMocks();
		vi.spyOn(declarationContextAnalysisTypeScriptPublicApi, 'isExternalModule')
			.mockReturnValueOnce(true)
			.mockReturnValueOnce(false);
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'TARGET_UNAVAILABLE');
	});

	it('fails closed on mismatched fresh Program source and artifact populations', () => {
		mockCompilerSession((session) =>
			withProgramOverrides(session, {
				getSourceFiles: () => {
					const sources = session.program.getSourceFiles();
					return [...sources, sources[0]!];
				}
			})
		);
		const sourcePopulationFailure = buildDeclarationContextAnalysis(inputs);
		expectUnavailable(sourcePopulationFailure, 'INPUT_POPULATION_MISMATCH');
		if (sourcePopulationFailure.outcome === 'unavailable')
			expect(sourcePopulationFailure.diagnostics[0]?.message).toBe(
				'The fresh Program source population does not reconcile with CAP-001.'
			);
		vi.restoreAllMocks();

		mockCompilerSession((session) =>
			withProgramOverrides(session, {
				getSourceFiles: () => {
					const sources = session.program.getSourceFiles();
					const first = sources[0]!;
					const changed = new Proxy(first, {
						get(target, key) {
							if (key === 'text') return `${target.text} `;
							const value = Reflect.get(target, key, target) as unknown;
							return typeof value === 'function' ? value.bind(target) : value;
						}
					});
					return [changed, ...sources.slice(1)];
				}
			})
		);
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'INPUT_POPULATION_MISMATCH');
		vi.restoreAllMocks();

		vi.spyOn(declarationContextAnalysisTypeScriptPublicApi, 'getDeclarations').mockReturnValueOnce([
			{
				getSourceFile: () => ({
					fileName: inputs.moduleResolutionTrace.importerWitness.logicalPath
				})
			} as unknown as ts.Declaration
		]);
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'UNSUPPORTED_REQUEST');
	});

	it('fails closed on Program diagnostics and independent parse disagreement', () => {
		const overBudgetDiagnostics = vi.fn(
			() =>
				Array.from(
					{ length: inputs.request.budgets.maxDiagnostics + 1 },
					() => ({})
				) as unknown as ts.DiagnosticWithLocation[]
		);
		mockCompilerSession((session) =>
			withProgramOverrides(session, {
				getSyntacticDiagnostics: overBudgetDiagnostics
			})
		);
		const diagnosticBudgetFailure = buildDeclarationContextAnalysis(inputs);
		expectUnavailable(diagnosticBudgetFailure, 'BUDGET_EXCEEDED');
		if (diagnosticBudgetFailure.outcome === 'unavailable')
			expect(diagnosticBudgetFailure.diagnostics[0]?.message).toBe(
				'Artifact Program diagnostics cumulatively exceed maxDiagnostics.'
			);
		expect(overBudgetDiagnostics).toHaveBeenCalled();
		vi.restoreAllMocks();

		mockCompilerSession((session) =>
			withProgramOverrides(session, {
				getSyntacticDiagnostics: () => [{}] as unknown as ts.DiagnosticWithLocation[]
			})
		);
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'TARGET_UNAVAILABLE');
		vi.restoreAllMocks();

		mockCompilerSession((session) => ({
			...session,
			parseCapturedSourceFile(logicalPath) {
				const parsed = session.parseCapturedSourceFile(logicalPath);
				return { ...parsed, contentBytes: parsed.contentBytes + 1 };
			}
		}));
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'CAPTURE_INVALID');
		vi.restoreAllMocks();

		mockCompilerSession((session) => ({
			...session,
			finalize() {
				const evidence = session.finalize();
				const artifactIndex = evidence.inputRecords.findIndex(
					(record) => record.stage === 'DECLARATION_ARTIFACT_PARSE'
				);
				if (artifactIndex < 1)
					throw new Error('Fixture evidence lacks its dense Program/artifact split.');
				const prior = evidence.inputRecords[artifactIndex - 1]!;
				return {
					...evidence,
					inputRecords: [
						...evidence.inputRecords.slice(0, artifactIndex),
						{ ...prior, ordinal: artifactIndex },
						...evidence.inputRecords.slice(artifactIndex)
					]
				};
			}
		}));
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'CAPTURE_INVALID');
	});

	it('fails closed on final evidence errors, disagreement, and callback interleaving', () => {
		mockCompilerSession((session) => ({
			...session,
			finalize() {
				throw new compilerProgramCapability.CompilerProjectProgramCapabilityError(
					'CAPTURE_UNAVAILABLE',
					'injected finalization failure'
				);
			}
		}));
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'CAPTURE_INVALID');
		vi.restoreAllMocks();

		mockCompilerSession((session) => ({
			...session,
			finalize() {
				throw new Error('injected unexpected finalization failure');
			}
		}));
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'REQUEST_INVALID');
		vi.restoreAllMocks();

		mockCompilerSession((session) => ({
			...session,
			finalize() {
				return { ...session.finalize(), subjectId: 'wrong' };
			}
		}));
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'CAPTURE_INVALID');
		vi.restoreAllMocks();

		mockCompilerSession((session) => ({
			...session,
			finalize() {
				const evidence = session.finalize();
				return {
					...evidence,
					inputRecords: [...evidence.inputRecords.slice(1), evidence.inputRecords[0]!]
				};
			}
		}));
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'CAPTURE_INVALID');
	});

	it('maps compiler capability failures at the active caller-analysis and artifact-parse phases', () => {
		vi.spyOn(
			declarationContextAnalysisTypeScriptPublicApi,
			'getExportsOfModule'
		).mockImplementation(() => {
			throw new compilerProgramCapability.CompilerProjectProgramCapabilityError(
				'CAPTURE_UNAVAILABLE',
				'injected caller-analysis capture loss'
			);
		});
		const callerFailure = buildDeclarationContextAnalysis(inputs);
		expectUnavailable(callerFailure, 'CAPTURE_INVALID');
		if (callerFailure.outcome === 'unavailable')
			expect(callerFailure.diagnostics[0]?.phase).toBe('ROOT_EXPORT_ENUMERATE');
		vi.restoreAllMocks();

		mockCompilerSession((session) => ({
			...session,
			parseCapturedSourceFile() {
				throw new compilerProgramCapability.CompilerProjectProgramCapabilityError(
					'BUDGET_EXCEEDED',
					'injected artifact-read budget exhaustion'
				);
			}
		}));
		const parseFailure = buildDeclarationContextAnalysis(inputs);
		expectUnavailable(parseFailure, 'BUDGET_EXCEEDED');
		if (parseFailure.outcome === 'unavailable')
			expect(parseFailure.diagnostics[0]?.phase).toBe('ARTIFACT_PARSE_ACCOUNT');
	});

	it('fails closed on missing source reads and malformed materialized evidence', () => {
		mockCompilerSession((session) => ({
			...session,
			finalize() {
				const evidence = session.finalize();
				const logicalPath = inputs.moduleResolutionTrace.targetWitness.logicalPath;
				return {
					...evidence,
					inputRecords: evidence.inputRecords.map((record) =>
						record.stage !== 'DECLARATION_ARTIFACT_PARSE' &&
						record.query.operation === 'READ_FILE' &&
						record.query.logicalPath === logicalPath &&
						record.observation.operation === 'READ_FILE' &&
						record.observation.result === 'PRESENT'
							? {
									...record,
									observation: { ...record.observation, contentSha256: '0'.repeat(64) }
								}
							: record
					)
				};
			}
		}));
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'CAPTURE_INVALID');
		vi.restoreAllMocks();

		mockCompilerSession((session) => ({
			...session,
			finalize() {
				const evidence = session.finalize();
				return {
					...evidence,
					inputRecords: [
						{ ...evidence.inputRecords[0]!, ordinal: 1 },
						...evidence.inputRecords.slice(1)
					]
				};
			}
		}));
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'CAPTURE_INVALID');
		vi.restoreAllMocks();

		mockCompilerSession((session) => ({
			...session,
			finalize() {
				const evidence = session.finalize();
				return {
					...evidence,
					compilerHostCallbacks: evidence.compilerHostCallbacks + 1,
					programCompilerHostCallbacks: evidence.programCompilerHostCallbacks + 1
				};
			}
		}));
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'CAPTURE_INVALID');
		vi.restoreAllMocks();

		mockCompilerSession((session) => ({
			...session,
			finalize() {
				const evidence = session.finalize();
				return {
					...evidence,
					inputRecords: evidence.inputRecords.map((record) =>
						record.stage === 'DECLARATION_ARTIFACT_PARSE'
							? ({
									...record,
									query: { ...record.query, logicalPath: 'wrong.d.ts' }
								} as unknown as typeof record)
							: record
					)
				};
			}
		}));
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'CAPTURE_INVALID');
	});

	it('saturates constructed-validation ceilings for safe-integer input budgets', () => {
		const outcome = buildDeclarationContextAnalysis(
			withBudgets(inputs, {
				maxInputRecords: Number.MAX_SAFE_INTEGER,
				maxInputStringCharacters: Number.MAX_SAFE_INTEGER
			})
		);
		expect(outcome.outcome).toBe('partial');
	});

	it('fails closed when the exact compiler capture is lost or compiler options do not reconcile', () => {
		const clonedSnapshot = structuredClone(inputs.semanticSnapshot);
		vi.spyOn(traceValidator, 'validateConstructedModuleResolutionTrace').mockReturnValueOnce(
			VALID as never
		);
		expectUnavailable(
			buildDeclarationContextAnalysis({ ...inputs, semanticSnapshot: clonedSnapshot }),
			'CAPTURE_INVALID'
		);
		vi.restoreAllMocks();

		vi.spyOn(traceValidator, 'validateConstructedModuleResolutionTrace').mockReturnValueOnce(
			VALID as never
		);
		expectUnavailable(
			buildDeclarationContextAnalysis({
				...inputs,
				moduleResolutionTrace: {
					...inputs.moduleResolutionTrace,
					resolverEnvironment: {
						...inputs.moduleResolutionTrace.resolverEnvironment,
						compilerOptionsDigest: 'f'.repeat(64)
					}
				}
			}),
			'CAPTURE_INVALID'
		);
	});

	it('enforces deterministic maxDurationMs boundaries before and immediately before Program work', () => {
		let optionInspectionTime = 0;
		const timedOptions = { onProgress: () => undefined };
		const originalOwnKeys = Reflect.ownKeys;
		vi.spyOn(Reflect, 'ownKeys').mockImplementation((value) => {
			if (value === timedOptions) optionInspectionTime = 2;
			return originalOwnKeys(value);
		});
		vi.spyOn(operationClock, 'createMonotonicOperationClock').mockImplementationOnce(() => ({
			now: () => optionInspectionTime,
			startedAtMs: optionInspectionTime
		}));
		const optionInspectionExpiry = buildDeclarationContextAnalysis(
			withBudgets(inputs, { maxDurationMs: 1 }),
			timedOptions
		);
		expectUnavailable(optionInspectionExpiry, 'BUDGET_EXCEEDED');
		if (optionInspectionExpiry.outcome === 'unavailable')
			expect(optionInspectionExpiry.diagnostics[0]?.phase).toBe('REQUEST_BIND');
		vi.restoreAllMocks();

		let descriptorClockCalls = 0;
		vi.spyOn(operationClock, 'createMonotonicOperationClock').mockReturnValueOnce({
			now: () => (descriptorClockCalls++ === 0 ? 0 : 2),
			startedAtMs: 0
		});
		const descriptorExpiry = buildDeclarationContextAnalysis(
			withRequest(withBudgets(inputs, { maxDurationMs: 1 }), {
				exportName: 'x'.repeat(4_096)
			})
		);
		expectUnavailable(descriptorExpiry, 'BUDGET_EXCEEDED');
		if (descriptorExpiry.outcome === 'unavailable')
			expect(descriptorExpiry.diagnostics[0]?.phase).toBe('REQUEST_BIND');
		vi.restoreAllMocks();

		vi.spyOn(operationClock, 'createMonotonicOperationClock').mockReturnValueOnce({
			now: () => 102,
			startedAtMs: 100
		});
		expectUnavailable(
			buildDeclarationContextAnalysis(withBudgets(inputs, { maxDurationMs: 1 })),
			'BUDGET_EXCEEDED'
		);
		vi.restoreAllMocks();
		vi.spyOn(operationClock, 'createMonotonicOperationClock').mockReturnValueOnce({
			now: () => 101,
			startedAtMs: 100
		});
		expectUnavailable(
			buildDeclarationContextAnalysis(withBudgets(inputs, { maxDurationMs: 1 })),
			'BUDGET_EXCEEDED'
		);
		vi.restoreAllMocks();

		vi.spyOn(operationClock, 'createMonotonicOperationClock').mockImplementationOnce(() => {
			throw new Error('injected unavailable monotonic clock');
		});
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'REQUEST_INVALID');
		vi.restoreAllMocks();

		vi.spyOn(operationClock, 'createMonotonicOperationClock').mockReturnValueOnce({
			now: () => 0,
			startedAtMs: Number.NaN
		});
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'BUDGET_EXCEEDED');
		vi.restoreAllMocks();

		const originalConstructedValidator =
			analysisValidator.validateConstructedDeclarationContextAnalysis;
		let calibrationClockCalls = 0;
		let remainingDurationCallOrdinal = 0;
		vi.spyOn(operationClock, 'createMonotonicOperationClock').mockReturnValueOnce({
			now: () => {
				calibrationClockCalls += 1;
				return 100;
			},
			startedAtMs: 100
		});
		vi.spyOn(analysisValidator, 'validateConstructedDeclarationContextAnalysis').mockImplementation(
			(...args) => {
				remainingDurationCallOrdinal = calibrationClockCalls;
				return originalConstructedValidator(...args);
			}
		);
		expect(buildDeclarationContextAnalysis(inputs).outcome).toBe('partial');
		expect(remainingDurationCallOrdinal).toBeGreaterThan(0);
		vi.restoreAllMocks();

		let boundaryClockCalls = 0;
		const finalDeadline = 100 + inputs.request.budgets.maxDurationMs;
		vi.spyOn(operationClock, 'createMonotonicOperationClock').mockReturnValueOnce({
			now: () => {
				boundaryClockCalls += 1;
				return boundaryClockCalls === remainingDurationCallOrdinal ? finalDeadline + 1 : 100;
			},
			startedAtMs: 100
		});
		const finalBoundary = buildDeclarationContextAnalysis(inputs);
		expectUnavailable(finalBoundary, 'BUDGET_EXCEEDED');
		if (finalBoundary.outcome === 'unavailable')
			expect(finalBoundary.diagnostics[0]?.phase).toBe('ANALYSIS_VALIDATE');
		vi.restoreAllMocks();

		vi.spyOn(operationClock, 'createMonotonicOperationClock').mockReturnValueOnce({
			now: () => Number.MAX_SAFE_INTEGER,
			startedAtMs: Number.MAX_SAFE_INTEGER
		});
		expect(
			buildDeclarationContextAnalysis(
				withBudgets(inputs, { maxDurationMs: Number.MAX_SAFE_INTEGER })
			).outcome
		).toBe('partial');
	});

	it('fails closed on unexpected public compiler exceptions', () => {
		vi.spyOn(
			declarationContextAnalysisTypeScriptPublicApi,
			'getSymbolAtLocation'
		).mockImplementation(() => {
			throw new Error('unexpected compiler failure');
		});
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'REQUEST_INVALID');
		vi.restoreAllMocks();

		vi.spyOn(
			declarationContextAnalysisCompilerProgramCapability,
			'createCompilerProjectProgramSession'
		).mockImplementation(() => {
			throw new Error('unexpected Program construction failure');
		});
		expectUnavailable(buildDeclarationContextAnalysis(inputs), 'REQUEST_INVALID');
	});

	it('independently rejects wrong IDs, content, populations, and a wrong constructed digest', () => {
		const wrongId = { ...baseline, id: 'wrong' as never };
		expect(analysisValidator.validateDeclarationContextAnalysis(wrongId, inputs).state).toBe(
			'INVALID'
		);
		const wrongContent = { ...baseline, contentDigest: '0'.repeat(64) };
		expect(analysisValidator.validateDeclarationContextAnalysis(wrongContent, inputs).state).toBe(
			'INVALID'
		);
		const populationWithoutDigest = {
			...baseline,
			coverage: {
				...baseline.coverage,
				declarations: baseline.coverage.declarations + 1
			}
		};
		const population = {
			...populationWithoutDigest,
			contentDigest: declarationContextAnalysisContentDigest(populationWithoutDigest)
		};
		expect(analysisValidator.validateDeclarationContextAnalysis(population, inputs).state).toBe(
			'INVALID'
		);
		expect(
			analysisValidator.validateConstructedDeclarationContextAnalysis(
				baseline,
				inputs,
				'f'.repeat(64)
			).state
		).toBe('INVALID');
	}, 180_000);
});
