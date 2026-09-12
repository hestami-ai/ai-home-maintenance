import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import ts from 'typescript';

import * as csaaPublicApi from '../index.js';
import {
	DECLARATION_CONTEXT_ANALYSIS_SELECTION,
	type DeclarationContextAnalysisBuildInputs,
	type DeclarationContextAnalysisSnapshot,
	type DeclarationContextAnalysisValidationIssueCode,
	type DeclarationContextAnalysisValidationOptions
} from '../contracts/declaration-context-analysis.js';
import * as graphValidator from '../graph/validate-project-context-graph.js';
import * as conditionalValidator from '../resolution/validate-conditional-export-resolution.js';
import * as traceValidator from '../resolution/validate-module-resolution-trace.js';
import { buildDeclarationContextAnalysis } from './build-declaration-context-analysis.js';
import { declarationContextAnalysisContentDigest } from './declaration-context-analysis-canonical.js';
import {
	createDeclarationContextAnalysisFixture,
	declarationContextAnalysisInputs,
	type DeclarationContextAnalysisFixture,
	type DeclarationContextAnalysisFixtureOptions
} from './declaration-context-analysis-fixture.test-support.js';
import * as semanticValidator from './validate-snapshot.js';
import {
	compareDeclarationContextAnalysisCanonicalValuesForTesting,
	type DeclarationContextAnalysisValidationProviderOverrides,
	validateConstructedDeclarationContextAnalysis,
	validateDeclarationContextAnalysis,
	validateDeclarationContextAnalysisWithProviderForTesting
} from './validate-declaration-context-analysis.js';

function expectIssue(
	result: ReturnType<typeof validateDeclarationContextAnalysis>,
	code: DeclarationContextAnalysisValidationIssueCode
): void {
	expect(result.state).not.toBe('VALID');
	expect(result.issues[0]?.code).toBe(code);
}

function withRequest(
	inputs: DeclarationContextAnalysisBuildInputs,
	request: DeclarationContextAnalysisBuildInputs['request']
): DeclarationContextAnalysisBuildInputs {
	return { ...inputs, request };
}

function withBudgets(
	inputs: DeclarationContextAnalysisBuildInputs,
	overrides: Partial<DeclarationContextAnalysisBuildInputs['request']['budgets']>
): DeclarationContextAnalysisBuildInputs {
	return withRequest(inputs, {
		...inputs.request,
		budgets: { ...inputs.request.budgets, ...overrides }
	});
}

function predecessorResult(state: 'BUDGET_EXHAUSTED' | 'INVALID') {
	return {
		issues: [{ code: 'INPUT_INVALID', message: 'injected predecessor refusal', path: '$injected' }],
		state
	} as const;
}

describe('validateDeclarationContextAnalysis', () => {
	let fixture: DeclarationContextAnalysisFixture;
	let inputs: DeclarationContextAnalysisBuildInputs;
	let baseline: DeclarationContextAnalysisSnapshot;

	beforeAll(() => {
		fixture = createDeclarationContextAnalysisFixture({ declarationState: 'MERGED' });
		inputs = declarationContextAnalysisInputs(fixture);
		const outcome = buildDeclarationContextAnalysis(inputs);
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		baseline = outcome.analysis;
		expect(validateDeclarationContextAnalysis(baseline, inputs)).toEqual({
			issues: [],
			state: 'VALID'
		});
	}, 120_000);

	afterEach(() => {
		vi.restoreAllMocks();
	});

	afterAll(() => {
		fixture.cleanup();
	});

	it('closes validation options and rejects hostile candidate descriptors without observation', () => {
		expectIssue(
			validateDeclarationContextAnalysis(baseline, inputs, null as never),
			'SHAPE_INVALID'
		);
		expectIssue(
			validateDeclarationContextAnalysis(baseline, inputs, { unexpected: 1 } as never),
			'SHAPE_INVALID'
		);
		expectIssue(
			validateDeclarationContextAnalysis(baseline, inputs, {
				maxDepth: 1,
				maxDurationMs: 1,
				maxInputRecords: 1,
				maxInputStringCharacters: 1,
				maxIssues: 1,
				maxRecords: 1,
				maxStringCharacters: 1,
				unexpected: 1
			} as never),
			'SHAPE_INVALID'
		);
		expect(validateDeclarationContextAnalysis(baseline, inputs, {})).toEqual({
			issues: [],
			state: 'VALID'
		});
		expectIssue(
			validateDeclarationContextAnalysis(baseline, inputs, { maxDepth: 0 }),
			'SHAPE_INVALID'
		);
		expectIssue(
			validateDeclarationContextAnalysis(baseline, inputs, { maxDurationMs: 0 }),
			'SHAPE_INVALID'
		);
		expectIssue(
			validateDeclarationContextAnalysis(baseline, inputs, { maxIssues: 100_001 }),
			'SHAPE_INVALID'
		);
		let optionGetterCalls = 0;
		const accessorOptions: Record<string, unknown> = {};
		Object.defineProperty(accessorOptions, 'maxDepth', {
			enumerable: true,
			get() {
				optionGetterCalls += 1;
				return 1;
			}
		});
		expectIssue(
			validateDeclarationContextAnalysis(
				baseline,
				inputs,
				accessorOptions as DeclarationContextAnalysisValidationOptions
			),
			'SHAPE_INVALID'
		);
		expect(optionGetterCalls).toBe(0);

		const cyclic: Record<string, unknown> = {};
		cyclic.self = cyclic;
		const symbolKey = { value: 1 } as Record<PropertyKey, unknown>;
		symbolKey[Symbol('hostile')] = 2;
		const sparse = new Array<unknown>(2);
		const expando: unknown[] = [];
		Object.defineProperty(expando, 'x', { enumerable: true, value: 1 });
		const leadingZeroIndex: unknown[] = [null];
		delete leadingZeroIndex[0];
		Object.defineProperty(leadingZeroIndex, '01', { enumerable: true, value: null });
		const overflowingIndex: unknown[] = [null];
		delete overflowingIndex[0];
		Object.defineProperty(overflowingIndex, '999999999999999999999999', {
			enumerable: true,
			value: null
		});
		let candidateGetterCalls = 0;
		const accessorCandidate: Record<string, unknown> = {};
		Object.defineProperty(accessorCandidate, 'x', {
			enumerable: true,
			get() {
				candidateGetterCalls += 1;
				return 1;
			}
		});
		let proxyTrapCalls = 0;
		const proxyCandidate = new Proxy(
			{},
			{
				getPrototypeOf() {
					proxyTrapCalls += 1;
					throw new Error('must not run');
				}
			}
		);
		const invalidCandidates: readonly unknown[] = [
			undefined,
			() => undefined,
			'\ud800',
			'\udc00',
			'\ud83d\ude00',
			new Date(0),
			proxyCandidate,
			cyclic,
			symbolKey,
			sparse,
			expando,
			leadingZeroIndex,
			overflowingIndex,
			accessorCandidate
		];
		for (const candidate of invalidCandidates)
			expectIssue(validateDeclarationContextAnalysis(candidate, inputs), 'SHAPE_INVALID');
		expect(candidateGetterCalls).toBe(0);
		expect(proxyTrapCalls).toBe(0);

		const nonScalarKey = {} as Record<string, unknown>;
		Object.defineProperty(nonScalarKey, '\ud800', { enumerable: true, value: 1 });
		expectIssue(validateDeclarationContextAnalysis(nonScalarKey, inputs), 'SHAPE_INVALID');
		expectIssue(
			validateDeclarationContextAnalysis('too long', inputs, { maxStringCharacters: 1 }),
			'BUDGET_EXHAUSTED'
		);
		expectIssue(
			validateDeclarationContextAnalysis({ xx: 1 }, inputs, { maxStringCharacters: 1 }),
			'BUDGET_EXHAUSTED'
		);
		expectIssue(
			validateDeclarationContextAnalysis([null, null], inputs, { maxRecords: 1 }),
			'BUDGET_EXHAUSTED'
		);
		expectIssue(
			validateDeclarationContextAnalysis({ x: 1 }, inputs, { maxRecords: 1 }),
			'BUDGET_EXHAUSTED'
		);
		expectIssue(
			validateDeclarationContextAnalysis({ x: { y: 1 } }, inputs, { maxDepth: 1 }),
			'BUDGET_EXHAUSTED'
		);
		expectIssue(
			validateDeclarationContextAnalysis({ b: { x: 1, y: 1 }, a: 1 }, inputs, { maxRecords: 4 }),
			'BUDGET_EXHAUSTED'
		);
		const replacedArrayIndex: unknown[] = [null];
		delete replacedArrayIndex[0];
		Object.defineProperty(replacedArrayIndex, 'x', { enumerable: true, value: null });
		expectIssue(validateDeclarationContextAnalysis(replacedArrayIndex, inputs), 'SHAPE_INVALID');
	});

	it('rejects exact candidate identity, content, and independently derived value tampering', () => {
		expectIssue(validateDeclarationContextAnalysis({}, inputs), 'SHAPE_INVALID');
		expectIssue(
			validateDeclarationContextAnalysis(
				{ ...baseline, id: 'declaration-context-analysis-wrong' as never },
				inputs
			),
			'IDENTITY_MISMATCH'
		);
		expectIssue(
			validateDeclarationContextAnalysis({ ...baseline, contentDigest: '0'.repeat(64) }, inputs),
			'CONTENT_DIGEST_MISMATCH'
		);
		const derivedMismatchWithoutDigest = {
			...baseline,
			closure: 'forged-closure'
		} as unknown as Omit<DeclarationContextAnalysisSnapshot, 'contentDigest'>;
		const derivedMismatch = {
			...derivedMismatchWithoutDigest,
			contentDigest: declarationContextAnalysisContentDigest(derivedMismatchWithoutDigest)
		} as DeclarationContextAnalysisSnapshot;
		expectIssue(validateDeclarationContextAnalysis(derivedMismatch, inputs), 'DERIVATION_MISMATCH');
		const populationMismatchWithoutDigest = {
			...baseline,
			ambientEffectRecords: [{ unexpected: true }]
		} as unknown as Omit<DeclarationContextAnalysisSnapshot, 'contentDigest'>;
		const populationMismatch = {
			...populationMismatchWithoutDigest,
			contentDigest: declarationContextAnalysisContentDigest(populationMismatchWithoutDigest)
		} as DeclarationContextAnalysisSnapshot;
		expectIssue(
			validateDeclarationContextAnalysis(populationMismatch, inputs),
			'DERIVATION_MISMATCH'
		);
	});

	it('compares canonical values independently of escaped-string chunk boundaries', () => {
		const commonPrefix = 'p'.repeat(1_023);
		const right = { value: `${commonPrefix}A` };
		for (const escaped of ['"', '\\', '\n']) {
			const left = { value: `${commonPrefix}${escaped}` };
			const leftCanonical = JSON.stringify(left);
			const rightCanonical = JSON.stringify(right);
			const expected = leftCanonical < rightCanonical ? -1 : leftCanonical > rightCanonical ? 1 : 0;
			expect(compareDeclarationContextAnalysisCanonicalValuesForTesting(left, right)).toBe(
				expected
			);
			expect(compareDeclarationContextAnalysisCanonicalValuesForTesting(right, left)).toBe(
				-expected
			);
		}
		expect(compareDeclarationContextAnalysisCanonicalValuesForTesting(right, right)).toBe(0);
		expect(
			compareDeclarationContextAnalysisCanonicalValuesForTesting(
				{ value: '\b\t\f\r' },
				{ value: '\b\t\f\r' }
			)
		).toBe(0);
		expect(() =>
			compareDeclarationContextAnalysisCanonicalValuesForTesting(
				{ value: '\ud800' },
				{ value: '\ud800' }
			)
		).toThrow('lone UTF-16 surrogates');
		expect(() =>
			compareDeclarationContextAnalysisCanonicalValuesForTesting(
				{ value: '\udc00' },
				{ value: '\udc00' }
			)
		).toThrow('lone UTF-16 surrogates');
		expect(() =>
			compareDeclarationContextAnalysisCanonicalValuesForTesting(
				{ value: Number.POSITIVE_INFINITY },
				{ value: Number.POSITIVE_INFINITY }
			)
		).toThrow('finite safe integer numbers');
		expect('compareDeclarationContextAnalysisCanonicalValuesForTesting' in csaaPublicApi).toBe(
			false
		);
	});

	it('preserves an astral scalar across the canonical digest chunk boundary', () => {
		const terminalName = `${'A'.repeat(1_023)}\u{10400}`;
		const astralFixture = createDeclarationContextAnalysisFixture({
			declarationState: 'SINGLE',
			targetDeclarationText: `interface ${terminalName} {}\nexport { ${terminalName} as SelectedContract };\n`
		});
		try {
			const astralInputs = declarationContextAnalysisInputs(astralFixture);
			const outcome = buildDeclarationContextAnalysis(astralInputs);
			if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
			expect(outcome.analysis.terminalSymbol.name).toBe(terminalName);
			expect(validateDeclarationContextAnalysis(outcome.analysis, astralInputs)).toEqual({
				issues: [],
				state: 'VALID'
			});
		} finally {
			astralFixture.cleanup();
		}
	}, 180_000);

	it('enforces the public arity and fail-closed exception boundary', () => {
		const validator = validateDeclarationContextAnalysis as unknown as (
			...args: unknown[]
		) => ReturnType<typeof validateDeclarationContextAnalysis>;
		expectIssue(validator(), 'SHAPE_INVALID');
		expectIssue(validator(baseline), 'SHAPE_INVALID');
		expectIssue(validator(baseline, inputs, undefined, undefined), 'SHAPE_INVALID');
		vi.spyOn(semanticValidator, 'validateStaticSemanticSnapshot').mockImplementationOnce(() => {
			throw new Error('injected public predecessor exception');
		});
		expectIssue(validateDeclarationContextAnalysis(baseline, inputs), 'SHAPE_INVALID');
	});

	it('enforces constructed-validator arguments only over an immediately proven producer chain', () => {
		const outcome = buildDeclarationContextAnalysis(inputs);
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		expect(
			validateConstructedDeclarationContextAnalysis(
				outcome.analysis,
				inputs,
				outcome.analysis.inputDigest
			)
		).toEqual({ issues: [], state: 'VALID' });
		expectIssue(
			validateConstructedDeclarationContextAnalysis(outcome.analysis, inputs, 'invalid'),
			'SHAPE_INVALID'
		);
		expectIssue(
			validateConstructedDeclarationContextAnalysis(outcome.analysis, inputs, '0'.repeat(64)),
			'IDENTITY_MISMATCH'
		);
		const validator = validateConstructedDeclarationContextAnalysis as unknown as (
			...args: unknown[]
		) => ReturnType<typeof validateConstructedDeclarationContextAnalysis>;
		expectIssue(validator(outcome.analysis, inputs), 'SHAPE_INVALID');
		expectIssue(
			validator(outcome.analysis, inputs, outcome.analysis.inputDigest, undefined, undefined),
			'SHAPE_INVALID'
		);
	}, 120_000);

	it('rejects hostile input wrappers and independently request-bounds their complete descriptor tree', () => {
		expectIssue(validateDeclarationContextAnalysis(baseline, null as never), 'INPUT_INVALID');
		expectIssue(validateDeclarationContextAnalysis(baseline, {} as never), 'INPUT_INVALID');
		expectIssue(
			validateDeclarationContextAnalysis(baseline, { ...inputs, request: 1 } as never),
			'INPUT_INVALID'
		);

		let getterCalls = 0;
		const accessorSelection: Record<string, unknown> = {};
		Object.defineProperty(accessorSelection, 'criterion', {
			enumerable: true,
			get() {
				getterCalls += 1;
				return 'hostile';
			}
		});
		expectIssue(
			validateDeclarationContextAnalysis(baseline, {
				...inputs,
				request: { ...inputs.request, selection: accessorSelection as never }
			}),
			'INPUT_INVALID'
		);
		expect(getterCalls).toBe(0);

		const cyclicSelection: Record<string, unknown> = {};
		cyclicSelection.self = cyclicSelection;
		expectIssue(
			validateDeclarationContextAnalysis(baseline, {
				...inputs,
				request: { ...inputs.request, selection: cyclicSelection as never }
			}),
			'INPUT_INVALID'
		);
		expectIssue(
			validateDeclarationContextAnalysis(baseline, inputs, { maxInputRecords: 1 }),
			'BUDGET_EXHAUSTED'
		);
		expectIssue(
			validateDeclarationContextAnalysis(baseline, withBudgets(inputs, { maxInputRecords: 1 })),
			'BUDGET_EXHAUSTED'
		);
		expectIssue(
			validateDeclarationContextAnalysis(
				baseline,
				withBudgets(inputs, { maxInputStringCharacters: 1 })
			),
			'BUDGET_EXHAUSTED'
		);
	});

	it('rejects malformed request constants before predecessor or compiler work', () => {
		const cases: DeclarationContextAnalysisBuildInputs[] = [
			withRequest(inputs, { ...inputs.request, unexpected: true } as never),
			withRequest(inputs, {
				...inputs.request,
				budgets: { ...inputs.request.budgets, unexpected: 1 } as never
			}),
			withRequest(inputs, {
				...inputs.request,
				selection: {
					...DECLARATION_CONTEXT_ANALYSIS_SELECTION,
					terminalDeclarationPlacement: 'wrong'
				} as never
			}),
			withBudgets(inputs, { maxArtifacts: 0 }),
			withBudgets(inputs, { maxReadBytes: 1 }),
			withRequest(inputs, { ...inputs.request, exportName: '' }),
			withRequest(inputs, { ...inputs.request, exportName: '\ud800' }),
			withRequest(inputs, { ...inputs.request, subjectId: 'invalid' }),
			withRequest(inputs, {
				...inputs.request,
				projectContextGraph: { ...inputs.request.projectContextGraph, contentDigest: 'invalid' }
			})
		];
		for (const invalidInputs of cases)
			expectIssue(validateDeclarationContextAnalysis(baseline, invalidInputs), 'INPUT_INVALID');
	});

	it('binds exact request identities after validating the unchanged predecessor chain', () => {
		const alternateSubject = `${inputs.request.subjectId[0] === '0' ? '1' : '0'}${inputs.request.subjectId.slice(1)}`;
		for (const mismatched of [
			withRequest(inputs, { ...inputs.request, subjectId: alternateSubject }),
			withRequest(inputs, { ...inputs.request, semanticSnapshotId: 'semantic:wrong' as never }),
			withRequest(inputs, {
				...inputs.request,
				conditionalExportResolution: {
					...inputs.request.conditionalExportResolution,
					id: 'conditional-export-resolution-wrong' as never
				}
			})
		])
			expectIssue(validateDeclarationContextAnalysis(baseline, mismatched), 'IDENTITY_MISMATCH');
	}, 120_000);

	it('maps every predecessor refusal without advancing past it', () => {
		for (const state of ['INVALID', 'BUDGET_EXHAUSTED'] as const) {
			const semantic = vi
				.spyOn(semanticValidator, 'validateStaticSemanticSnapshot')
				.mockReturnValueOnce(predecessorResult(state) as never);
			expectIssue(
				validateDeclarationContextAnalysis(baseline, inputs),
				state === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXHAUSTED' : 'INPUT_INVALID'
			);
			semantic.mockRestore();

			const graph = vi
				.spyOn(graphValidator, 'validateConstructedProjectContextGraph')
				.mockReturnValueOnce(predecessorResult(state) as never);
			expectIssue(
				validateDeclarationContextAnalysis(baseline, inputs),
				state === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXHAUSTED' : 'INPUT_INVALID'
			);
			graph.mockRestore();

			const conditional = vi
				.spyOn(conditionalValidator, 'validateConstructedConditionalExportResolution')
				.mockReturnValueOnce(predecessorResult(state) as never);
			expectIssue(
				validateDeclarationContextAnalysis(baseline, inputs),
				state === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXHAUSTED' : 'INPUT_INVALID'
			);
			conditional.mockRestore();

			const trace = vi
				.spyOn(traceValidator, 'validateConstructedModuleResolutionTrace')
				.mockReturnValueOnce(predecessorResult(state) as never);
			expectIssue(
				validateDeclarationContextAnalysis(baseline, inputs),
				state === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXHAUSTED' : 'INPUT_INVALID'
			);
			trace.mockRestore();
		}
	}, 120_000);

	it('replays every independently measurable one-below operation budget', () => {
		const boundaries: Array<
			readonly [keyof DeclarationContextAnalysisBuildInputs['request']['budgets'], number]
		> = [
			['maxCompilerInputAttempts', baseline.programWitness.attributedCompilerInputAttempts - 1],
			['maxProgramReadBytes', baseline.programWitness.attributedProgramReadBytes - 1],
			['maxProgramSourceFiles', baseline.coverage.programSourceFiles - 1],
			['maxProgramAstNodes', baseline.coverage.programParsedAstNodes - 1],
			['maxParsedArtifactAstNodes', baseline.coverage.selectedAstNodes - 1],
			['maxAliasHops', baseline.coverage.aliasHops - 1],
			['maxDeclarations', baseline.coverage.declarations - 1],
			['maxRelations', baseline.coverage.relationRecords - 1],
			['maxTraversalSteps', baseline.coverage.chargedTraversalSteps - 1],
			['maxOutputRecords', baseline.coverage.outputRecords - 1]
		];
		for (const [key, value] of boundaries) {
			const result = validateDeclarationContextAnalysis(
				baseline,
				withBudgets(inputs, { [key]: value })
			);
			expect(result.state).not.toBe('VALID');
			expect(result.issues[0]?.code, `${key}:${value}:${JSON.stringify(result)}`).toBe(
				'BUDGET_EXHAUSTED'
			);
		}
		const maxReadBytes = baseline.coverage.readBytes - 1;
		expectIssue(
			validateDeclarationContextAnalysis(
				baseline,
				withBudgets(inputs, {
					maxProgramReadBytes: Math.min(
						baseline.programWitness.attributedProgramReadBytes,
						maxReadBytes
					),
					maxReadBytes
				})
			),
			'BUDGET_EXHAUSTED'
		);
		expectIssue(
			validateDeclarationContextAnalysis(baseline, withBudgets(inputs, { maxTraversalSteps: 1 })),
			'BUDGET_EXHAUSTED'
		);
	}, 180_000);

	it('fails closed on a broken operation clock and capture preflight', () => {
		vi.spyOn(performance, 'now').mockReturnValueOnce(Number.NaN);
		expectIssue(validateDeclarationContextAnalysis(baseline, inputs), 'INPUT_INVALID');
		vi.restoreAllMocks();
		vi.spyOn(performance, 'now').mockImplementation(() => {
			throw new Error('clock failure');
		});
		expectIssue(validateDeclarationContextAnalysis(baseline, inputs), 'INPUT_INVALID');
		vi.restoreAllMocks();
		vi.spyOn(performance, 'now')
			.mockReturnValueOnce(0)
			.mockImplementation(() => {
				throw new Error('checkpoint clock failure');
			});
		expectIssue(validateDeclarationContextAnalysis(baseline, inputs), 'INPUT_INVALID');
		vi.restoreAllMocks();
		vi.spyOn(performance, 'now').mockReturnValueOnce(10).mockReturnValue(9);
		expectIssue(validateDeclarationContextAnalysis(baseline, inputs), 'INPUT_INVALID');
		vi.restoreAllMocks();
		vi.spyOn(performance, 'now')
			.mockReturnValueOnce(0)
			.mockReturnValue(Number.MAX_SAFE_INTEGER + 1);
		expectIssue(validateDeclarationContextAnalysis(baseline, inputs), 'INPUT_INVALID');
		vi.restoreAllMocks();
		vi.spyOn(performance, 'now')
			.mockReturnValueOnce(0)
			.mockReturnValue(inputs.request.budgets.maxDurationMs + 1);
		expectIssue(validateDeclarationContextAnalysis(baseline, inputs), 'BUDGET_EXHAUSTED');
		vi.restoreAllMocks();
		vi.spyOn(performance, 'now')
			.mockReturnValueOnce(0)
			.mockReturnValue(inputs.request.budgets.maxDurationMs);
		expectIssue(validateDeclarationContextAnalysis(baseline, inputs), 'BUDGET_EXHAUSTED');
		vi.restoreAllMocks();
		vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValue(2);
		expectIssue(
			validateDeclarationContextAnalysis(baseline, inputs, { maxDurationMs: 1 }),
			'BUDGET_EXHAUSTED'
		);
		vi.restoreAllMocks();
		let descriptorClockCalls = 0;
		vi.spyOn(performance, 'now').mockImplementation(() => (descriptorClockCalls++ < 10 ? 0 : 2));
		expectIssue(
			validateDeclarationContextAnalysis({ wideScalar: 'x'.repeat(2_048) }, inputs, {
				maxDurationMs: 1
			}),
			'BUDGET_EXHAUSTED'
		);
	}, 120_000);

	it('fails closed across the independently replayed derive clock boundaries', () => {
		const outcome = buildDeclarationContextAnalysis(inputs);
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		const run = (
			deriveNow: (ordinal: number) => number,
			code: DeclarationContextAnalysisValidationIssueCode
		): void => {
			let deriveOrdinal = 0;
			vi.spyOn(performance, 'now').mockReturnValue(0);
			expectIssue(
				validateDeclarationContextAnalysisWithProviderForTesting(
					outcome.analysis,
					inputs,
					{ monotonicNow: () => deriveNow(deriveOrdinal++) },
					{ maxDurationMs: 1 }
				),
				code
			);
			vi.restoreAllMocks();
		};
		run(() => Number.NaN, 'INPUT_INVALID');
		run((ordinal) => (ordinal === 0 ? 10 : 9), 'INPUT_INVALID');
		run((ordinal) => (ordinal === 0 ? 0 : Number.MAX_SAFE_INTEGER + 1), 'INPUT_INVALID');
		run((ordinal) => (ordinal === 0 ? 0 : 2), 'BUDGET_EXHAUSTED');
		run((ordinal) => (ordinal === 0 ? 0 : 1), 'BUDGET_EXHAUSTED');
		run((ordinal) => (ordinal < 64 ? 0 : 2), 'BUDGET_EXHAUSTED');
	}, 120_000);

	it('honors the request duration during the initial descriptor walks', () => {
		const durationInputs = withBudgets(inputs, { maxDurationMs: 1 });
		const malformedWideCandidate = {
			unexpected: Array.from({ length: 1_024 }, (_, ordinal) => ({ ordinal }))
		};
		vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValue(2);
		expectIssue(
			validateDeclarationContextAnalysis(malformedWideCandidate, durationInputs),
			'BUDGET_EXHAUSTED'
		);
	}, 120_000);

	it('accepts an exact maximum-safe duration without absolute-epoch overflow', () => {
		const maxDurationInputs = withBudgets(inputs, { maxDurationMs: Number.MAX_SAFE_INTEGER });
		const outcome = buildDeclarationContextAnalysis(maxDurationInputs);
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		vi.spyOn(performance, 'now').mockReturnValue(0);
		expect(
			validateDeclarationContextAnalysisWithProviderForTesting(
				outcome.analysis,
				maxDurationInputs,
				{ monotonicNow: () => 0 },
				{ maxDurationMs: Number.MAX_SAFE_INTEGER }
			)
		).toEqual({ issues: [], state: 'VALID' });
	}, 120_000);

	it('fails closed over immutable per-call defensive compiler provider faults', () => {
		const run = (
			name: string,
			overrides: DeclarationContextAnalysisValidationProviderOverrides,
			code: DeclarationContextAnalysisValidationIssueCode = 'INPUT_INVALID'
		): ReturnType<typeof validateDeclarationContextAnalysis> => {
			const result = validateDeclarationContextAnalysisWithProviderForTesting(
				baseline,
				inputs,
				overrides
			);
			expect(result.state, `${name}: ${JSON.stringify(result)}`).not.toBe('VALID');
			expect(result.issues[0]?.code, `${name}: ${JSON.stringify(result)}`).toBe(code);
			return result;
		};

		run('session identity', {
			sessionIdentity: (session) => ({
				configPath: session.configPath,
				semanticProgramId: 'semantic-program-fault',
				semanticProjectId: session.semanticProjectId
			})
		});
		run('duplicate Program source path', {
			programSourceFiles: (session) => {
				const files = session.program.getSourceFiles();
				return [...files, files[0]!];
			}
		});
		run(
			'Program source population provider budget',
			{
				programSourceFiles: () =>
					new Array<ts.SourceFile>(inputs.request.budgets.maxProgramSourceFiles + 1)
			},
			'BUDGET_EXHAUSTED'
		);
		run('missing semantic Program source', {
			programSourceFiles: (session) => {
				const files = session.program.getSourceFiles();
				const replacement = Object.create(files[0]!) as ts.SourceFile;
				Object.defineProperty(replacement, 'fileName', {
					configurable: true,
					value: `${files[0]!.fileName}.missing.d.ts`
				});
				return [replacement, ...files.slice(1)];
			}
		});
		run('Program source content classification', {
			programSourceFiles: (session) => {
				const files = session.program.getSourceFiles();
				const replacement = Object.create(files[0]!) as ts.SourceFile;
				Object.defineProperty(replacement, 'text', {
					configurable: true,
					value: `${files[0]!.text} `
				});
				return [replacement, ...files.slice(1)];
			}
		});
		run('Program and context source population mismatch', {
			programSourceFiles: (session) =>
				session.program
					.getSourceFiles()
					.filter(
						(sourceFile) =>
							session.toLogicalPath(sourceFile.fileName) !==
							inputs.moduleResolutionTrace.importerWitness.logicalPath
					)
		});
		run('non-external root', { isExternalModule: () => false });
		run('missing module symbol', { getSymbolAtLocation: () => undefined });
		run('non-scalar export name', {
			symbolName: (symbol) =>
				symbol.getName() === inputs.request.exportName ? '\ud800' : symbol.getName()
		});
		run('negative SymbolFlags', { symbolFlags: () => -1 });
		run('unrepresented SymbolFlags', { symbolFlags: () => Number.MAX_SAFE_INTEGER });
		run('zero SymbolFlags', { symbolFlags: () => 0 }, 'DERIVATION_MISMATCH');
		run('multi-hop alias', { isAliasSymbol: () => true });
		run('missing alias declaration', { getDeclarations: () => [] });
		run('cyclic alias', { getAliasedSymbol: (_session, symbol) => symbol });
		let symbolNameCalls = 0;
		run('non-scalar alias target name', {
			symbolName: (symbol) => (++symbolNameCalls === 3 ? '\ud800' : symbol.getName())
		});
		symbolNameCalls = 0;
		run('empty terminal name', {
			symbolName: (symbol) => (++symbolNameCalls === 4 ? '' : symbol.getName())
		});
		let declarationCalls = 0;
		run('missing terminal declarations', {
			getDeclarations: (symbol) => (++declarationCalls === 2 ? undefined : symbol.getDeclarations())
		});
		declarationCalls = 0;
		run('duplicate terminal declaration identities', {
			getDeclarations: (symbol) => {
				declarationCalls += 1;
				const declarations = symbol.getDeclarations();
				return declarationCalls === 2 && declarations?.[0] !== undefined
					? [declarations[0], declarations[0]]
					: declarations;
			}
		});
		let foreignDeclaration: ts.Declaration | undefined;
		run('non-context terminal declaration carrier', {
			getDeclarations: (symbol) =>
				symbol.getName() === baseline.terminalSymbol.name && foreignDeclaration !== undefined
					? [foreignDeclaration]
					: symbol.getDeclarations(),
			programSourceFiles: (session) => {
				const files = session.program.getSourceFiles();
				const importer = files.find(
					(sourceFile) =>
						session.toLogicalPath(sourceFile.fileName) ===
						inputs.moduleResolutionTrace.importerWitness.logicalPath
				);
				foreignDeclaration = importer?.statements[0] as ts.Declaration | undefined;
				return files;
			}
		});
		run('nested terminal declaration placement', {
			getDeclarations: (symbol) => {
				const declarations = symbol.getDeclarations();
				if (symbol.getName() !== baseline.terminalSymbol.name || declarations?.[0] === undefined)
					return declarations;
				const original = declarations[0];
				const declaration = Object.create(original) as ts.Declaration;
				Object.defineProperties(declaration, {
					getSourceFile: { configurable: true, value: () => original.getSourceFile() },
					parent: { configurable: true, value: original }
				});
				return [declaration];
			}
		});
		run('unsupported checker declaration kind', {
			getDeclarations: (symbol) => {
				const declarations = symbol.getDeclarations();
				if (symbol.getName() !== baseline.terminalSymbol.name || declarations?.[0] === undefined)
					return declarations;
				const original = declarations[0];
				const declaration = Object.create(original) as ts.Declaration;
				Object.defineProperties(declaration, {
					kind: { configurable: true, value: ts.SyntaxKind.PropertySignature },
					parent: { configurable: true, value: original.getSourceFile() }
				});
				return [declaration];
			}
		});
		const bindingCollisionResult = run('parsed binding-element terminal-name collision', {
			parseCapturedSourceFile: (session, logicalPath) => {
				const parsed = session.parseCapturedSourceFile(logicalPath);
				if (logicalPath !== inputs.moduleResolutionTrace.targetWitness.logicalPath) return parsed;
				const injected = ts.createSourceFile(
					'defensive-binding-collision.d.ts',
					`declare const source: { value: unknown };\nexport const { value: ${baseline.terminalSymbol.name} } = source;\n`,
					parsed.sourceFile.languageVersion,
					true,
					ts.ScriptKind.TS
				);
				const collision = injected.statements.find(
					(statement): statement is ts.VariableStatement =>
						ts.isVariableStatement(statement) &&
						statement.declarationList.declarations.some(
							(declaration) => !ts.isIdentifier(declaration.name)
						)
				)!;
				Object.defineProperty(collision, 'parent', {
					configurable: true,
					value: parsed.sourceFile
				});
				Object.defineProperty(parsed.sourceFile, 'statements', {
					configurable: true,
					value: ts.factory.createNodeArray([...parsed.sourceFile.statements, collision])
				});
				return parsed;
			}
		});
		expect(bindingCollisionResult.issues[0]?.message).toBe(
			'An independently parsed top-level binding collides with the terminal symbol name.'
		);
		let unsupportedDeclarationCalls = 0;
		run('unsupported checker module declaration', {
			getDeclarations: (symbol) => {
				unsupportedDeclarationCalls += 1;
				const declarations = symbol.getDeclarations();
				if (unsupportedDeclarationCalls !== 2 || declarations?.[0] === undefined)
					return declarations;
				const declaration = Object.create(declarations[0]) as ts.ModuleDeclaration;
				Object.defineProperties(declaration, {
					kind: { configurable: true, value: ts.SyntaxKind.ModuleDeclaration },
					name: { configurable: true, value: ts.factory.createStringLiteral('ambient') }
				});
				return [declaration];
			}
		});
		let checkerCensusCalls = 0;
		run('checker terminal declaration census', {
			getDeclarations: (symbol) => {
				checkerCensusCalls += 1;
				const declarations = symbol.getDeclarations();
				return checkerCensusCalls === 2 && declarations !== undefined
					? declarations.map((original) => {
							const declaration = Object.create(original) as ts.Declaration;
							Object.defineProperty(declaration, 'end', {
								configurable: true,
								value: original.end + 1
							});
							return declaration;
						})
					: declarations;
			}
		});
		let checkerRootCensusCalls = 0;
		run('checker root ExportSpecifier census', {
			getDeclarations: (symbol) => {
				checkerRootCensusCalls += 1;
				const declarations = symbol.getDeclarations();
				if (checkerRootCensusCalls !== 1 || declarations?.[0] === undefined) return declarations;
				const declaration = Object.create(declarations[0]) as ts.Declaration;
				Object.defineProperty(declaration, 'end', {
					configurable: true,
					value: declarations[0].end + 1
				});
				return [declaration];
			}
		});
		let inconsistentSourceCalls = 0;
		run('inconsistent artifact Program source identity', {
			getDeclarations: (symbol) => {
				inconsistentSourceCalls += 1;
				const declarations = symbol.getDeclarations();
				if (inconsistentSourceCalls !== 2 || declarations?.[0] === undefined) return declarations;
				const source = declarations[0].getSourceFile();
				const duplicate = ts.createSourceFile(
					source.fileName,
					source.text,
					source.languageVersion,
					true,
					ts.ScriptKind.TS
				);
				return duplicate.statements.filter(
					(node) => ts.isInterfaceDeclaration(node) || ts.isModuleDeclaration(node)
				) as readonly ts.Declaration[];
			}
		});
		run('compiler-options digest', {
			compilerOptions: (session) => ({
				...session.program.getCompilerOptions(),
				noEmit: !session.program.getCompilerOptions().noEmit
			})
		});
		run(
			'syntactic diagnostic budget',
			{
				syntacticDiagnostics: () =>
					Array.from({ length: inputs.request.budgets.maxDiagnostics + 1 }, () => ({
						category: ts.DiagnosticCategory.Error,
						code: 2300,
						file: undefined,
						length: undefined,
						messageText: 'defensive provider fault',
						start: undefined
					}))
			},
			'BUDGET_EXHAUSTED'
		);
		run('parsed artifact content witness', {
			parseCapturedSourceFile: (session, logicalPath) => {
				const parsed = session.parseCapturedSourceFile(logicalPath);
				return { ...parsed, contentBytes: parsed.contentBytes + 1 };
			}
		});
		run('materialized session evidence', {
			finalizeSession: (session) => {
				const evidence = session.finalize();
				return { ...evidence, programSourceFiles: evidence.programSourceFiles + 1 };
			}
		});
		run(
			'safe-integer evidence accounting overflow',
			{
				finalizeSession: (session) => ({
					...session.finalize(),
					programCompilerHostCallbacks: Number.MAX_SAFE_INTEGER
				})
			},
			'BUDGET_EXHAUSTED'
		);
		run(
			'nested array evidence clone',
			{
				finalizeSession: (session) => {
					const evidence = session.finalize();
					return {
						...evidence,
						inputRecords: evidence.inputRecords.map((record, index) =>
							index === 0
								? {
										...record,
										observation: {
											...record.observation,
											defensiveProviderArray: [{ nested: true }]
										} as never
									}
								: record
						)
					};
				}
			},
			'DERIVATION_MISMATCH'
		);
		run('context input population evidence', {
			finalizeSession: (session) => {
				const evidence = session.finalize();
				return { ...evidence, contextInputIds: evidence.contextInputIds.slice(1) };
			}
		});
		run('context input identity evidence', {
			finalizeSession: (session) => {
				const evidence = session.finalize();
				return {
					...evidence,
					contextInputIds: evidence.contextInputIds.map((id, index) =>
						index === 0 ? (`${id}-fault` as typeof id) : id
					)
				};
			}
		});
		run(
			'compiler input record provider budget',
			{
				finalizeSession: (session) => ({
					...session.finalize(),
					inputRecords: new Array(inputs.request.budgets.maxInputRecords + 1) as never
				})
			},
			'BUDGET_EXHAUSTED'
		);
		run(
			'attributed session budget',
			{
				finalizeSession: (session) => ({
					...session.finalize(),
					attributedInputRecords: inputs.request.budgets.maxCompilerInputAttempts + 1
				})
			},
			'BUDGET_EXHAUSTED'
		);
		run('non-dense session evidence', {
			finalizeSession: (session) => {
				const evidence = session.finalize();
				return {
					...evidence,
					inputRecords: evidence.inputRecords.map((record, index) =>
						index === 0 ? { ...record, ordinal: 1 } : record
					)
				};
			}
		});
		run('non-prefix artifact session evidence', {
			finalizeSession: (session) => {
				const evidence = session.finalize();
				return {
					...evidence,
					inputRecords: evidence.inputRecords.map((record, index) =>
						index === 0 ? { ...record, stage: 'DECLARATION_ARTIFACT_PARSE' as const } : record
					)
				};
			}
		});
		run('callback population session evidence', {
			finalizeSession: (session) => {
				const evidence = session.finalize();
				return {
					...evidence,
					compilerHostCallbacks: evidence.compilerHostCallbacks + 1,
					programCompilerHostCallbacks: evidence.programCompilerHostCallbacks + 1
				};
			}
		});
		run('Program source capture witness', {
			finalizeSession: (session) => {
				const evidence = session.finalize();
				return {
					...evidence,
					inputRecords: evidence.inputRecords.map((record) =>
						record.stage !== 'DECLARATION_ARTIFACT_PARSE' &&
						record.observation.operation === 'READ_FILE' &&
						record.observation.result === 'PRESENT'
							? {
									...record,
									observation: {
										...record.observation,
										contentSha256: '0'.repeat(64)
									}
								}
							: record
					)
				};
			}
		});
		run('progressive traversal session evidence', {
			finalizeSession: (session) => {
				const evidence = session.finalize();
				const duplicate = evidence.inputRecords.find(
					(record) =>
						record.stage !== 'DECLARATION_ARTIFACT_PARSE' &&
						record.observation.operation !== 'READ_FILE'
				)!;
				const inputRecords = [duplicate, ...evidence.inputRecords].map((record, ordinal) => ({
					...record,
					ordinal
				}));
				return {
					...evidence,
					compilerHostCallbacks: evidence.compilerHostCallbacks + 1,
					inputRecords,
					programCompilerHostCallbacks: evidence.programCompilerHostCallbacks + 1
				};
			}
		});
		run('artifact input-record witness', {
			parseCapturedSourceFile: (session, logicalPath) => ({
				...session.parseCapturedSourceFile(logicalPath),
				inputRecordOrdinal: 0
			})
		});
		run('unexpected session provider failure', {
			createSession: () => {
				throw new Error('defensive provider fault');
			}
		});
		const expectProviderDeadlinePrecedence = (
			provider: (crossDeadline: () => void) => DeclarationContextAnalysisValidationProviderOverrides
		): void => {
			let deadlineCrossed = false;
			expectIssue(
				validateDeclarationContextAnalysisWithProviderForTesting(
					baseline,
					inputs,
					{
						...provider(() => {
							deadlineCrossed = true;
						}),
						monotonicNow: () => (deadlineCrossed ? 2 : 0)
					},
					{ maxDurationMs: 1 }
				),
				'BUDGET_EXHAUSTED'
			);
		};
		expectProviderDeadlinePrecedence((crossDeadline) => ({
			getDeclarations: () => {
				crossDeadline();
				return [];
			}
		}));
		expectProviderDeadlinePrecedence((crossDeadline) => ({
			sessionIdentity: (session) => {
				crossDeadline();
				return {
					configPath: `${session.configPath}.fault`,
					semanticProgramId: session.semanticProgramId,
					semanticProjectId: session.semanticProjectId
				};
			}
		}));
		expectProviderDeadlinePrecedence((crossDeadline) => ({
			isExternalModule: () => {
				crossDeadline();
				return false;
			}
		}));
		expectProviderDeadlinePrecedence((crossDeadline) => ({
			symbolName: () => {
				crossDeadline();
				return '\ud800';
			}
		}));
		expectProviderDeadlinePrecedence((crossDeadline) => ({
			isAliasSymbol: () => {
				crossDeadline();
				return false;
			}
		}));
		expectProviderDeadlinePrecedence((crossDeadline) => ({
			symbolFlags: () => {
				crossDeadline();
				return -1;
			}
		}));
		expectProviderDeadlinePrecedence((crossDeadline) => ({
			getDeclarations: (symbol) => {
				const declarations = symbol.getDeclarations();
				if (symbol.getName() !== inputs.request.exportName || declarations?.[0] === undefined)
					return declarations;
				const original = declarations[0];
				const declaration = Object.create(original) as ts.Declaration;
				Object.defineProperty(declaration, 'getSourceFile', {
					configurable: true,
					value: () => {
						crossDeadline();
						return original.getSourceFile();
					}
				});
				return [declaration];
			}
		}));
		expectProviderDeadlinePrecedence((crossDeadline) => ({
			getDeclarations: (symbol) => {
				const declarations = symbol.getDeclarations();
				const original = declarations?.[0];
				if (
					symbol.getName() !== inputs.request.exportName ||
					original === undefined ||
					!ts.isExportSpecifier(original)
				)
					return declarations;
				const name = Object.create(original.name) as ts.Identifier;
				Object.defineProperty(name, 'getStart', {
					configurable: true,
					value: () => {
						crossDeadline();
						return original.name.getStart(original.getSourceFile());
					}
				});
				const declaration = Object.create(original) as ts.ExportSpecifier;
				Object.defineProperty(declaration, 'name', { configurable: true, value: name });
				return [declaration];
			}
		}));
		vi.spyOn(performance, 'now').mockImplementation(() =>
			new Error().stack?.includes('assertValidationDeadline') === true ? 2 : 0
		);
		expectIssue(
			validateDeclarationContextAnalysisWithProviderForTesting(
				baseline,
				inputs,
				{},
				{ maxDurationMs: 1 }
			),
			'BUDGET_EXHAUSTED'
		);
		vi.restoreAllMocks();
		expect(validateDeclarationContextAnalysis(baseline, inputs)).toEqual({
			issues: [],
			state: 'VALID'
		});
		expect('validateDeclarationContextAnalysisWithProviderForTesting' in csaaPublicApi).toBe(false);
	}, 300_000);

	function validateFixture(
		options: DeclarationContextAnalysisFixtureOptions,
		budgetOverrides: Partial<DeclarationContextAnalysisBuildInputs['request']['budgets']> = {}
	): ReturnType<typeof validateDeclarationContextAnalysis> {
		const selectedFixture = createDeclarationContextAnalysisFixture(options);
		try {
			const selectedInputs = declarationContextAnalysisInputs(selectedFixture, {}, budgetOverrides);
			const outcome = buildDeclarationContextAnalysis(selectedInputs);
			if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
			return validateDeclarationContextAnalysis(outcome.analysis, selectedInputs);
		} finally {
			selectedFixture.cleanup();
		}
	}

	it('validates direct, extension, and declaration-kind public compiler variants', () => {
		expect(
			validateFixture(
				{
					declarationState: 'SINGLE',
					targetDeclarationText: 'export interface SelectedContract { readonly direct: true; }\n'
				},
				{ maxAliasHops: 0 }
			)
		).toEqual({ issues: [], state: 'VALID' });
		for (const targetDeclarationExtension of ['d.cts', 'd.mts'] as const)
			expect(validateFixture({ declarationState: 'SINGLE', targetDeclarationExtension })).toEqual({
				issues: [],
				state: 'VALID'
			});
		for (const targetDeclarationText of [
			'declare class FixtureContract {}\nexport { FixtureContract as SelectedContract };\n',
			'declare enum FixtureContract { Value }\nexport { FixtureContract as SelectedContract };\n',
			'declare function FixtureContract(): void;\nexport { FixtureContract as SelectedContract };\n',
			'type FixtureContract = string;\nexport { FixtureContract as SelectedContract };\n',
			"declare const FixtureContract: 'value';\nexport { FixtureContract as SelectedContract };\n"
		])
			expect(validateFixture({ declarationState: 'SINGLE', targetDeclarationText })).toEqual({
				issues: [],
				state: 'VALID'
			});
	}, 300_000);

	it('refuses default exports that cannot reproduce the supported named declaration profile', () => {
		for (const targetDeclarationText of [
			'export default 1;\n',
			'export default class {}\n',
			'export default class NamedDefault {}\n'
		]) {
			const defaultFixture = createDeclarationContextAnalysisFixture({
				declarationState: 'SINGLE',
				targetDeclarationText
			});
			try {
				expectIssue(
					validateDeclarationContextAnalysis(
						baseline,
						declarationContextAnalysisInputs(defaultFixture, { exportName: 'default' })
					),
					'INPUT_INVALID'
				);
			} finally {
				defaultFixture.cleanup();
			}
		}
	}, 180_000);

	it('independently refuses incomplete terminal and root export-binding syntax censuses', () => {
		const invalidTexts = [
			'export type SelectedContract = string;\nexport type SelectedContract = number;\n',
			'interface A {}\ninterface B {}\nexport { A as SelectedContract };\nexport { B as SelectedContract };\n',
			'interface A {}\nexport { A as SelectedContract };\nexport { A as SelectedContract };\n',
			'interface A {}\ninterface B {}\nexport { A as SelectedContract, B as SelectedContract };\n',
			'interface SelectedContract {}\nexport { SelectedContract };\n',
			"export { SelectedContract } from './index.js';\n",
			"export interface A {}\nexport interface SelectedContract {}\nimport { A as SelectedContract } from './index.js';\n",
			"export interface SelectedContract {}\nimport SelectedContract from './index.js';\n",
			"export interface SelectedContract {}\nimport * as SelectedContract from './index.js';\n",
			"export interface SelectedContract {}\nimport SelectedContract = require('./index.js');\n",
			'export interface SelectedContract {}\ndeclare const source: { value: unknown };\nexport const { value: SelectedContract } = source;\n',
			'interface FixtureContract {}\ndeclare const source: { value: unknown };\nexport const { value: FixtureContract } = source;\nexport { FixtureContract as SelectedContract };\n',
			"export interface A {}\nexport interface B {}\nimport { A as Local } from './index.js';\nimport { B as Local } from './index.js';\nexport { Local as SelectedContract };\n",
			'declare namespace Container { interface FixtureContract {} }\nexport import SelectedContract = Container.FixtureContract;\n',
			"declare module 'ambient-x' { interface X {} }\ninterface FixtureContract {}\nexport { FixtureContract as SelectedContract };\n",
			"declare module './internal.js' { export interface FixtureContract {} }\nexport { FixtureContract as SelectedContract } from './internal.js';\n",
			'declare global { interface GlobalX {} }\ninterface FixtureContract {}\nexport { FixtureContract as SelectedContract };\n',
			'export as namespace AmbientGlobal;\ninterface FixtureContract {}\nexport { FixtureContract as SelectedContract };\n',
			'/// <reference no-default-lib="true"/>\ninterface FixtureContract {}\nexport { FixtureContract as SelectedContract };\n',
			'/// <reference path="./index.d.ts" />\ninterface FixtureContract {}\nexport { FixtureContract as SelectedContract };\n',
			'/// <reference types="@fixture/module-target" />\ninterface FixtureContract {}\nexport { FixtureContract as SelectedContract };\n',
			'/// <reference lib="esnext" />\ninterface FixtureContract {}\nexport { FixtureContract as SelectedContract };\n',
			'/// <amd-module name="fixture-amd" />\ninterface FixtureContract {}\nexport { FixtureContract as SelectedContract };\n',
			'/// <amd-dependency path="./dependency" name="dependency" />\ninterface FixtureContract {}\nexport { FixtureContract as SelectedContract };\n',
			'interface FixtureContract { broken: ; }\nexport { FixtureContract as SelectedContract };\n'
		] as const;
		for (const targetDeclarationText of invalidTexts) {
			const invalidFixture = createDeclarationContextAnalysisFixture({
				declarationState: 'SINGLE',
				targetDeclarationText
			});
			try {
				expectIssue(
					validateDeclarationContextAnalysis(
						baseline,
						declarationContextAnalysisInputs(invalidFixture)
					),
					'INPUT_INVALID'
				);
			} finally {
				invalidFixture.cleanup();
			}
		}
	}, 300_000);

	it('cumulatively caps independently observed Program syntactic diagnostics', () => {
		const diagnosticFixture = createDeclarationContextAnalysisFixture({
			declarationState: 'SINGLE',
			targetDeclarationText:
				'interface FixtureContract { first: ; second: ; }\nexport { FixtureContract as SelectedContract };\n'
		});
		try {
			expectIssue(
				validateDeclarationContextAnalysis(
					baseline,
					declarationContextAnalysisInputs(diagnosticFixture, {}, { maxDiagnostics: 1 })
				),
				'BUDGET_EXHAUSTED'
			);
		} finally {
			diagnosticFixture.cleanup();
		}
	}, 120_000);

	it('refuses a missing exact export and a complete export census over budget', () => {
		expectIssue(
			validateDeclarationContextAnalysis(
				baseline,
				withRequest(inputs, { ...inputs.request, exportName: 'MissingContract' })
			),
			'INPUT_INVALID'
		);
		const extraExportFixture = createDeclarationContextAnalysisFixture({
			declarationState: 'SINGLE',
			targetDeclarationText:
				'export declare const Other: 1;\ninterface FixtureContract {}\nexport { FixtureContract as SelectedContract };\n'
		});
		try {
			expectIssue(
				validateDeclarationContextAnalysis(
					baseline,
					declarationContextAnalysisInputs(extraExportFixture, {}, { maxExportSymbols: 1 })
				),
				'BUDGET_EXHAUSTED'
			);
		} finally {
			extraExportFixture.cleanup();
		}
	}, 180_000);

	it('refuses an off-root star-reexport terminal before and after progressive artifact insertion', () => {
		const starFixture = createDeclarationContextAnalysisFixture({
			declarationState: 'SINGLE',
			targetDeclarationText: "export * from './terminal.js';\n",
			targetSiblingDeclarationText: 'export interface SelectedContract {}\n'
		});
		try {
			const starInputs = declarationContextAnalysisInputs(starFixture);
			expectIssue(
				validateDeclarationContextAnalysis(baseline, withBudgets(starInputs, { maxArtifacts: 1 })),
				'BUDGET_EXHAUSTED'
			);
			expectIssue(validateDeclarationContextAnalysis(baseline, starInputs), 'INPUT_INVALID');

			let rootSourceFile: ts.SourceFile | undefined;
			expectIssue(
				validateDeclarationContextAnalysisWithProviderForTesting(baseline, starInputs, {
					getDeclarations: (symbol) => {
						const declarations = symbol.getDeclarations();
						return declarations === undefined || rootSourceFile?.statements[0] === undefined
							? declarations
							: [declarations[0]!, rootSourceFile.statements[0] as unknown as ts.Declaration];
					},
					getSymbolAtLocation: (session, node) => {
						rootSourceFile = node.getSourceFile();
						return session.checker.getSymbolAtLocation(node);
					}
				}),
				'INPUT_INVALID'
			);
		} finally {
			starFixture.cleanup();
		}
	}, 180_000);
});
