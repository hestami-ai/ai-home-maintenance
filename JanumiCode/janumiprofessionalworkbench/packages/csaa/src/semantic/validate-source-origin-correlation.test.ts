import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type {
	SourceOriginCorrelationBudgets,
	SourceOriginCorrelationBuildInputs,
	SourceOriginCorrelationSnapshot,
	SourceOriginCorrelationValidationIssue
} from '../contracts/source-origin-correlation.js';
import { sha256 } from '../inventory/canonical.js';
import {
	CompilerProjectDeclarationEmissionError,
	emitCompilerProjectDeclaration,
	type CompilerProjectDeclarationEmission,
	type CompilerProjectDeclarationEmissionInputs,
	type CompilerProjectDeclarationEmissionLimits,
	type CompilerProjectDeclarationEmissionRuntimeOptions
} from '../providers/typescript/compiler-project-declaration-emission.js';
import { buildSourceOriginCorrelation } from './build-source-origin-correlation.js';
import {
	createSourceOriginCorrelationFixture,
	sourceOriginCorrelationInputs,
	type SourceOriginCorrelationFixture
} from './source-origin-correlation-fixture.test-support.js';
import {
	sourceOriginCorrelationSparseAuthoredLineBoundsForTesting,
	validateConstructedSourceOriginCorrelation,
	validateSourceOriginCorrelation,
	validateSourceOriginCorrelationWithProviderForTesting
} from './validate-source-origin-correlation.js';

function expectIssue(
	result: ReturnType<typeof validateSourceOriginCorrelation>,
	code: SourceOriginCorrelationValidationIssue['code']
): void {
	expect(result.state).not.toBe('VALID');
	expect(result.issues[0]?.code).toBe(code);
}

function withBudgets(
	inputs: SourceOriginCorrelationBuildInputs,
	overrides: Partial<SourceOriginCorrelationBudgets>
): SourceOriginCorrelationBuildInputs {
	return {
		...inputs,
		request: {
			...inputs.request,
			budgets: { ...inputs.request.budgets, ...overrides }
		}
	};
}

function providerMutation(
	mutate: (emission: CompilerProjectDeclarationEmission) => unknown
): typeof emitCompilerProjectDeclaration {
	return ((...parameters: Parameters<typeof emitCompilerProjectDeclaration>) => {
		const emission = structuredClone(emitCompilerProjectDeclaration(...parameters));
		return mutate(emission);
	}) as typeof emitCompilerProjectDeclaration;
}

describe('validateSourceOriginCorrelation', () => {
	let baseline!: SourceOriginCorrelationSnapshot;
	let fixture!: SourceOriginCorrelationFixture;
	let inputs!: SourceOriginCorrelationBuildInputs;
	let sourceMapJson!: Record<string, unknown>;
	const encoder = new TextEncoder();

	beforeAll(() => {
		fixture = createSourceOriginCorrelationFixture();
		inputs = sourceOriginCorrelationInputs(fixture);
		const outcome = buildSourceOriginCorrelation(inputs);
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		baseline = outcome.analysis;
		sourceMapJson = JSON.parse(new TextDecoder().decode(fixture.declarationMapBytes)) as Record<
			string,
			unknown
		>;
	}, 120_000);

	afterAll(() => fixture.cleanup());

	const withMapText = (
		text: string,
		budgetOverrides: Partial<SourceOriginCorrelationBudgets> = {}
	): SourceOriginCorrelationBuildInputs => {
		const bytes = encoder.encode(text);
		const budgeted = withBudgets(inputs, budgetOverrides);
		return {
			...budgeted,
			declarationMapBytes: bytes,
			request: {
				...budgeted.request,
				declarationMap: {
					...budgeted.request.declarationMap,
					contentBytes: bytes.byteLength,
					contentSha256: sha256(bytes)
				}
			}
		};
	};

	const withMap = (
		overrides: Record<string, unknown>,
		budgetOverrides: Partial<SourceOriginCorrelationBudgets> = {}
	): SourceOriginCorrelationBuildInputs =>
		withMapText(JSON.stringify({ ...sourceMapJson, ...overrides }), budgetOverrides);

	const withTargetBytes = (
		bytes: Uint8Array,
		budgetOverrides: Partial<SourceOriginCorrelationBudgets> = {}
	): SourceOriginCorrelationBuildInputs => {
		const budgeted = withBudgets(inputs, budgetOverrides);
		return {
			...budgeted,
			request: {
				...budgeted.request,
				targetDeclaration: {
					...budgeted.request.targetDeclaration,
					contentBytes: bytes.byteLength,
					contentSha256: sha256(bytes)
				}
			},
			targetDeclarationBytes: bytes
		};
	};

	const withTargetTextFrom = (
		selectedInputs: SourceOriginCorrelationBuildInputs,
		text: string
	): SourceOriginCorrelationBuildInputs => {
		const bytes = encoder.encode(text);
		return {
			...selectedInputs,
			request: {
				...selectedInputs.request,
				targetDeclaration: {
					...selectedInputs.request.targetDeclaration,
					contentBytes: bytes.byteLength,
					contentSha256: sha256(bytes)
				}
			},
			targetDeclarationBytes: bytes
		};
	};

	const providerForCaptures = (
		selectedInputs: SourceOriginCorrelationBuildInputs
	): typeof emitCompilerProjectDeclaration =>
		((
			providerInputs: CompilerProjectDeclarationEmissionInputs,
			providerLimits: CompilerProjectDeclarationEmissionLimits,
			runtime?: CompilerProjectDeclarationEmissionRuntimeOptions
		) => {
			const baselineTargetText = new TextDecoder().decode(inputs.targetDeclarationBytes);
			const baselineMapText = new TextDecoder().decode(inputs.declarationMapBytes);
			const emission = structuredClone(
				emitCompilerProjectDeclaration(
					providerInputs,
					{
						...providerLimits,
						maxOutputBytes: Math.max(
							providerLimits.maxOutputBytes,
							inputs.targetDeclarationBytes.byteLength + inputs.declarationMapBytes.byteLength
						),
						maxOutputStringCharacters: Math.max(
							providerLimits.maxOutputStringCharacters,
							baselineTargetText.length + baselineMapText.length
						)
					},
					runtime
				)
			);
			const targetText = new TextDecoder().decode(selectedInputs.targetDeclarationBytes);
			const mapText = new TextDecoder().decode(selectedInputs.declarationMapBytes);
			const outputs = emission.outputs.map((output) => {
				const content = output.kind === 'DECLARATION' ? targetText : mapText;
				const bytes = encoder.encode(content);
				return {
					...output,
					bytes: bytes.byteLength,
					content,
					contentSha256: sha256(bytes),
					logicalPath:
						output.kind === 'DECLARATION'
							? selectedInputs.request.targetDeclaration.logicalPath
							: selectedInputs.request.declarationMap.logicalPath,
					textLength: content.length
				};
			});
			return {
				...emission,
				emissionWitness: { ...emission.emissionWitness, outputs },
				outputs
			};
		}) as typeof emitCompilerProjectDeclaration;

	const constructed = (
		candidate: unknown,
		selectedInputs: SourceOriginCorrelationBuildInputs = inputs
	): ReturnType<typeof validateSourceOriginCorrelation> =>
		validateConstructedSourceOriginCorrelation(candidate, selectedInputs, baseline.inputDigest);

	it('independently replays the real caller captures through the public and constructed entries', () => {
		expect(validateSourceOriginCorrelation(baseline, inputs)).toEqual({
			issues: [],
			state: 'VALID'
		});
		expect(
			validateConstructedSourceOriginCorrelation(baseline, inputs, baseline.inputDigest)
		).toEqual({ issues: [], state: 'VALID' });
	});

	it('rejects candidate content and identity mutations', () => {
		expectIssue(
			validateSourceOriginCorrelation({ ...baseline, contentDigest: '0'.repeat(64) }, inputs),
			'CONTENT_DIGEST_MISMATCH'
		);
		expectIssue(
			validateSourceOriginCorrelation(
				{ ...baseline, id: 'source-origin-correlation-invalid' },
				inputs
			),
			'IDENTITY_MISMATCH'
		);
		expectIssue(
			validateSourceOriginCorrelation({ ...baseline, method: 'x'.repeat(2_048) }, inputs),
			'DERIVATION_MISMATCH'
		);
	});

	it('closes options, call arity, input shells, and fixed request constraints', () => {
		const publicEntry = validateSourceOriginCorrelation as unknown as (
			...parameters: readonly unknown[]
		) => ReturnType<typeof validateSourceOriginCorrelation>;
		expectIssue(publicEntry(), 'SHAPE_INVALID');
		expectIssue(publicEntry(baseline), 'SHAPE_INVALID');
		expectIssue(publicEntry(baseline, inputs, {}, 'extra'), 'SHAPE_INVALID');

		for (const options of [
			null,
			{ maxDepth: 0 },
			{ maxIssues: 100_001 },
			{ unexpected: 1 },
			{
				maxDepth: 1,
				maxDurationMs: 1,
				maxInputRecords: 1,
				maxInputStringCharacters: 1,
				maxIssues: 1,
				maxRecords: 1,
				maxStringCharacters: 1,
				unexpected: 1
			}
		] as const)
			expectIssue(
				validateSourceOriginCorrelation(baseline, inputs, options as never),
				'SHAPE_INVALID'
			);

		expectIssue(constructed(baseline, null as never), 'INPUT_INVALID');
		expectIssue(constructed(baseline, { ...inputs, unexpected: true } as never), 'INPUT_INVALID');
		expectIssue(constructed(baseline, { ...inputs, request: [] } as never), 'INPUT_INVALID');
		expectIssue(
			constructed(baseline, { ...inputs, semanticSnapshot: [] } as never),
			'INPUT_INVALID'
		);

		const requestCases: Array<SourceOriginCorrelationBuildInputs['request']> = [
			{ ...inputs.request, unexpected: true } as never,
			{
				...inputs.request,
				budgets: { ...inputs.request.budgets, maxDecodedMapSegments: 0 }
			},
			{ ...inputs.request, budgets: { ...inputs.request.budgets, maxOutputRecords: 7 } },
			{ ...inputs.request, schemaVersion: 'invalid' as never },
			{ ...inputs.request, subjectId: 'invalid' },
			{ ...inputs.request, semanticSourceId: '' as never },
			{ ...inputs.request, semanticSourceId: '\ud800' as never },
			{ ...inputs.request, semanticSourceId: '\udc00' as never },
			{
				...inputs.request,
				targetDeclaration: { ...inputs.request.targetDeclaration, contentBytes: 0 }
			},
			{
				...inputs.request,
				targetDeclaration: { ...inputs.request.targetDeclaration, logicalPath: '/absolute.d.ts' }
			},
			{
				...inputs.request,
				declarationMap: { ...inputs.request.declarationMap, logicalPath: 'dist/value.js.map' },
				targetDeclaration: { ...inputs.request.targetDeclaration, logicalPath: 'dist/value.js' }
			}
		];
		for (const request of requestCases)
			expectIssue(constructed(baseline, { ...inputs, request }), 'INPUT_INVALID');
	});

	it('hard-gates candidate populations before deep traversal', () => {
		const cases: Array<readonly [unknown, SourceOriginCorrelationValidationIssue['code']]> = [
			[{ ...baseline, artifacts: null }, 'SHAPE_INVALID'],
			[{ ...baseline, artifacts: baseline.artifacts.slice(0, 2) }, 'POPULATION_MISMATCH'],
			[{ ...baseline, segments: [] }, 'BUDGET_EXHAUSTED'],
			[{ ...baseline, locations: baseline.locations.slice(1) }, 'POPULATION_MISMATCH'],
			[{ ...baseline, correlations: baseline.correlations.slice(1) }, 'POPULATION_MISMATCH'],
			[{ ...baseline, unmappedGeneratedLines: [] }, 'POPULATION_MISMATCH'],
			[{ ...baseline, sourceMap: null }, 'SHAPE_INVALID'],
			[
				{
					...baseline,
					sourceMap: { ...baseline.sourceMap, segmentIds: baseline.sourceMap.segmentIds.slice(1) }
				},
				'POPULATION_MISMATCH'
			],
			[
				{
					...baseline,
					sourceMap: { ...baseline.sourceMap, unmappedGeneratedLineIds: [] }
				},
				'POPULATION_MISMATCH'
			]
		];
		for (const [candidate, code] of cases) expectIssue(constructed(candidate), code);
		expectIssue(
			constructed(
				baseline,
				withBudgets(inputs, { maxOutputRecords: baseline.coverage.outputRecords - 1 })
			),
			'BUDGET_EXHAUSTED'
		);
	});

	it('traverses hostile candidate data lazily with descriptor-only checks', () => {
		const mutateArtifact = (mutate: (artifact: Record<PropertyKey, unknown>) => void): unknown => {
			const candidate = structuredClone(baseline) as unknown as Record<string, unknown>;
			const artifacts = candidate.artifacts as Array<Record<PropertyKey, unknown>>;
			mutate(artifacts[0]!);
			return candidate;
		};

		const accessor = mutateArtifact((artifact) => {
			Object.defineProperty(artifact, 'id', {
				enumerable: true,
				get: () => baseline.artifacts[0]!.id
			});
		});
		const cyclic = mutateArtifact((artifact) => {
			artifact.self = artifact;
		});
		const symbolKey = mutateArtifact((artifact) => {
			artifact[Symbol('hostile')] = true;
		});
		const scalarKey = mutateArtifact((artifact) => {
			artifact['\ud800'] = true;
		});
		const nonData = mutateArtifact((artifact) => {
			artifact.logicalPath = () => 'not data';
		});
		const loneSurrogate = mutateArtifact((artifact) => {
			artifact.logicalPath = '\ud800';
		});
		const nonordinary = mutateArtifact((artifact) => {
			Object.setPrototypeOf(artifact, { hostile: true });
		});
		const proxied = structuredClone(baseline) as unknown as Record<string, unknown>;
		const proxiedArtifacts = proxied.artifacts as Array<Record<PropertyKey, unknown>>;
		proxiedArtifacts[0] = new Proxy(proxiedArtifacts[0]!, {});
		const arrayExtraProperty = structuredClone(baseline) as unknown as Record<string, unknown>;
		Object.defineProperty(arrayExtraProperty.artifacts, 'extra', {
			enumerable: true,
			value: true
		});
		const arrayUnsafeIndex = structuredClone(baseline) as unknown as Record<string, unknown>;
		Object.defineProperty(arrayUnsafeIndex.artifacts, '9007199254740992', {
			enumerable: true,
			value: true
		});

		for (const candidate of [
			accessor,
			cyclic,
			symbolKey,
			scalarKey,
			nonData,
			loneSurrogate,
			nonordinary,
			proxied,
			arrayExtraProperty,
			arrayUnsafeIndex
		])
			expectIssue(constructed(candidate), 'SHAPE_INVALID');

		const sparse = structuredClone(baseline) as unknown as Record<string, unknown>;
		delete (sparse.artifacts as unknown[])[1];
		expectIssue(constructed(sparse), 'SHAPE_INVALID');
		expectIssue(
			validateConstructedSourceOriginCorrelation(baseline, inputs, baseline.inputDigest, {
				maxDepth: 1
			}),
			'BUDGET_EXHAUSTED'
		);
		expectIssue(
			validateConstructedSourceOriginCorrelation(baseline, inputs, baseline.inputDigest, {
				maxRecords: 1
			}),
			'BUDGET_EXHAUSTED'
		);
		expectIssue(
			validateConstructedSourceOriginCorrelation(baseline, inputs, baseline.inputDigest, {
				maxStringCharacters: 1
			}),
			'BUDGET_EXHAUSTED'
		);
	});

	it('copies and decodes caller captures under hard byte and text ceilings', () => {
		class Uint8Subclass extends Uint8Array {}
		class ArrayBufferSubclass extends ArrayBuffer {}
		const subclassBackedCapture = new Uint8Array(
			new ArrayBufferSubclass(fixture.targetDeclarationBytes.byteLength)
		);
		subclassBackedCapture.set(fixture.targetDeclarationBytes);
		for (const targetDeclarationBytes of [
			'not bytes',
			new Uint8Subclass(fixture.targetDeclarationBytes),
			new Proxy(fixture.targetDeclarationBytes, {}),
			new Uint8Array(new SharedArrayBuffer(fixture.targetDeclarationBytes.byteLength)),
			subclassBackedCapture
		])
			expectIssue(
				constructed(baseline, { ...inputs, targetDeclarationBytes } as never),
				'INPUT_INVALID'
			);

		let proxyCallbacks = 0;
		const trappedCapture = new Proxy(fixture.targetDeclarationBytes, {
			get() {
				proxyCallbacks += 1;
				throw new Error('capture property access must not occur');
			},
			getPrototypeOf() {
				proxyCallbacks += 1;
				throw new Error('capture prototype access must not occur');
			}
		});
		expectIssue(
			constructed(baseline, { ...inputs, targetDeclarationBytes: trappedCapture }),
			'INPUT_INVALID'
		);
		expect(proxyCallbacks).toBe(0);

		const shadowedCapture = fixture.targetDeclarationBytes.slice();
		let shadowCallbacks = 0;
		for (const key of ['buffer', 'byteLength', 'byteOffset'] as const)
			Object.defineProperty(shadowedCapture, key, {
				configurable: true,
				get() {
					shadowCallbacks += 1;
					throw new Error(`capture ${key} getter must not occur`);
				}
			});
		Object.defineProperty(shadowedCapture, 'subarray', {
			configurable: true,
			value() {
				shadowCallbacks += 1;
				throw new Error('capture subarray override must not occur');
			}
		});
		expect(
			validateSourceOriginCorrelation(baseline, {
				...inputs,
				targetDeclarationBytes: shadowedCapture
			})
		).toEqual({ issues: [], state: 'VALID' });
		expect(shadowCallbacks).toBe(0);

		const oversized = new Uint8Array(16 * 1024 * 1024 + 1);
		expectIssue(
			constructed(baseline, { ...inputs, targetDeclarationBytes: oversized }),
			'BUDGET_EXHAUSTED'
		);
		const targetAtHalfCombinedHardCeiling = new Uint8Array(8 * 1024 * 1024);
		const mapBeyondHalfCombinedHardCeiling = new Uint8Array(8 * 1024 * 1024 + 1);
		const combinedCaptureBytes =
			targetAtHalfCombinedHardCeiling.byteLength + mapBeyondHalfCombinedHardCeiling.byteLength;
		const combinedOversizedInputs: SourceOriginCorrelationBuildInputs = {
			...inputs,
			declarationMapBytes: mapBeyondHalfCombinedHardCeiling,
			request: {
				...inputs.request,
				budgets: {
					...inputs.request.budgets,
					maxCallerCaptureBytes: combinedCaptureBytes,
					maxProgramReadBytes: combinedCaptureBytes,
					maxReadBytes: combinedCaptureBytes
				},
				declarationMap: {
					...inputs.request.declarationMap,
					contentBytes: mapBeyondHalfCombinedHardCeiling.byteLength,
					contentSha256: sha256(mapBeyondHalfCombinedHardCeiling)
				},
				targetDeclaration: {
					...inputs.request.targetDeclaration,
					contentBytes: targetAtHalfCombinedHardCeiling.byteLength,
					contentSha256: sha256(targetAtHalfCombinedHardCeiling)
				}
			},
			targetDeclarationBytes: targetAtHalfCombinedHardCeiling
		};
		expectIssue(
			validateSourceOriginCorrelation(baseline, combinedOversizedInputs),
			'BUDGET_EXHAUSTED'
		);
		expectIssue(constructed(baseline, withTargetBytes(new Uint8Array([0xff]))), 'INPUT_INVALID');
		expectIssue(
			constructed(baseline, withTargetBytes(new Uint8Array([0xef, 0xbb, 0xbf, 0x78]))),
			'INPUT_INVALID'
		);
		expectIssue(
			constructed(baseline, withBudgets(inputs, { maxEmitStringCharacters: 1 })),
			'BUDGET_EXHAUSTED'
		);
		const wrongBytes = fixture.targetDeclarationBytes.slice();
		wrongBytes[0] = wrongBytes[0]! ^ 1;
		expectIssue(
			constructed(baseline, { ...inputs, targetDeclarationBytes: wrongBytes }),
			'INPUT_INVALID'
		);
	});

	it('retains sparse authored bounds for requested lines in newline-dense UTF-16 text', () => {
		const newlineLines = 1_000_005;
		const text = `${'\n'.repeat(newlineLines)}a\r\nb\rc`;
		const bounds = sourceOriginCorrelationSparseAuthoredLineBoundsForTesting(text, [
			0,
			newlineLines - 1,
			newlineLines,
			newlineLines + 1,
			newlineLines + 2
		]);
		expect(bounds).toEqual([
			{
				endColumn: 0,
				endOffset: 0,
				line: 0,
				lineTerminatorWidth: 1,
				startOffset: 0
			},
			{
				endColumn: 0,
				endOffset: newlineLines - 1,
				line: newlineLines - 1,
				lineTerminatorWidth: 1,
				startOffset: newlineLines - 1
			},
			{
				endColumn: 1,
				endOffset: newlineLines + 1,
				line: newlineLines,
				lineTerminatorWidth: 2,
				startOffset: newlineLines
			},
			{
				endColumn: 1,
				endOffset: newlineLines + 4,
				line: newlineLines + 1,
				lineTerminatorWidth: 1,
				startOffset: newlineLines + 3
			},
			{
				endColumn: 1,
				endOffset: newlineLines + 6,
				line: newlineLines + 2,
				lineTerminatorWidth: 0,
				startOffset: newlineLines + 5
			}
		]);
	});

	it('checks sparse authored-line deadlines at odd offsets across repeated CRLF pairs', () => {
		const deadline = new Error('deterministic sparse-line deadline');
		let checkpoints = 0;
		expect(() =>
			sourceOriginCorrelationSparseAuthoredLineBoundsForTesting(
				`x${'\r\n'.repeat(10_000)}`,
				[10_000],
				() => {
					checkpoints += 1;
					if (checkpoints === 4_097) throw deadline;
				}
			)
		).toThrow(deadline);
		expect(checkpoints).toBe(4_097);
	});

	it('preflights strict JSON structure before native parsing', () => {
		for (const text of [
			'',
			'{',
			'[] trailing',
			'{"a"}',
			'{"a":}',
			'{"a":1,}',
			'[1,]',
			'{"a":"unterminated}',
			'{"a":"\\x"}',
			'{"a":"\\u12xz"}',
			'{"a":01}',
			'{"a":1.}',
			'{"a":1e}',
			'{"a":@}'
		])
			expectIssue(constructed(baseline, withMapText(text)), 'INPUT_INVALID');

		const numericVersion = JSON.stringify(sourceMapJson).replace(
			'"version":3',
			'"version":-1.25e+2'
		);
		expectIssue(constructed(baseline, withMapText(numericVersion)), 'INPUT_INVALID');
		expectIssue(constructed(baseline, withMap({ version: true })), 'INPUT_INVALID');
		expectIssue(constructed(baseline, withMap({ sourceRoot: null })), 'INPUT_INVALID');
		expectIssue(
			constructed(baseline, withMap({}, { maxSourceMapJsonRecords: 1 })),
			'BUDGET_EXHAUSTED'
		);
		expectIssue(
			constructed(baseline, withMap({}, { maxSourceMapJsonDepth: 1 })),
			'BUDGET_EXHAUSTED'
		);
	});

	it('independently enforces the exact six-key flat Source Map v3 profile', () => {
		const duplicateVersion = JSON.stringify(sourceMapJson).replace(
			'"version":3',
			'"version":3,"version":3'
		);
		const duplicateVersionWithoutFile = JSON.stringify(sourceMapJson).replace(
			/"file":"[^"]*",/u,
			'"version":3,'
		);
		const loneSurrogateFile = JSON.stringify({ ...sourceMapJson, file: 'placeholder' }).replace(
			'"placeholder"',
			'"\\ud800"'
		);
		for (const selectedInputs of [
			withMapText(duplicateVersion),
			withMapText(duplicateVersionWithoutFile),
			withMapText(loneSurrogateFile),
			withMap({ unexpected: true }),
			withMap({ version: 2 }),
			withMap({ sourceRoot: 'src' }),
			withMap({ names: ['name'] }),
			withMap({ sources: [] }),
			withMap({ sources: ['a.ts', 'b.ts'] }),
			withMap({ file: 1 }),
			withMap({ mappings: 1 }),
			withMap({ file: '' }),
			withMap({ file: 'dist/index.d.ts' }),
			withMap({ file: 'index\\.d.ts' }),
			withMap({ sources: [''] }),
			withMap({ sources: ['/absolute.ts'] }),
			withMap({ sources: ['\\absolute.ts'] }),
			withMap({ sources: ['src\\index.ts'] }),
			withMap({ sources: ['index.ts?query'] }),
			withMap({ sources: ['index.ts#fragment'] }),
			withMap({ sources: ['https:index.ts'] })
		])
			expectIssue(constructed(baseline, selectedInputs), 'INPUT_INVALID');

		expectIssue(
			constructed(baseline, withMap({}, { maxMappingsCharacters: 1 })),
			'BUDGET_EXHAUSTED'
		);
		expectIssue(constructed(baseline, withMap({}, { maxPathCharacters: 1 })), 'INPUT_INVALID');
	});

	it('rejects decoder divergences across canonical VLQ and segment boundaries', () => {
		for (const mappings of [
			'',
			',',
			'A',
			'AAAAA',
			'g',
			'*AAA',
			'ggggggggA',
			'B',
			'gA',
			'ggggggE',
			'DAAA',
			'AAAA,AAAA',
			'ACAA',
			'AADA',
			'AAAD',
			'AAAA,',
			'AAAA,,AAAA',
			'AAAA;,AAAA'
		])
			expectIssue(constructed(baseline, withMap({ mappings })), 'INPUT_INVALID');

		expectIssue(
			constructed(baseline, withMap({ mappings: 'AAAA;AAAA' }, { maxDecodedMapLines: 1 })),
			'BUDGET_EXHAUSTED'
		);
		expectIssue(
			constructed(baseline, withMap({}, { maxDecodedMapSegments: 1 })),
			'BUDGET_EXHAUSTED'
		);
	});

	it('closes the per-call provider seam and enforces entry-anchored deadlines', () => {
		const seam = validateSourceOriginCorrelationWithProviderForTesting as unknown as (
			...parameters: readonly unknown[]
		) => ReturnType<typeof validateSourceOriginCorrelation>;
		expectIssue(seam(), 'SHAPE_INVALID');
		expectIssue(seam(baseline, inputs), 'SHAPE_INVALID');
		expectIssue(seam(baseline, inputs, {}, {}, 'extra'), 'SHAPE_INVALID');
		for (const overrides of [
			null,
			{ unexpected: true },
			{ emitDeclaration: 1 },
			{ monotonicNow: 1 },
			new Proxy({}, {})
		])
			expectIssue(
				validateSourceOriginCorrelationWithProviderForTesting(baseline, inputs, overrides as never),
				'SHAPE_INVALID'
			);
		let getterCalls = 0;
		const accessor: Record<string, unknown> = {};
		Object.defineProperty(accessor, 'monotonicNow', {
			enumerable: true,
			get() {
				getterCalls += 1;
				return () => 0;
			}
		});
		expectIssue(
			validateSourceOriginCorrelationWithProviderForTesting(baseline, inputs, accessor),
			'SHAPE_INVALID'
		);
		expect(getterCalls).toBe(0);

		expect(validateSourceOriginCorrelationWithProviderForTesting(baseline, inputs, {})).toEqual({
			issues: [],
			state: 'VALID'
		});
		expectIssue(
			validateSourceOriginCorrelationWithProviderForTesting(baseline, inputs, {
				monotonicNow: () => {
					throw new Error('clock unavailable');
				}
			}),
			'INPUT_INVALID'
		);
		expectIssue(
			validateSourceOriginCorrelationWithProviderForTesting(baseline, inputs, {
				monotonicNow: () => Number.NaN
			}),
			'INPUT_INVALID'
		);
		let throwingClockCalls = 0;
		expectIssue(
			validateSourceOriginCorrelationWithProviderForTesting(baseline, inputs, {
				monotonicNow: () => {
					throwingClockCalls += 1;
					if (throwingClockCalls === 1) return 0;
					throw new Error('clock failed after entry');
				}
			}),
			'INPUT_INVALID'
		);
		let regressingClockCalls = 0;
		expectIssue(
			validateSourceOriginCorrelationWithProviderForTesting(baseline, inputs, {
				monotonicNow: () => (regressingClockCalls++ === 0 ? 1 : 0)
			}),
			'INPUT_INVALID'
		);
		let expiredClockCalls = 0;
		expectIssue(
			validateSourceOriginCorrelationWithProviderForTesting(
				baseline,
				inputs,
				{ monotonicNow: () => expiredClockCalls++ },
				{ maxDurationMs: 1 }
			),
			'BUDGET_EXHAUSTED'
		);
	});

	it('gives elapsed duration precedence after large provider string comparisons', () => {
		const largeTargetText = 'a'.repeat(256 * 1024);
		const largeInputs = withTargetTextFrom(inputs, largeTargetText);
		const correctLargeProvider = providerForCaptures(largeInputs);
		const replaceLastCharacter = (text: string): string => `${text.slice(0, -1)}b`;
		const witnessAliasMismatch = ((
			...parameters: Parameters<typeof emitCompilerProjectDeclaration>
		): CompilerProjectDeclarationEmission => {
			const emission = structuredClone(correctLargeProvider(...parameters));
			const witnessOutputs = emission.emissionWitness.outputs.map((output) =>
				output.kind === 'DECLARATION'
					? { ...output, content: replaceLastCharacter(output.content) }
					: output
			) as unknown as CompilerProjectDeclarationEmission['outputs'];
			return {
				...emission,
				emissionWitness: { ...emission.emissionWitness, outputs: witnessOutputs }
			};
		}) as typeof emitCompilerProjectDeclaration;
		const captureContentMismatch = ((
			...parameters: Parameters<typeof emitCompilerProjectDeclaration>
		): CompilerProjectDeclarationEmission => {
			const emission = structuredClone(correctLargeProvider(...parameters));
			const outputs = emission.outputs.map((output) => {
				if (output.kind !== 'DECLARATION') return output;
				const content = replaceLastCharacter(output.content);
				const bytes = encoder.encode(content);
				return {
					...output,
					bytes: bytes.byteLength,
					content,
					contentSha256: sha256(bytes),
					textLength: content.length
				};
			}) as unknown as CompilerProjectDeclarationEmission['outputs'];
			return {
				...emission,
				emissionWitness: { ...emission.emissionWitness, outputs },
				outputs
			};
		}) as typeof emitCompilerProjectDeclaration;
		const expectDeadlineAfterComparison = (
			emitDeclaration: typeof emitCompilerProjectDeclaration,
			mismatchCode: SourceOriginCorrelationValidationIssue['code']
		): void => {
			let calibrationCalls = 0;
			expectIssue(
				validateSourceOriginCorrelationWithProviderForTesting(baseline, largeInputs, {
					emitDeclaration,
					monotonicNow: () => {
						calibrationCalls += 1;
						return 0;
					}
				}),
				mismatchCode
			);
			expect(calibrationCalls).toBeGreaterThan(4);
			const postEqualityCheckpoint = calibrationCalls - 1;
			let replayCalls = 0;
			expectIssue(
				validateSourceOriginCorrelationWithProviderForTesting(baseline, largeInputs, {
					emitDeclaration,
					monotonicNow: () => {
						replayCalls += 1;
						return replayCalls >= postEqualityCheckpoint
							? largeInputs.request.budgets.maxDurationMs
							: 0;
					}
				}),
				'BUDGET_EXHAUSTED'
			);
			expect(replayCalls).toBe(postEqualityCheckpoint);
		};

		expectDeadlineAfterComparison(witnessAliasMismatch, 'INPUT_INVALID');
		expectDeadlineAfterComparison(captureContentMismatch, 'DERIVATION_MISMATCH');
	}, 120_000);

	it('narrows provider resources to exact capture and aggregate residual ceilings', () => {
		const callerCaptureBytes =
			fixture.targetDeclarationBytes.byteLength + fixture.declarationMapBytes.byteLength;
		const callerCaptureCharacters =
			new TextDecoder().decode(fixture.targetDeclarationBytes).length +
			new TextDecoder().decode(fixture.declarationMapBytes).length;
		let observed:
			| {
					readonly emitInputRecords: number;
					readonly emitOutputBytes: number;
					readonly emitOutputStringCharacters: number;
					readonly emitReadBytes: number;
					readonly programInputRecords: number;
					readonly programReadBytes: number;
					readonly totalInputRecords: number;
					readonly totalReadBytes: number;
			  }
			| undefined;
		const observingProvider = ((
			providerInputs: CompilerProjectDeclarationEmissionInputs,
			providerLimits: CompilerProjectDeclarationEmissionLimits,
			runtime?: CompilerProjectDeclarationEmissionRuntimeOptions
		): ReturnType<typeof emitCompilerProjectDeclaration> => {
			observed = {
				emitInputRecords: providerLimits.maxInputRecords,
				emitOutputBytes: providerLimits.maxOutputBytes,
				emitOutputStringCharacters: providerLimits.maxOutputStringCharacters,
				emitReadBytes: providerLimits.maxReadBytes,
				programInputRecords: providerInputs.compilerProgramLimits.maxProgramInputRecords,
				programReadBytes: providerInputs.compilerProgramLimits.maxProgramReadBytes,
				totalInputRecords: providerInputs.compilerProgramLimits.maxTotalInputRecords,
				totalReadBytes: providerInputs.compilerProgramLimits.maxTotalReadBytes
			};
			return emitCompilerProjectDeclaration(providerInputs, providerLimits, runtime);
		}) as typeof emitCompilerProjectDeclaration;

		expect(
			validateSourceOriginCorrelationWithProviderForTesting(baseline, inputs, {
				emitDeclaration: observingProvider
			})
		).toEqual({ issues: [], state: 'VALID' });
		const residualInputRecords = inputs.request.budgets.maxInputRecords - 2;
		const residualReadBytes = inputs.request.budgets.maxReadBytes - callerCaptureBytes;
		const providerInputRecords = Math.min(
			inputs.request.budgets.maxCompilerInputAttempts,
			residualInputRecords
		);
		expect(observed).toEqual({
			emitInputRecords: providerInputRecords,
			emitOutputBytes: Math.min(
				inputs.request.budgets.maxEmitBytes,
				16 * 1024 * 1024,
				callerCaptureBytes
			),
			emitOutputStringCharacters: Math.min(
				inputs.request.budgets.maxEmitStringCharacters,
				16 * 1024 * 1024,
				callerCaptureCharacters
			),
			emitReadBytes: Math.min(inputs.request.budgets.maxProgramReadBytes, residualReadBytes),
			programInputRecords: providerInputRecords,
			programReadBytes: Math.min(inputs.request.budgets.maxProgramReadBytes, residualReadBytes),
			totalInputRecords: providerInputRecords,
			totalReadBytes: residualReadBytes
		});

		for (const maxInputRecords of [3_000_000, 4_000_000]) {
			let compilerClamp:
				| {
						readonly emitInputRecords: number;
						readonly programInputRecords: number;
						readonly totalInputRecords: number;
				  }
				| undefined;
			const compilerClampedProvider = ((
				providerInputs: CompilerProjectDeclarationEmissionInputs,
				providerLimits: CompilerProjectDeclarationEmissionLimits
			): never => {
				compilerClamp = {
					emitInputRecords: providerLimits.maxInputRecords,
					programInputRecords: providerInputs.compilerProgramLimits.maxProgramInputRecords,
					totalInputRecords: providerInputs.compilerProgramLimits.maxTotalInputRecords
				};
				throw new Error('intentional provider stop after limit observation');
			}) as typeof emitCompilerProjectDeclaration;
			expectIssue(
				validateSourceOriginCorrelationWithProviderForTesting(
					baseline,
					withBudgets(inputs, { maxCompilerInputAttempts: maxInputRecords, maxInputRecords }),
					{ emitDeclaration: compilerClampedProvider }
				),
				'INPUT_INVALID'
			);
			expect(compilerClamp).toEqual({
				emitInputRecords: 2_000_000,
				programInputRecords: 2_000_000,
				totalInputRecords: 2_000_000
			});
		}

		let providerCalls = 0;
		const countingProvider = ((
			providerInputs: CompilerProjectDeclarationEmissionInputs,
			providerLimits: CompilerProjectDeclarationEmissionLimits,
			runtime?: CompilerProjectDeclarationEmissionRuntimeOptions
		): ReturnType<typeof emitCompilerProjectDeclaration> => {
			providerCalls += 1;
			return emitCompilerProjectDeclaration(providerInputs, providerLimits, runtime);
		}) as typeof emitCompilerProjectDeclaration;
		const validateWithoutProviderCall = (
			selectedInputs: SourceOriginCorrelationBuildInputs
		): void => {
			expectIssue(
				validateSourceOriginCorrelationWithProviderForTesting(baseline, selectedInputs, {
					emitDeclaration: countingProvider
				}),
				'BUDGET_EXHAUSTED'
			);
			expect(providerCalls).toBe(0);
		};
		validateWithoutProviderCall(withBudgets(inputs, { maxInputRecords: 2 }));
		validateWithoutProviderCall(withBudgets(inputs, { maxEmitBytes: callerCaptureBytes - 1 }));
		validateWithoutProviderCall(
			withBudgets(inputs, {
				maxEmitStringCharacters:
					new TextDecoder().decode(inputs.targetDeclarationBytes).length +
					new TextDecoder().decode(inputs.declarationMapBytes).length -
					1
			})
		);
		validateWithoutProviderCall(
			withBudgets(inputs, {
				maxProgramReadBytes: callerCaptureBytes,
				maxReadBytes: callerCaptureBytes
			})
		);
	});

	it('fails closed across provider throws and malformed exact evidence', () => {
		const validateMutation = (
			mutate: (emission: CompilerProjectDeclarationEmission) => unknown,
			selectedInputs: SourceOriginCorrelationBuildInputs = inputs,
			code: SourceOriginCorrelationValidationIssue['code'] = 'INPUT_INVALID'
		): void => {
			expectIssue(
				validateSourceOriginCorrelationWithProviderForTesting(baseline, selectedInputs, {
					emitDeclaration: providerMutation(mutate)
				}),
				code
			);
		};

		expectIssue(
			validateSourceOriginCorrelationWithProviderForTesting(baseline, inputs, {
				emitDeclaration: (() => {
					throw new Error('provider fault');
				}) as typeof emitCompilerProjectDeclaration
			}),
			'INPUT_INVALID'
		);
		for (const code of ['BUDGET_EXCEEDED', 'INPUT_INVALID'] as const)
			expectIssue(
				validateSourceOriginCorrelationWithProviderForTesting(baseline, inputs, {
					emitDeclaration: (() => {
						throw new CompilerProjectDeclarationEmissionError(code, 'injected');
					}) as typeof emitCompilerProjectDeclaration
				}),
				code === 'BUDGET_EXCEEDED' ? 'BUDGET_EXHAUSTED' : 'INPUT_INVALID'
			);

		validateMutation(() => null);
		validateMutation((emission) => ({ ...emission, version: 'invalid' }));
		validateMutation((emission) => ({ ...emission, outputs: [] }));
		validateMutation((emission) => ({
			...emission,
			outputs: [{ ...emission.outputs[0], unexpected: true }, emission.outputs[1]]
		}));
		validateMutation((emission) => ({
			...emission,
			outputs: [
				{ ...emission.outputs[0], textLength: emission.outputs[0]!.textLength + 1 },
				emission.outputs[1]
			]
		}));
		validateMutation(
			(emission) => ({
				...emission,
				outputs: emission.outputs.map((output) => ({
					...output,
					content: 'x'.repeat(400),
					textLength: 400
				}))
			}),
			withBudgets(inputs, { maxEmitStringCharacters: 600 }),
			'BUDGET_EXHAUSTED'
		);
		const hardCeilingOutput = 'x'.repeat(16 * 1024 * 1024);
		validateMutation(
			(emission) => ({
				...emission,
				outputs: [
					{
						...emission.outputs[0],
						content: hardCeilingOutput,
						textLength: hardCeilingOutput.length
					},
					{ ...emission.outputs[1], content: 'x', textLength: 1 }
				]
			}),
			withBudgets(inputs, { maxEmitStringCharacters: hardCeilingOutput.length + 1 }),
			'BUDGET_EXHAUSTED'
		);
		validateMutation((emission) => ({
			...emission,
			emissionWitness: {
				...emission.emissionWitness,
				outputs: new Array<unknown>(1_000_000)
			}
		}));
		validateMutation((emission) => ({
			...emission,
			emissionWitness: {
				...emission.emissionWitness,
				outputs: [null, emission.outputs[1]]
			}
		}));
		validateMutation((emission) => ({
			...emission,
			emissionWitness: {
				...emission.emissionWitness,
				outputs: [
					{ ...emission.outputs[0], bytes: emission.outputs[0]!.bytes + 1 },
					emission.outputs[1]
				]
			}
		}));
		let providerCoercionCalls = 0;
		const coercibleDigest = {
			toString: (): string => {
				providerCoercionCalls += 1;
				return '0'.repeat(64);
			}
		};
		validateMutation((emission) => ({
			...emission,
			outputs: [
				{ ...emission.outputs[0], contentSha256: coercibleDigest as never },
				emission.outputs[1]
			]
		}));
		validateMutation((emission) => ({
			...emission,
			materializedSource: {
				...emission.materializedSource,
				contentSha256: coercibleDigest as never
			}
		}));
		validateMutation((emission) => ({
			...emission,
			emissionWitness: {
				...emission.emissionWitness,
				captureContextDigest: coercibleDigest as never
			}
		}));
		expect(providerCoercionCalls).toBe(0);
		validateMutation((emission) => ({
			...emission,
			outputs: [{ ...emission.outputs[0], contentSha256: 'invalid' }, emission.outputs[1]]
		}));
		validateMutation((emission) => ({
			...emission,
			materializedSource: {
				...emission.materializedSource,
				textLength: emission.materializedSource.textLength + 1
			}
		}));
		validateMutation((emission) => {
			const text = `${emission.materializedSource.text[0] === 'x' ? 'y' : 'x'}${emission.materializedSource.text.slice(1)}`;
			return {
				...emission,
				materializedSource: { ...emission.materializedSource, text }
			};
		});
		validateMutation((emission) => ({
			...emission,
			selection: { ...emission.selection, logicalPath: 'wrong/source.ts' }
		}));
		validateMutation((emission) => ({
			...emission,
			emissionWitness: { ...emission.emissionWitness, programCompilerInputAttempts: -1 }
		}));
		validateMutation((emission) => ({
			...emission,
			emissionWitness: { ...emission.emissionWitness, captureContextDigest: 'invalid' }
		}));
		validateMutation((emission) => ({
			...emission,
			emissionWitness: {
				...emission.emissionWitness,
				programCallbacksWithinAttributedInvocationBounds: false
			}
		}));
		validateMutation((emission) => ({
			...emission,
			emissionWitness: {
				...emission.emissionWitness,
				programSourcePopulationDigest: '0'.repeat(64)
			}
		}));

		const exactAttemptBudget = withBudgets(inputs, {
			maxCompilerInputAttempts: baseline.emission.programCompilerInputAttempts
		});
		validateMutation(
			(emission) => ({
				...emission,
				emissionWitness: {
					...emission.emissionWitness,
					attributedCompilerInputAttempts:
						emission.emissionWitness.attributedCompilerInputAttempts + 1,
					programCompilerInputAttempts: emission.emissionWitness.programCompilerInputAttempts + 1
				}
			}),
			exactAttemptBudget,
			'BUDGET_EXHAUSTED'
		);
		validateMutation(
			(emission) => ({
				...emission,
				emissionWitness: {
					...emission.emissionWitness,
					attributedCompilerInputAttempts: 2_000_001,
					programCompilerInputAttempts: 2_000_001
				}
			}),
			withBudgets(inputs, {
				maxCompilerInputAttempts: 4_000_000,
				maxInputRecords: 4_000_000
			}),
			'BUDGET_EXHAUSTED'
		);

		validateMutation((emission) => {
			const outputs = [
				{ ...emission.outputs[0], kind: 'DECLARATION' as const },
				{ ...emission.outputs[1], kind: 'DECLARATION' as const }
			];
			return {
				...emission,
				emissionWitness: { ...emission.emissionWitness, outputs },
				outputs
			};
		});
		validateMutation(
			(emission) => {
				const content = `x${emission.outputs[0]!.content.slice(1)}`;
				const bytes = encoder.encode(content);
				const outputs = [
					{
						...emission.outputs[0],
						bytes: bytes.byteLength,
						content,
						contentSha256: sha256(bytes),
						textLength: content.length
					},
					emission.outputs[1]
				];
				return {
					...emission,
					emissionWitness: { ...emission.emissionWitness, outputs },
					outputs
				};
			},
			inputs,
			'DERIVATION_MISMATCH'
		);
	}, 60_000);

	it('reconciles selected semantic identities and preallocation budgets before emission', () => {
		const mutateSemantic = (
			mutate: (snapshot: Record<string, unknown>) => void
		): SourceOriginCorrelationBuildInputs => {
			const semanticSnapshot = structuredClone(inputs.semanticSnapshot) as unknown as Record<
				string,
				unknown
			>;
			mutate(semanticSnapshot);
			return { ...inputs, semanticSnapshot: semanticSnapshot as never };
		};
		const selectedSource = (snapshot: Record<string, unknown>): Record<string, unknown> =>
			(snapshot.sources as Array<Record<string, unknown>>).find(
				(source) => source.id === inputs.request.semanticSourceId
			)!;
		const selectedProgram = (snapshot: Record<string, unknown>): Record<string, unknown> =>
			(snapshot.programs as Array<Record<string, unknown>>).find(
				(program) => program.id === inputs.request.semanticProgramId
			)!;

		expectIssue(
			constructed(baseline, {
				...inputs,
				request: { ...inputs.request, subjectId: '0'.repeat(64) }
			}),
			'INPUT_INVALID'
		);
		expectIssue(
			constructed(baseline, {
				...inputs,
				request: { ...inputs.request, semanticProjectId: 'semantic:missing-project' as never }
			}),
			'INPUT_INVALID'
		);
		expectIssue(
			constructed(
				baseline,
				mutateSemantic((snapshot) => {
					selectedSource(snapshot).origin = 'GENERATED';
				})
			),
			'INPUT_INVALID'
		);
		expectIssue(
			constructed(
				baseline,
				mutateSemantic((snapshot) => {
					selectedSource(snapshot).logicalPath = '/invalid.ts';
				})
			),
			'INPUT_INVALID'
		);
		expectIssue(
			constructed(
				baseline,
				mutateSemantic((snapshot) => {
					selectedSource(snapshot).bytes = Number(selectedSource(snapshot).bytes) + 1;
				})
			),
			'INPUT_INVALID'
		);

		const sourceTextLength = Number(
			inputs.semanticSnapshot.sources.find(
				(source) => source.id === inputs.request.semanticSourceId
			)!.textLength
		);
		expectIssue(
			constructed(baseline, withBudgets(inputs, { maxSourceTextCodeUnits: sourceTextLength - 1 })),
			'BUDGET_EXHAUSTED'
		);

		const fakeSourceId = 'semantic:source-fake';
		expectIssue(
			constructed(
				baseline,
				withBudgets(
					mutateSemantic((snapshot) => {
						(selectedProgram(snapshot).sourceIds as string[]).push(fakeSourceId);
					}),
					{ maxProgramSourceFiles: 1 }
				)
			),
			'BUDGET_EXHAUSTED'
		);

		const addProgramSource = (
			logicalPath: string,
			includeInProgramIds: boolean
		): SourceOriginCorrelationBuildInputs =>
			mutateSemantic((snapshot) => {
				const source = selectedSource(snapshot);
				const fake = { ...source, id: fakeSourceId, logicalPath, rootFile: false };
				(snapshot.sources as Array<Record<string, unknown>>).push(fake);
				if (includeInProgramIds)
					(selectedProgram(snapshot).sourceIds as string[]).push(fakeSourceId);
			});
		expectIssue(constructed(baseline, addProgramSource('/invalid.ts', false)), 'INPUT_INVALID');
		expectIssue(
			constructed(
				baseline,
				addProgramSource(
					inputs.semanticSnapshot.sources.find(
						(source) => source.id === inputs.request.semanticSourceId
					)!.logicalPath,
					false
				)
			),
			'INPUT_INVALID'
		);
		expectIssue(
			constructed(
				baseline,
				withBudgets(addProgramSource('packages/origin/src/extra.ts', false), {
					maxProgramSourceFiles: 1
				})
			),
			'BUDGET_EXHAUSTED'
		);
		expectIssue(
			constructed(baseline, addProgramSource('packages/origin/src/extra.ts', false)),
			'INPUT_INVALID'
		);
		expectIssue(
			constructed(baseline, addProgramSource('packages/origin/src/extra.ts', true)),
			'INPUT_INVALID'
		);

		expectIssue(constructed(baseline, withMap({ file: 'other.d.ts' })), 'INPUT_INVALID');
		expectIssue(constructed(baseline, withMap({ sources: ['../src/other.ts'] })), 'INPUT_INVALID');
		const mappings = `AAAA,${new Array(36).fill('CAAA').join(',')}`;
		expectIssue(
			constructed(baseline, withMap({ mappings }, { maxLocations: 72 })),
			'BUDGET_EXHAUSTED'
		);
	});

	it('enforces final budget precedence, semantic validation, and constructed entry closure', () => {
		expectIssue(
			constructed(
				baseline,
				withBudgets(inputs, {
					maxCallerCaptureBytes: baseline.coverage.callerCaptureBytes - 1
				})
			),
			'BUDGET_EXHAUSTED'
		);
		expectIssue(
			constructed(
				baseline,
				withBudgets(inputs, {
					maxEmitStringCharacters: Math.max(
						fixture.declarationMapBytes.byteLength,
						fixture.targetDeclarationBytes.byteLength
					)
				})
			),
			'BUDGET_EXHAUSTED'
		);
		expectIssue(
			validateConstructedSourceOriginCorrelation(baseline, inputs, baseline.inputDigest, {
				maxInputRecords: 200
			}),
			'BUDGET_EXHAUSTED'
		);

		const invalidSemanticSnapshot = structuredClone(inputs.semanticSnapshot);
		const invalidSemanticInputs = {
			...inputs,
			semanticSnapshot: { ...invalidSemanticSnapshot, subjectId: '0'.repeat(64) }
		};
		expectIssue(
			validateSourceOriginCorrelation(baseline, invalidSemanticInputs as never),
			'INPUT_INVALID'
		);
		expectIssue(constructed({ ...baseline, health: 'COMPLETE' }), 'DERIVATION_MISMATCH');
		expectIssue(
			constructed({
				...baseline,
				health: `${String.fromCodePoint(0x1f600)}"\\${String.fromCharCode(
					8,
					9,
					10,
					12,
					13,
					1
				)}${'x'.repeat(1_100)}`
			}),
			'DERIVATION_MISMATCH'
		);

		const constructedEntry = validateConstructedSourceOriginCorrelation as unknown as (
			...parameters: readonly unknown[]
		) => ReturnType<typeof validateSourceOriginCorrelation>;
		expectIssue(constructedEntry(), 'SHAPE_INVALID');
		expectIssue(constructedEntry(baseline, inputs), 'SHAPE_INVALID');
		expectIssue(
			constructedEntry(baseline, inputs, baseline.inputDigest, {}, 'extra'),
			'SHAPE_INVALID'
		);
		expectIssue(
			validateConstructedSourceOriginCorrelation(baseline, inputs, 'invalid'),
			'SHAPE_INVALID'
		);
	});

	it('recounts aliased occurrences across the raised input-census hard boundaries', () => {
		const aliasedRecordPopulation = (width: number, depth: number): readonly unknown[] => {
			let population: readonly unknown[] = Object.freeze([]);
			for (let level = 0; level < depth; level += 1)
				population = Object.freeze(Array.from({ length: width }, () => population));
			return population;
		};
		const logicalRecordPopulation = (width: number, depth: number): number => {
			let records = 1;
			for (let level = 0; level < depth; level += 1) records = 1 + width * records;
			return records;
		};
		const withCensusProbe = (
			probe: unknown,
			budgetOverrides: Partial<SourceOriginCorrelationBudgets>
		): SourceOriginCorrelationBuildInputs => {
			const budgeted = withBudgets(inputs, budgetOverrides);
			return {
				...budgeted,
				semanticSnapshot: Object.freeze({
					...budgeted.semanticSnapshot,
					censusProbe: probe
				})
			};
		};
		let providerCalls = 0;
		const unreachableProvider = (() => {
			providerCalls += 1;
			throw new Error('input census must fail before declaration emission');
		}) as typeof emitCompilerProjectDeclaration;
		const validateProbe = (
			selectedInputs: SourceOriginCorrelationBuildInputs,
			code: SourceOriginCorrelationValidationIssue['code']
		): void => {
			expectIssue(
				validateSourceOriginCorrelationWithProviderForTesting(baseline, selectedInputs, {
					emitDeclaration: unreachableProvider,
					monotonicNow: () => 0
				}),
				code
			);
		};

		const priorRecordCeilingCrossing = aliasedRecordPopulation(39, 4);
		expect(logicalRecordPopulation(39, 4)).toBe(2_374_321);
		validateProbe(
			withCensusProbe(priorRecordCeilingCrossing, { maxInputRecords: 3_000_000 }),
			'INPUT_INVALID'
		);
		const raisedRecordCeilingCrossing = aliasedRecordPopulation(45, 4);
		expect(logicalRecordPopulation(45, 4)).toBe(4_193_821);
		validateProbe(
			withCensusProbe(raisedRecordCeilingCrossing, { maxInputRecords: 5_000_000 }),
			'BUDGET_EXHAUSTED'
		);

		const sharedMebibyteText = Object.freeze({ text: 'x'.repeat(1024 * 1024) });
		const priorStringCeilingCrossing = Object.freeze(
			Array.from({ length: 65 }, () => sharedMebibyteText)
		);
		expect(priorStringCeilingCrossing.length * sharedMebibyteText.text.length).toBe(
			65 * 1024 * 1024
		);
		validateProbe(
			withCensusProbe(priorStringCeilingCrossing, {
				maxInputStringCharacters: 96 * 1024 * 1024
			}),
			'INPUT_INVALID'
		);
		const raisedStringCeilingCrossing = Object.freeze(
			Array.from({ length: 129 }, () => sharedMebibyteText)
		);
		expect(raisedStringCeilingCrossing.length * sharedMebibyteText.text.length).toBe(
			129 * 1024 * 1024
		);
		validateProbe(
			withCensusProbe(raisedStringCeilingCrossing, {
				maxInputStringCharacters: 192 * 1024 * 1024
			}),
			'BUDGET_EXHAUSTED'
		);
		expect(providerCalls).toBe(0);
	}, 120_000);

	it('covers remaining lexical, path, population, and provider allocation boundaries', () => {
		for (const text of [
			'   ',
			'{}',
			'{"a":',
			'[1,',
			'[1 2]',
			'{"a":-}',
			`{"a":"${String.fromCharCode(1)}"}`,
			'{"a":"\\'
		])
			expectIssue(constructed(baseline, withMapText(text)), 'INPUT_INVALID');

		const whitespaceKeyMap = JSON.stringify(sourceMapJson).replace('"version":', '"version" \n :');
		expectIssue(constructed(baseline, withMapText(whitespaceKeyMap)), 'DERIVATION_MISMATCH');
		expectIssue(
			constructed(
				baseline,
				withMapText(`${' '.repeat(160_000)}${JSON.stringify(sourceMapJson)}`, {
					maxInputStringCharacters: 150_000
				})
			),
			'BUDGET_EXHAUSTED'
		);

		for (const logicalPath of ['dist/\u0001index.d.ts', 'dist/a/../index.d.ts'])
			expectIssue(
				constructed(baseline, {
					...inputs,
					request: {
						...inputs.request,
						targetDeclaration: { ...inputs.request.targetDeclaration, logicalPath }
					}
				}),
				'INPUT_INVALID'
			);

		const compactCandidate = {
			...baseline,
			correlations: baseline.correlations.slice(0, 1),
			locations: baseline.locations.slice(0, 2),
			segments: baseline.segments.slice(0, 1),
			sourceMap: { ...baseline.sourceMap, segmentIds: baseline.sourceMap.segmentIds.slice(0, 1) }
		};
		expectIssue(
			constructed(
				compactCandidate,
				withBudgets(inputs, {
					maxCorrelations: 1,
					maxDecodedMapSegments: 1,
					maxLocations: 2,
					maxOutputRecords: 12,
					maxUnmappedGeneratedLines: 1
				})
			),
			'BUDGET_EXHAUSTED'
		);

		expectIssue(
			validateSourceOriginCorrelationWithProviderForTesting(baseline, inputs, {
				emitDeclaration: providerMutation((emission) => ({
					...emission,
					outputs: new Proxy([...emission.outputs], {})
				}))
			}),
			'INPUT_INVALID'
		);
		for (const maxRecords of [44, 80, 156])
			expectIssue(
				validateConstructedSourceOriginCorrelation(baseline, inputs, baseline.inputDigest, {
					maxRecords
				}),
				'BUDGET_EXHAUSTED'
			);
		expectIssue(
			validateConstructedSourceOriginCorrelation(baseline, inputs, baseline.inputDigest, {
				maxStringCharacters: 1_000
			}),
			'BUDGET_EXHAUSTED'
		);

		expectIssue(
			validateSourceOriginCorrelationWithProviderForTesting(baseline, inputs, {
				emitDeclaration: providerMutation((emission) => {
					const result = { ...emission } as Record<PropertyKey, unknown>;
					delete result.version;
					result[Symbol('replacement')] = emission.version;
					return result;
				})
			}),
			'INPUT_INVALID'
		);
		let providerGetterCalls = 0;
		expectIssue(
			validateSourceOriginCorrelationWithProviderForTesting(baseline, inputs, {
				emitDeclaration: providerMutation((emission) => {
					const result = { ...emission };
					Object.defineProperty(result, 'version', {
						enumerable: true,
						get() {
							providerGetterCalls += 1;
							return emission.version;
						}
					});
					return result;
				})
			}),
			'INPUT_INVALID'
		);
		expect(providerGetterCalls).toBe(0);
		expectIssue(
			validateSourceOriginCorrelationWithProviderForTesting(baseline, inputs, {
				emitDeclaration: providerMutation((emission) => {
					const outputs = [...emission.outputs];
					delete outputs[0];
					Object.defineProperty(outputs, '01', { enumerable: true, value: emission.outputs[0] });
					return { ...emission, outputs };
				})
			}),
			'INPUT_INVALID'
		);
		expectIssue(
			validateSourceOriginCorrelationWithProviderForTesting(baseline, inputs, {
				emitDeclaration: providerMutation((emission) => {
					const outputs = [...emission.outputs];
					delete outputs[0];
					return { ...emission, outputs };
				})
			}),
			'INPUT_INVALID'
		);
		expectIssue(
			validateSourceOriginCorrelationWithProviderForTesting(baseline, inputs, {
				emitDeclaration: emitCompilerProjectDeclaration,
				monotonicNow: () => 0,
				unexpected: () => 0
			} as never),
			'SHAPE_INVALID'
		);
	});

	it('binds altered captures through the fault seam before downstream location checks', () => {
		const validateCaptures = (
			selectedInputs: SourceOriginCorrelationBuildInputs,
			code: SourceOriginCorrelationValidationIssue['code']
		): void => {
			expectIssue(
				validateSourceOriginCorrelationWithProviderForTesting(baseline, selectedInputs, {
					emitDeclaration: providerForCaptures(selectedInputs)
				}),
				code
			);
		};
		const targetText = new TextDecoder().decode(fixture.targetDeclarationBytes);
		validateCaptures(
			withTargetTextFrom(inputs, targetText.replaceAll('\n', '\r\n')),
			'IDENTITY_MISMATCH'
		);
		validateCaptures(
			withTargetTextFrom(
				inputs,
				targetText.replace('\n//# sourceMappingURL=', '\n\n//# sourceMappingURL=')
			),
			'INPUT_INVALID'
		);
		validateCaptures(
			withMap({ mappings: String(sourceMapJson.mappings).replace('AAAA,eAAO', 'AAAA,eAAA') }),
			'INPUT_INVALID'
		);
		validateCaptures(withMap({ mappings: 'AAAA,CAAA;;;;;' }), 'INPUT_INVALID');
		validateCaptures(
			withMap({ mappings: String(sourceMapJson.mappings).replace(/^AAAA/u, 'oGAAA') }),
			'INPUT_INVALID'
		);
		validateCaptures(
			withTargetTextFrom(inputs, targetText.replace('//# sourceMappingURL=', '//# wrong=')),
			'INPUT_INVALID'
		);
		validateCaptures(withMap({ mappings: 'AAAA' }, { maxDecodedMapLines: 1 }), 'BUDGET_EXHAUSTED');
		const oneLineMapInputs = withMap({ mappings: 'AAAA' }, { maxDecodedMapLines: 1 });
		validateCaptures(withTargetTextFrom(oneLineMapInputs, '\n\nx'), 'BUDGET_EXHAUSTED');
		const unmappedMapInputs = withMap({ mappings: `${String(sourceMapJson.mappings)};` });
		validateCaptures(
			withTargetTextFrom(
				unmappedMapInputs,
				targetText.replace('\n//# sourceMappingURL=', '\n\n//# sourceMappingURL=')
			),
			'INPUT_INVALID'
		);

		expectIssue(
			constructed(
				baseline,
				withBudgets(inputs, {
					maxTraversalSteps: baseline.coverage.chargedTraversalSteps - 1
				})
			),
			'BUDGET_EXHAUSTED'
		);
		let hugeClockCalls = 0;
		expectIssue(
			validateSourceOriginCorrelationWithProviderForTesting(baseline, inputs, {
				monotonicNow: () => (hugeClockCalls++ === 0 ? 0 : Number.MAX_VALUE)
			}),
			'INPUT_INVALID'
		);
		expectIssue(constructed(null), 'SHAPE_INVALID');
	}, 60_000);
});
