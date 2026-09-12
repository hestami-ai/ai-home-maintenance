import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { performance } from 'node:perf_hooks';

import ts from 'typescript';
import { afterAll, describe, expect, it, vi } from 'vitest';

import {
	SOURCE_ORIGIN_CORRELATION_FIXTURE_CONFIG_PATH,
	SOURCE_ORIGIN_CORRELATION_FIXTURE_SOURCE_PATH,
	createSourceOriginCorrelationFixture,
	sourceOriginCorrelationInputs
} from './source-origin-correlation-fixture.test-support.js';
import {
	buildSourceOriginCorrelation,
	sourceOriginCorrelationDeclarationEmissionProvider
} from './build-source-origin-correlation.js';
import {
	CompilerProjectDeclarationEmissionError,
	type CompilerProjectDeclarationEmissionInputs,
	type CompilerProjectDeclarationEmissionLimits
} from '../providers/typescript/compiler-project-declaration-emission.js';
import {
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_REQUEST_SCHEMA_VERSION,
	type BuildStaticSemanticSnapshotRequest
} from '../contracts/semantic.js';
import {
	SUBJECT_POLICY_VERSION,
	SUBJECT_REQUEST_SCHEMA_VERSION,
	type ResolveSubjectRequest
} from '../contracts/subject.js';
import { resolveSubject } from '../subject/resolve-subject.js';
import { buildStaticSemanticSnapshot } from './build-static-semantic-snapshot.js';

function sha256(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function emitIndependentFixtureCaptures(root: string): {
	readonly declarationMapBytes: Uint8Array;
	readonly targetDeclarationBytes: Uint8Array;
} {
	const configPath = join(root, ...SOURCE_ORIGIN_CORRELATION_FIXTURE_CONFIG_PATH.split('/'));
	const config = ts.readConfigFile(configPath, ts.sys.readFile);
	if (config.error !== undefined) throw new Error(JSON.stringify(config.error));
	const parsed = ts.parseJsonConfigFileContent(
		config.config,
		ts.sys,
		dirname(configPath),
		undefined,
		configPath
	);
	if (parsed.errors.length !== 0) throw new Error(JSON.stringify(parsed.errors));
	const program = ts.createProgram({
		options: parsed.options,
		projectReferences: parsed.projectReferences,
		rootNames: parsed.fileNames
	});
	const source = program.getSourceFile(
		join(root, ...SOURCE_ORIGIN_CORRELATION_FIXTURE_SOURCE_PATH.split('/'))
	);
	if (source === undefined) throw new Error('dense fixture source missing from Program');
	const outputs = new Map<string, Uint8Array>();
	const result = program.emit(
		source,
		(fileName, data, writeByteOrderMark) => {
			if (writeByteOrderMark) throw new Error('unexpected declaration byte-order mark');
			outputs.set(relative(root, fileName).replaceAll('\\', '/'), new TextEncoder().encode(data));
		},
		undefined,
		true
	);
	if (result.emitSkipped || result.diagnostics.length !== 0 || outputs.size !== 2)
		throw new Error(`dense fixture emit failed: ${JSON.stringify(result.diagnostics)}`);
	const targetDeclarationBytes = outputs.get('packages/origin/dist/index.d.ts');
	const declarationMapBytes = outputs.get('packages/origin/dist/index.d.ts.map');
	if (targetDeclarationBytes === undefined || declarationMapBytes === undefined)
		throw new Error('dense fixture emitted an unexpected output population');
	return { declarationMapBytes, targetDeclarationBytes };
}

function resolveFixtureState(root: string) {
	const subjectRequest: ResolveSubjectRequest = {
		budgets: {
			maxBytes: 16 * 1024 * 1024,
			maxConfigDepth: 32,
			maxDiagnostics: 1_000,
			maxDurationMs: 60_000,
			maxFiles: 10_000,
			maxProjects: 10
		},
		filters: { exclude: [], include: [] },
		operationVersion: 'cap014-dense-authored-lines-test/1.0.0',
		outputs: [],
		policyVersion: SUBJECT_POLICY_VERSION,
		rootLocator: root,
		schemaVersion: SUBJECT_REQUEST_SCHEMA_VERSION,
		scope: {
			kind: 'EXPLICIT_PROJECTS',
			projects: [SOURCE_ORIGIN_CORRELATION_FIXTURE_CONFIG_PATH]
		},
		subjectKind: 'WORKTREE'
	};
	const subject = resolveSubject(subjectRequest);
	if (subject.outcome !== 'resolved') throw new Error(JSON.stringify(subject));
	const semanticRequest: BuildStaticSemanticSnapshotRequest = {
		assignabilityRequests: [],
		budgets: {
			maxAstDepth: 128,
			maxAstNodes: 100_000,
			maxCompilerFacts: 100_000,
			maxCompilerInputMetadataBytes: 8 * 1024 * 1024,
			maxCompilerQueries: 100_000,
			maxCompilerQueryInvocations: 1_000_000,
			maxContextBytes: 16 * 1024 * 1024,
			maxContextFileBytes: 4 * 1024 * 1024,
			maxContextFiles: 10_000,
			maxDiagnosticCharacters: 1_000_000,
			maxDiagnostics: 10_000,
			maxDirectoryEntries: 100_000,
			maxDurationMs: 60_000,
			maxLiteralCharacters: 10_000,
			maxPathCharacters: 4_096,
			maxProjects: 10,
			maxScopes: 100_000,
			maxSnapshotBytes: 64 * 1024 * 1024,
			maxSources: 10_000
		},
		capabilities: ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'],
		expectEmpty: false,
		operationVersion: SEMANTIC_OPERATION_VERSION,
		rootLocator: root,
		schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
		subjectId: subject.subject.descriptor.subjectId
	};
	const semantic = buildStaticSemanticSnapshot(semanticRequest, { subject: subject.subject });
	if (semantic.outcome === 'unavailable' || semantic.outcome === 'incompatible')
		throw new Error(JSON.stringify(semantic));
	return { frozenSubject: subject.subject, semanticSnapshot: semantic.snapshot };
}

describe('buildSourceOriginCorrelation', () => {
	const fixture = createSourceOriginCorrelationFixture();
	const originalProvider =
		sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration;
	afterAll(() => fixture.cleanup());

	function expectUnavailable(
		outcome: ReturnType<typeof buildSourceOriginCorrelation>,
		code: string
	): void {
		expect(outcome).toMatchObject({ diagnostics: [{ code }], outcome: 'unavailable' });
		expect(Object.isFrozen(outcome)).toBe(true);
	}

	function capturedInputs(targetText: string, mapText: string) {
		const base = sourceOriginCorrelationInputs(fixture);
		const targetDeclarationBytes = new TextEncoder().encode(targetText);
		const declarationMapBytes = new TextEncoder().encode(mapText);
		return {
			...base,
			declarationMapBytes,
			request: {
				...base.request,
				declarationMap: {
					...base.request.declarationMap,
					contentBytes: declarationMapBytes.byteLength,
					contentSha256: sha256(declarationMapBytes)
				},
				targetDeclaration: {
					...base.request.targetDeclaration,
					contentBytes: targetDeclarationBytes.byteLength,
					contentSha256: sha256(targetDeclarationBytes)
				}
			},
			targetDeclarationBytes
		};
	}

	function installCapturedProvider(targetText: string, mapText: string): void {
		sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration = (
			...arguments_: Parameters<typeof originalProvider>
		) => {
			const providerLimits = arguments_[1] as CompilerProjectDeclarationEmissionLimits;
			const emitted = originalProvider(
				arguments_[0],
				{
					...providerLimits,
					maxOutputBytes: 2 * 1024 * 1024,
					maxOutputStringCharacters: 2 * 1024 * 1024
				},
				arguments_[2]
			);
			const outputs = emitted.outputs.map((output) => {
				const content = output.kind === 'DECLARATION' ? targetText : mapText;
				const bytes = new TextEncoder().encode(content);
				return {
					...output,
					bytes: bytes.byteLength,
					content,
					contentSha256: sha256(bytes),
					textLength: content.length
				};
			});
			return { ...emitted, emissionWitness: { ...emitted.emissionWitness, outputs }, outputs };
		};
	}

	it('builds the complete exact correlation population from an independent capture', () => {
		const outcome = buildSourceOriginCorrelation(sourceOriginCorrelationInputs(fixture));
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		expect(outcome.diagnostics).toEqual([]);
		expect(outcome.analysis.coverage).toMatchObject({
			artifacts: 3,
			correlations: 36,
			decodedLines: 6,
			decodedSegments: 36,
			locations: 72,
			outputRecords: 152,
			unmappedGeneratedLines: 1
		});
		expect(outcome.analysis.segments).toHaveLength(36);
		expect(outcome.analysis.locations).toHaveLength(72);
		expect(outcome.analysis.correlations).toHaveLength(36);
		expect(outcome.analysis.unmappedGeneratedLines[0]?.line).toBe(6);
		expect(Object.isFrozen(outcome.analysis)).toBe(true);
		expect(Object.isFrozen(outcome.analysis.segments)).toBe(true);
	});

	it('fails closed on malformed shells, unsupported constants, and infeasible fixed budgets', () => {
		expectUnavailable(buildSourceOriginCorrelation(null), 'REQUEST_INVALID');
		const base = sourceOriginCorrelationInputs(fixture);
		expectUnavailable(buildSourceOriginCorrelation({ ...base, extra: true }), 'REQUEST_INVALID');
		expectUnavailable(
			buildSourceOriginCorrelation({
				...base,
				request: { ...base.request, operationVersion: 'unsupported' }
			}),
			'UNSUPPORTED_REQUEST'
		);
		const stagesWithSymbol = [...base.request.selection.programInputStages];
		delete stagesWithSymbol[0];
		Object.defineProperty(stagesWithSymbol, Symbol('replacement'), {
			enumerable: true,
			value: 'PROGRAM_CONSTRUCTION'
		});
		expectUnavailable(
			buildSourceOriginCorrelation({
				...base,
				request: {
					...base.request,
					selection: { ...base.request.selection, programInputStages: stagesWithSymbol }
				}
			}),
			'UNSUPPORTED_REQUEST'
		);
		expectUnavailable(
			buildSourceOriginCorrelation(
				sourceOriginCorrelationInputs(fixture, {}, { maxEmitOutputs: 1 })
			),
			'REQUEST_INVALID'
		);
		expectUnavailable(
			buildSourceOriginCorrelation({
				...base,
				request: {
					...base.request,
					budgets: { ...base.request.budgets, maxDurationMs: 0 }
				}
			}),
			'REQUEST_INVALID'
		);
		const activeStages = [...base.request.selection.programInputStages];
		Object.defineProperty(activeStages, '0', {
			enumerable: true,
			get: () => 'PROGRAM_CONSTRUCTION'
		});
		expectUnavailable(
			buildSourceOriginCorrelation({
				...base,
				request: {
					...base.request,
					selection: { ...base.request.selection, programInputStages: activeStages }
				}
			}),
			'UNSUPPORTED_REQUEST'
		);
		const stagesWithExtraKey = [...base.request.selection.programInputStages];
		Object.defineProperty(stagesWithExtraKey, 'extra', { enumerable: true, value: true });
		expectUnavailable(
			buildSourceOriginCorrelation({
				...base,
				request: {
					...base.request,
					selection: { ...base.request.selection, programInputStages: stagesWithExtraKey }
				}
			}),
			'UNSUPPORTED_REQUEST'
		);
		expectUnavailable(
			buildSourceOriginCorrelation(sourceOriginCorrelationInputs(fixture, {}, { maxReadBytes: 1 })),
			'REQUEST_INVALID'
		);
		const wrongInputKeys = { ...base } as Record<string, unknown>;
		delete wrongInputKeys.declarationMapBytes;
		wrongInputKeys.wrong = base.declarationMapBytes;
		expectUnavailable(buildSourceOriginCorrelation(wrongInputKeys), 'REQUEST_INVALID');
		expectUnavailable(
			buildSourceOriginCorrelation({
				...base,
				request: {
					...base.request,
					budgets: { ...base.request.budgets, maxCorrelations: 0 }
				}
			}),
			'REQUEST_INVALID'
		);
		for (const selection of [
			null,
			[],
			{ ...base.request.selection, artifactOrdering: 'x' },
			{
				...base.request.selection,
				artifactOrdering: `X${base.request.selection.artifactOrdering.slice(1)}`
			},
			{ ...base.request.selection, programInputStages: [] }
		])
			expectUnavailable(
				buildSourceOriginCorrelation({ ...base, request: { ...base.request, selection } }),
				'UNSUPPORTED_REQUEST'
			);
		for (const [request, code] of [
			[{ ...base.request, subjectId: 'not-a-digest' }, 'REQUEST_INVALID'],
			[{ ...base.request, semanticSourceId: '' }, 'REQUEST_INVALID'],
			[
				{
					...base.request,
					targetDeclaration: { ...base.request.targetDeclaration, logicalPath: 'bad\u0001.d.ts' }
				},
				'REQUEST_INVALID'
			],
			[
				{
					...base.request,
					declarationMap: { ...base.request.declarationMap, logicalPath: 'wrong.d.ts.map' }
				},
				'UNSUPPORTED_REQUEST'
			]
		] as const)
			expectUnavailable(buildSourceOriginCorrelation({ ...base, request }), code);
	});

	it('rejects malformed frozen descriptor trees without invoking active behavior', () => {
		const base = sourceOriginCorrelationInputs(fixture);
		const malformed: unknown[] = [];
		const cycle: Record<string, unknown> = {};
		cycle.self = cycle;
		Object.freeze(cycle);
		malformed.push(cycle, Object.freeze(new Date()), Object.freeze({ bad: Symbol('bad') }));
		const symbolKey = { ok: true } as Record<PropertyKey, unknown>;
		symbolKey[Symbol('bad')] = true;
		malformed.push(Object.freeze(symbolKey));
		let accessorCalls = 0;
		const accessor = {} as Record<string, unknown>;
		Object.defineProperty(accessor, 'bad', {
			enumerable: true,
			get() {
				accessorCalls += 1;
				return true;
			}
		});
		malformed.push(Object.freeze(accessor));
		const sparse = new Array(2);
		sparse[1] = true;
		const wrongIndex = new Array(2);
		wrongIndex[0] = true;
		Object.defineProperty(wrongIndex, 'bad', { enumerable: true, value: true });
		malformed.push(
			Object.freeze(sparse),
			Object.freeze(wrongIndex),
			Object.freeze({ bad: '\ud800' }),
			Object.freeze({ bad: '\udc00' })
		);
		for (const semanticSnapshot of malformed)
			expectUnavailable(
				buildSourceOriginCorrelation({ ...base, semanticSnapshot } as unknown),
				'REQUEST_INVALID'
			);
		expect(accessorCalls).toBe(0);
		expectUnavailable(
			buildSourceOriginCorrelation(
				sourceOriginCorrelationInputs(fixture, {}, { maxInputStringCharacters: 1 })
			),
			'BUDGET_EXCEEDED'
		);
		expectUnavailable(
			buildSourceOriginCorrelation(
				sourceOriginCorrelationInputs(fixture, {}, { maxInputRecords: 1 })
			),
			'BUDGET_EXCEEDED'
		);
		expectUnavailable(
			buildSourceOriginCorrelation({ ...base, semanticSnapshot: Object.freeze({}) } as unknown),
			'SEMANTIC_SNAPSHOT_INVALID'
		);
		let deep: Record<string, unknown> = {};
		for (let index = 0; index < 4_098; index += 1) deep = { child: Object.freeze(deep) };
		Object.freeze(deep);
		expectUnavailable(
			buildSourceOriginCorrelation({ ...base, semanticSnapshot: deep } as unknown),
			'BUDGET_EXCEEDED'
		);
		const oversizedSparseSources = new Array(base.request.budgets.maxInputRecords + 1);
		Object.freeze(oversizedSparseSources);
		expectUnavailable(
			buildSourceOriginCorrelation({
				...base,
				semanticSnapshot: Object.freeze({
					...base.semanticSnapshot,
					sources: oversizedSparseSources
				})
			} as unknown),
			'BUDGET_EXCEEDED'
		);
	});

	it('enforces the raised input census implementation ceilings independently of caller maxima', () => {
		const base = sourceOriginCorrelationInputs(
			fixture,
			{},
			{
				maxInputRecords: Number.MAX_SAFE_INTEGER,
				maxInputStringCharacters: Number.MAX_SAFE_INTEGER
			}
		);
		const aboveOldRecordCeiling = new Array(2_000_001);
		Object.freeze(aboveOldRecordCeiling);
		expectUnavailable(
			buildSourceOriginCorrelation({
				...base,
				semanticSnapshot: Object.freeze({
					...base.semanticSnapshot,
					sources: aboveOldRecordCeiling
				})
			} as unknown),
			'REQUEST_INVALID'
		);
		const aboveHardRecordCeiling = new Array(4_000_001);
		Object.freeze(aboveHardRecordCeiling);
		expectUnavailable(
			buildSourceOriginCorrelation({
				...base,
				semanticSnapshot: Object.freeze({
					...base.semanticSnapshot,
					sources: aboveHardRecordCeiling
				})
			} as unknown),
			'BUDGET_EXCEEDED'
		);

		// The invalid leading surrogate makes the accepted old-ceiling probe terminate without
		// scanning the large rope; the hard-ceiling probe is rejected before scalar validation.
		const aboveOldStringCeiling = `\ud800${'x'.repeat(64 * 1024 * 1024)}`;
		expect(aboveOldStringCeiling).toHaveLength(64 * 1024 * 1024 + 1);
		expectUnavailable(
			buildSourceOriginCorrelation({
				...base,
				semanticSnapshot: Object.freeze({
					...base.semanticSnapshot,
					censusProbe: aboveOldStringCeiling
				})
			} as unknown),
			'REQUEST_INVALID'
		);
		const atHardStringCeiling = 'x'.repeat(128 * 1024 * 1024);
		expect(atHardStringCeiling).toHaveLength(128 * 1024 * 1024);
		expectUnavailable(
			buildSourceOriginCorrelation({
				...base,
				semanticSnapshot: Object.freeze({
					...base.semanticSnapshot,
					censusProbe: atHardStringCeiling
				})
			} as unknown),
			'BUDGET_EXCEEDED'
		);
	});

	it('rejects malformed capture capabilities and UTF-8', () => {
		const base = sourceOriginCorrelationInputs(fixture);
		let proxyTrapCalls = 0;
		const proxyCapture = new Proxy(base.targetDeclarationBytes as Uint8Array, {
			get() {
				proxyTrapCalls += 1;
				throw new Error('capture proxy get trap must remain inert');
			},
			getPrototypeOf() {
				proxyTrapCalls += 1;
				throw new Error('capture proxy prototype trap must remain inert');
			}
		});
		expectUnavailable(
			buildSourceOriginCorrelation({
				...base,
				targetDeclarationBytes: proxyCapture
			}),
			'CAPTURE_INVALID'
		);
		expect(proxyTrapCalls).toBe(0);
		const shadowCapture = new Uint8Array(base.targetDeclarationBytes);
		let shadowCalls = 0;
		const shadow = () => {
			shadowCalls += 1;
			throw new Error('capture own property must remain inert');
		};
		Object.defineProperties(shadowCapture, {
			buffer: { configurable: true, get: shadow },
			byteLength: { configurable: true, get: shadow },
			set: { configurable: true, value: shadow },
			subarray: { configurable: true, value: shadow }
		});
		const shadowOutcome = buildSourceOriginCorrelation({
			...base,
			targetDeclarationBytes: shadowCapture
		});
		expect(shadowOutcome.outcome).toBe('partial');
		expect(shadowCalls).toBe(0);
		if (typeof SharedArrayBuffer === 'function') {
			expectUnavailable(
				buildSourceOriginCorrelation({
					...base,
					targetDeclarationBytes: new Uint8Array(new SharedArrayBuffer(1))
				}),
				'CAPTURE_INVALID'
			);
		}
		const detached = new Uint8Array([1]);
		structuredClone(detached.buffer, { transfer: [detached.buffer] });
		expectUnavailable(
			buildSourceOriginCorrelation({ ...base, targetDeclarationBytes: detached }),
			'INPUT_IDENTITY_MISMATCH'
		);
		const invalidUtf8 = new Uint8Array([0xff]);
		expectUnavailable(
			buildSourceOriginCorrelation({
				...base,
				targetDeclarationBytes: invalidUtf8,
				request: {
					...base.request,
					targetDeclaration: {
						...base.request.targetDeclaration,
						contentBytes: 1,
						contentSha256: sha256(invalidUtf8)
					}
				}
			}),
			'CAPTURE_INVALID'
		);
		const bom = new Uint8Array([0xef, 0xbb, 0xbf, 0x78]);
		expectUnavailable(
			buildSourceOriginCorrelation({
				...base,
				targetDeclarationBytes: bom,
				request: {
					...base.request,
					targetDeclaration: {
						...base.request.targetDeclaration,
						contentBytes: bom.byteLength,
						contentSha256: sha256(bom)
					}
				}
			}),
			'CAPTURE_INVALID'
		);
	});

	it('rejects caller capture population and descriptor mismatches before emission', () => {
		expectUnavailable(
			buildSourceOriginCorrelation(
				sourceOriginCorrelationInputs(fixture, {}, { maxCallerCaptureBytes: 1 })
			),
			'BUDGET_EXCEEDED'
		);
		const base = sourceOriginCorrelationInputs(fixture);
		expectUnavailable(
			buildSourceOriginCorrelation({
				...base,
				request: {
					...base.request,
					targetDeclaration: { ...base.request.targetDeclaration, contentBytes: 1 }
				}
			}),
			'INPUT_IDENTITY_MISMATCH'
		);
		expectUnavailable(
			buildSourceOriginCorrelation({ ...base, declarationMapBytes: new Uint8Array() }),
			'INPUT_IDENTITY_MISMATCH'
		);
	});

	it('enforces source-map lexical, decoder, and derived-population budgets', () => {
		for (const [budget, value] of [
			['maxSourceMapJsonDepth', 1],
			['maxSourceMapJsonRecords', 1],
			['maxDecodedMapSegments', 35],
			['maxLocations', 71],
			['maxCorrelations', 35],
			['maxOutputRecords', 151]
		] as const) {
			expectUnavailable(
				buildSourceOriginCorrelation(
					sourceOriginCorrelationInputs(fixture, {}, { [budget]: value })
				),
				'BUDGET_EXCEEDED'
			);
		}
		expectUnavailable(
			buildSourceOriginCorrelation(
				sourceOriginCorrelationInputs(fixture, {}, { maxEmitStringCharacters: 400 })
			),
			'BUDGET_EXCEEDED'
		);
	});

	it('rejects malformed and path-inconsistent strict source maps', () => {
		const base = sourceOriginCorrelationInputs(fixture);
		const malformed = new TextEncoder().encode('{');
		expectUnavailable(
			buildSourceOriginCorrelation({
				...base,
				declarationMapBytes: malformed,
				request: {
					...base.request,
					declarationMap: {
						...base.request.declarationMap,
						contentBytes: malformed.byteLength,
						contentSha256: sha256(malformed)
					}
				}
			}),
			'SOURCE_MAP_INVALID'
		);
		const map = JSON.parse(new TextDecoder().decode(base.declarationMapBytes)) as Record<
			string,
			unknown
		>;
		map.sources = ['wrong.ts'];
		const wrongPath = new TextEncoder().encode(JSON.stringify(map));
		expectUnavailable(
			buildSourceOriginCorrelation({
				...base,
				declarationMapBytes: wrongPath,
				request: {
					...base.request,
					declarationMap: {
						...base.request.declarationMap,
						contentBytes: wrongPath.byteLength,
						contentSha256: sha256(wrongPath)
					}
				}
			}),
			'SOURCE_ORIGIN_UNAVAILABLE'
		);
		const prettyMap = new TextEncoder().encode(JSON.stringify(map, null, 2));
		expectUnavailable(
			buildSourceOriginCorrelation({
				...base,
				declarationMapBytes: prettyMap,
				request: {
					...base.request,
					declarationMap: {
						...base.request.declarationMap,
						contentBytes: prettyMap.byteLength,
						contentSha256: sha256(prettyMap)
					}
				}
			}),
			'SOURCE_ORIGIN_UNAVAILABLE'
		);
	});

	it('fails closed for semantic identity and provider boundary faults', () => {
		const base = sourceOriginCorrelationInputs(fixture);
		expectUnavailable(
			buildSourceOriginCorrelation({
				...base,
				request: { ...base.request, semanticSnapshotId: 'semantic-snapshot-mismatch' }
			}),
			'INPUT_IDENTITY_MISMATCH'
		);
		expectUnavailable(
			buildSourceOriginCorrelation({
				...base,
				request: { ...base.request, semanticProjectId: 'missing-project' }
			}),
			'SOURCE_ORIGIN_UNAVAILABLE'
		);
		try {
			sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration = () => {
				throw new Error('fault');
			};
			expectUnavailable(buildSourceOriginCorrelation(base), 'EMISSION_FAILED');

			sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration = (() => ({
				nope: true
			})) as unknown as typeof originalProvider;
			expectUnavailable(buildSourceOriginCorrelation(base), 'EMISSION_FAILED');
		} finally {
			sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration =
				originalProvider;
		}
	});

	it('never invokes accessors returned by the mutable provider seam', () => {
		const base = sourceOriginCorrelationInputs(fixture);
		let accessorCalls = 0;
		try {
			sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration = (() => {
				const result: Record<string, unknown> = {
					emissionWitness: {},
					materializedSource: {},
					selection: {},
					version: 'jan-csaa-compiler-project-declaration-emission/1.0.0'
				};
				Object.defineProperty(result, 'outputs', {
					enumerable: true,
					get() {
						accessorCalls += 1;
						return [];
					}
				});
				return result;
			}) as unknown as typeof originalProvider;
			expectUnavailable(buildSourceOriginCorrelation(base), 'EMISSION_FAILED');
			expect(accessorCalls).toBe(0);
		} finally {
			sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration =
				originalProvider;
		}
	});

	it('reconciles witness output shells without rematerializing or invoking them', () => {
		const base = sourceOriginCorrelationInputs(fixture);
		let accessorCalls = 0;
		let coercionCalls = 0;
		try {
			sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration = (
				...arguments_: Parameters<typeof originalProvider>
			) => {
				const emitted = originalProvider(...arguments_);
				return {
					...emitted,
					emissionWitness: {
						...emitted.emissionWitness,
						outputs: emitted.outputs.map((output) => ({ ...output }))
					}
				};
			};
			expect(buildSourceOriginCorrelation(base).outcome).toBe('partial');

			sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration = ((
				...arguments_: Parameters<typeof originalProvider>
			) => {
				const emitted = originalProvider(...arguments_);
				const outputs = [...emitted.outputs];
				Object.defineProperty(outputs, '0', {
					configurable: true,
					enumerable: true,
					get() {
						accessorCalls += 1;
						return emitted.outputs[0];
					}
				});
				return { ...emitted, emissionWitness: { ...emitted.emissionWitness, outputs } };
			}) as unknown as typeof originalProvider;
			expectUnavailable(buildSourceOriginCorrelation(base), 'EMISSION_FAILED');
			expect(accessorCalls).toBe(0);

			sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration = ((
				...arguments_: Parameters<typeof originalProvider>
			) => {
				const emitted = originalProvider(...arguments_);
				const coerciveDigest = {
					[Symbol.toPrimitive]() {
						coercionCalls += 1;
						return emitted.outputs[0]!.contentSha256;
					}
				};
				const outputs = [
					{ ...emitted.outputs[0]!, contentSha256: coerciveDigest },
					emitted.outputs[1]!
				];
				return { ...emitted, emissionWitness: { ...emitted.emissionWitness, outputs } };
			}) as unknown as typeof originalProvider;
			expectUnavailable(buildSourceOriginCorrelation(base), 'EMISSION_FAILED');
			expect(coercionCalls).toBe(0);
		} finally {
			sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration =
				originalProvider;
		}
	});

	it('gates the cumulative provider output population before reconciliation', () => {
		const base = sourceOriginCorrelationInputs(fixture);
		const decoder = new TextDecoder();
		const maximumOutputCharacters =
			decoder.decode(base.targetDeclarationBytes).length +
			decoder.decode(base.declarationMapBytes).length;
		const bounded = sourceOriginCorrelationInputs(
			fixture,
			{},
			{ maxEmitStringCharacters: maximumOutputCharacters }
		);
		try {
			sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration = (
				...arguments_: Parameters<typeof originalProvider>
			) => {
				const emitted = originalProvider(...arguments_);
				const content = 'x'.repeat(Math.floor(maximumOutputCharacters / 2) + 1);
				const bytes = new TextEncoder().encode(content);
				const outputs = emitted.outputs.map((output) => ({
					...output,
					bytes: bytes.byteLength,
					content,
					contentSha256: sha256(bytes),
					textLength: content.length
				}));
				return { ...emitted, emissionWitness: { ...emitted.emissionWitness, outputs }, outputs };
			};
			expectUnavailable(buildSourceOriginCorrelation(bounded), 'BUDGET_EXCEEDED');
		} finally {
			sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration =
				originalProvider;
		}
	});

	it('passes only residual hard-capped aggregate and exact known output limits to the provider', () => {
		const base = sourceOriginCorrelationInputs(
			fixture,
			{},
			{
				maxCompilerInputAttempts: 3_000_000,
				maxEmitBytes: 32 * 1024 * 1024,
				maxEmitStringCharacters: 32 * 1024 * 1024,
				maxInputRecords: 4_000_000,
				maxProgramReadBytes: 600 * 1024 * 1024,
				maxReadBytes: 600 * 1024 * 1024
			}
		);
		const callerCaptureBytes =
			base.targetDeclarationBytes.byteLength + base.declarationMapBytes.byteLength;
		const decoder = new TextDecoder();
		const callerCaptureStringCharacters =
			decoder.decode(base.targetDeclarationBytes).length +
			decoder.decode(base.declarationMapBytes).length;
		const residualInputRecords = base.request.budgets.maxInputRecords - 2;
		const residualReadBytes = base.request.budgets.maxReadBytes - callerCaptureBytes;
		const providerInputRecords = Math.min(
			residualInputRecords,
			base.request.budgets.maxCompilerInputAttempts,
			2_000_000
		);
		expect(providerInputRecords).toBe(2_000_000);
		const providerReadBytes = Math.min(residualReadBytes, 528 * 1024 * 1024);
		const providerProgramReadBytes = Math.min(providerReadBytes, 512 * 1024 * 1024);
		let observedProgramLimits:
			CompilerProjectDeclarationEmissionInputs['compilerProgramLimits'] | undefined;
		let observedEmitLimits: CompilerProjectDeclarationEmissionLimits | undefined;
		try {
			sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration = (
				inputs,
				limits,
				hooks
			) => {
				observedProgramLimits = (inputs as CompilerProjectDeclarationEmissionInputs)
					.compilerProgramLimits;
				observedEmitLimits = limits as CompilerProjectDeclarationEmissionLimits;
				return originalProvider(inputs, limits, hooks);
			};
			const outcome = buildSourceOriginCorrelation(base);
			expect(outcome.outcome).toBe('partial');
			expect(observedProgramLimits).toMatchObject({
				maxProgramInputRecords: providerInputRecords,
				maxProgramReadBytes: providerProgramReadBytes,
				maxTotalInputRecords: providerInputRecords,
				maxTotalReadBytes: providerReadBytes
			});
			expect(observedEmitLimits).toMatchObject({
				maxInputRecords: providerInputRecords,
				maxOutputBytes: callerCaptureBytes,
				maxOutputStringCharacters: callerCaptureStringCharacters,
				maxReadBytes: providerProgramReadBytes
			});
		} finally {
			sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration =
				originalProvider;
		}
	});

	it('refuses exhausted residual or exact-output budgets before provider invocation', () => {
		const base = sourceOriginCorrelationInputs(fixture);
		const callerCaptureBytes =
			base.targetDeclarationBytes.byteLength + base.declarationMapBytes.byteLength;
		let providerInvocations = 0;
		try {
			sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration = (
				...arguments_: Parameters<typeof originalProvider>
			) => {
				providerInvocations += 1;
				return originalProvider(...arguments_);
			};
			for (const budgetOverrides of [
				{ maxEmitBytes: callerCaptureBytes - 1 },
				{ maxProgramReadBytes: callerCaptureBytes, maxReadBytes: callerCaptureBytes }
			])
				expectUnavailable(
					buildSourceOriginCorrelation(sourceOriginCorrelationInputs(fixture, {}, budgetOverrides)),
					'BUDGET_EXCEEDED'
				);
			expect(providerInvocations).toBe(0);
		} finally {
			sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration =
				originalProvider;
		}
	});

	it('rejects an oversized selected source before invoking declaration emission', () => {
		const source = fixture.semanticSnapshot.sources.find(
			(entry) => entry.id === fixture.semanticSourceId
		);
		if (source === undefined || source.textLength < 2) throw new Error('fixture source missing');
		let providerInvocations = 0;
		try {
			sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration = (
				...arguments_: Parameters<typeof originalProvider>
			) => {
				providerInvocations += 1;
				return originalProvider(...arguments_);
			};
			expectUnavailable(
				buildSourceOriginCorrelation(
					sourceOriginCorrelationInputs(
						fixture,
						{},
						{ maxSourceTextCodeUnits: source.textLength - 1 }
					)
				),
				'BUDGET_EXCEEDED'
			);
			expect(providerInvocations).toBe(0);
		} finally {
			sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration =
				originalProvider;
		}
	});

	it('rejects exact-shell provider field faults and compiler refusals', () => {
		const base = sourceOriginCorrelationInputs(fixture);
		const mutations: Array<(value: ReturnType<typeof originalProvider>) => unknown> = [
			(value) => ({ ...value, version: 'wrong' }),
			(value) => ({ ...value, outputs: [] }),
			(value) => ({ ...value, outputs: [{ ...value.outputs[0], bytes: -1 }, value.outputs[1]] }),
			(value) => ({ ...value, selection: { ...value.selection, logicalPath: 1 } }),
			(value) => ({ ...value, selection: { ...value.selection, logicalPath: '.' } }),
			(value) => ({
				...value,
				materializedSource: { ...value.materializedSource, semanticSourceId: 1 }
			}),
			(value) => ({
				...value,
				emissionWitness: { ...value.emissionWitness, programReadBytes: -1 }
			}),
			(value) => ({
				...value,
				emissionWitness: { ...value.emissionWitness, captureContextDigest: 'bad' }
			}),
			(value) => ({ ...value, emissionWitness: { ...value.emissionWitness, compilerVersion: 1 } }),
			(value) => ({
				...value,
				emissionWitness: { ...value.emissionWitness, configPath: '.' }
			}),
			(value) => ({
				...value,
				emissionWitness: { ...value.emissionWitness, emitOnlyDtsFiles: false }
			}),
			(value) => ({
				...value,
				emissionWitness: { ...value.emissionWitness, outputs: [value.outputs[1], value.outputs[0]] }
			}),
			(value) => ({
				...value,
				outputs: [{ ...value.outputs[0], logicalPath: '' }, value.outputs[1]]
			}),
			(value) => ({
				...value,
				outputs: [{ ...value.outputs[0], logicalPath: '.' }, value.outputs[1]]
			}),
			(value) => ({
				...value,
				outputs: [{ ...value.outputs[0], content: '\ud800', textLength: 1 }, value.outputs[1]]
			}),
			(value) => {
				const text = `${'a'.repeat(4_095)}😀`;
				return {
					...value,
					materializedSource: { ...value.materializedSource, text, textLength: text.length }
				};
			}
		];
		try {
			for (const mutate of mutations) {
				sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration = (
					...arguments_: Parameters<typeof originalProvider>
				) => mutate(originalProvider(...arguments_)) as ReturnType<typeof originalProvider>;
				expectUnavailable(buildSourceOriginCorrelation(base), 'EMISSION_FAILED');
			}
			sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration = (
				...arguments_: Parameters<typeof originalProvider>
			) => {
				const emitted = originalProvider(...arguments_);
				const outputs = [...emitted.outputs];
				Object.defineProperty(outputs, 'extra', { enumerable: true, value: true });
				return { ...emitted, outputs };
			};
			expectUnavailable(buildSourceOriginCorrelation(base), 'EMISSION_FAILED');
			let outputAccessorCalls = 0;
			sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration = (
				...arguments_: Parameters<typeof originalProvider>
			) => {
				const emitted = originalProvider(...arguments_);
				const outputs = [...emitted.outputs];
				Object.defineProperty(outputs, '0', {
					enumerable: true,
					get() {
						outputAccessorCalls += 1;
						return emitted.outputs[0];
					}
				});
				return { ...emitted, outputs };
			};
			expectUnavailable(buildSourceOriginCorrelation(base), 'EMISSION_FAILED');
			expect(outputAccessorCalls).toBe(0);
			for (const mutate of [
				(value: ReturnType<typeof originalProvider>) => ({
					...value,
					outputs: value.outputs.map((output) => ({ ...output, kind: 'DECLARATION' as const })),
					emissionWitness: {
						...value.emissionWitness,
						outputs: value.outputs.map((output) => ({ ...output, kind: 'DECLARATION' as const }))
					}
				}),
				(value: ReturnType<typeof originalProvider>) => ({
					...value,
					materializedSource: { ...value.materializedSource, semanticSourceId: 'wrong-source' }
				}),
				(value: ReturnType<typeof originalProvider>) => ({
					...value,
					emissionWitness: {
						...value.emissionWitness,
						programSourcePopulationDigest: '0'.repeat(64)
					}
				})
			]) {
				sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration = (
					...arguments_: Parameters<typeof originalProvider>
				) => mutate(originalProvider(...arguments_)) as ReturnType<typeof originalProvider>;
				expectUnavailable(buildSourceOriginCorrelation(base), 'EMISSION_FAILED');
			}
			for (const code of ['BUDGET_EXCEEDED', 'EMIT_UNAVAILABLE'] as const) {
				sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration = () => {
					throw new CompilerProjectDeclarationEmissionError(code, 'fault');
				};
				expectUnavailable(
					buildSourceOriginCorrelation(base),
					code === 'BUDGET_EXCEEDED' ? 'BUDGET_EXCEEDED' : 'EMISSION_FAILED'
				);
			}
		} finally {
			sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration =
				originalProvider;
		}
	}, 30_000);

	it('rejects coordinate, mapped-line, target-line, and trailer inconsistencies', () => {
		const source = '../src/index.ts';
		const map = (mappings: string) =>
			JSON.stringify({
				file: 'index.d.ts',
				mappings,
				names: [],
				sourceRoot: '',
				sources: [source],
				version: 3
			});
		const cases: Array<{ code: string; mapText: string; targetText: string }> = [
			{
				code: 'SOURCE_MAP_INVALID',
				mapText: map('AAAA,CAAA'),
				targetText: 'xx\n//# sourceMappingURL=index.d.ts.map\n'
			},
			{
				code: 'SOURCE_MAP_INVALID',
				mapText: map('gBAAA'),
				targetText: 'x\n//# sourceMappingURL=index.d.ts.map\n'
			},
			{
				code: 'SOURCE_MAP_INVALID',
				mapText: map('AAAA;;AACA'),
				targetText: 'x\ny\nz\n//# sourceMappingURL=index.d.ts.map\n'
			},
			{
				code: 'SOURCE_MAP_INVALID',
				mapText: map('AAAA'),
				targetText: 'x\ny\n//# sourceMappingURL=index.d.ts.map\n'
			},
			{
				code: 'SOURCE_MAP_INVALID',
				mapText: map('AAAA'),
				targetText: 'x\n//# sourceMappingURL=wrong.map\n'
			}
		];
		try {
			for (const entry of cases) {
				installCapturedProvider(entry.targetText, entry.mapText);
				expectUnavailable(
					buildSourceOriginCorrelation(capturedInputs(entry.targetText, entry.mapText)),
					entry.code
				);
			}
		} finally {
			sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration =
				originalProvider;
		}
	});

	it('checks chunked output bytes and final traversal evidence', () => {
		const base = sourceOriginCorrelationInputs(fixture);
		try {
			sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration = (
				...arguments_: Parameters<typeof originalProvider>
			) => {
				const emitted = originalProvider(...arguments_);
				const outputs = emitted.outputs.map((output) =>
					output.kind === 'DECLARATION'
						? { ...output, content: `X${output.content.slice(1)}` }
						: output
				);
				return { ...emitted, emissionWitness: { ...emitted.emissionWitness, outputs }, outputs };
			};
			expectUnavailable(buildSourceOriginCorrelation(base), 'EMISSION_OUTPUT_MISMATCH');
		} finally {
			sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration =
				originalProvider;
		}
		const success = buildSourceOriginCorrelation(base);
		if (success.outcome !== 'partial') throw new Error(JSON.stringify(success));
		expectUnavailable(
			buildSourceOriginCorrelation(
				sourceOriginCorrelationInputs(
					fixture,
					{},
					{
						maxTraversalSteps: success.analysis.coverage.chargedTraversalSteps - 1
					}
				)
			),
			'BUDGET_EXCEEDED'
		);
		const longTarget = `${'a'.repeat(4_095)}😀\n//# sourceMappingURL=index.d.ts.map\n`;
		const escapedMap =
			'{"file":"index.d.ts","mappings":"AAAA","names":[],"sourceRoot":"","sources":["..\\/src\\/index.ts"],"version":3}';
		try {
			installCapturedProvider(longTarget, escapedMap);
			expectUnavailable(
				buildSourceOriginCorrelation(capturedInputs(longTarget, escapedMap)),
				'VALIDATION_FAILED'
			);
		} finally {
			sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration =
				originalProvider;
		}
	});

	it('enforces remaining public-entry resource and capability boundaries', () => {
		const base = sourceOriginCorrelationInputs(fixture);
		expectUnavailable(
			buildSourceOriginCorrelation({
				...base,
				frozenSubject: new Proxy(base.frozenSubject, {})
			}),
			'CAPTURE_INVALID'
		);
		const duration = buildSourceOriginCorrelation(
			sourceOriginCorrelationInputs(fixture, {}, { maxDurationMs: 1 })
		);
		expectUnavailable(duration, 'BUDGET_EXCEEDED');
		const deadlineText = 'x'.repeat(2_000_000);
		expectUnavailable(
			buildSourceOriginCorrelation({
				...base,
				request: {
					...base.request,
					budgets: { ...base.request.budgets, maxDurationMs: 1 }
				},
				semanticSnapshot: Object.freeze({ ...base.semanticSnapshot, deadlineText })
			}),
			'BUDGET_EXCEEDED'
		);

		for (const maxInputRecords of [50, 75, 100, 125, 150, 200, 300, 500]) {
			const outcome = buildSourceOriginCorrelation(
				sourceOriginCorrelationInputs(fixture, {}, { maxInputRecords })
			);
			expect(outcome.outcome).toBe('unavailable');
		}
		for (const maxInputStringCharacters of [1_000, 2_000, 5_000, 10_000, 20_000]) {
			const outcome = buildSourceOriginCorrelation(
				sourceOriginCorrelationInputs(fixture, {}, { maxInputStringCharacters })
			);
			expect(outcome.outcome).toBe('unavailable');
		}

		const paddedMapText = `${' '.repeat(1_000_001)}${new TextDecoder().decode(base.declarationMapBytes)}`;
		const paddedMapBytes = new TextEncoder().encode(paddedMapText);
		expectUnavailable(
			buildSourceOriginCorrelation({
				...base,
				declarationMapBytes: paddedMapBytes,
				request: {
					...base.request,
					budgets: { ...base.request.budgets, maxInputStringCharacters: 1_000_000 },
					declarationMap: {
						...base.request.declarationMap,
						contentBytes: paddedMapBytes.byteLength,
						contentSha256: sha256(paddedMapBytes)
					}
				}
			}),
			'BUDGET_EXCEEDED'
		);

		const mapText = JSON.stringify({
			file: 'index.d.ts',
			mappings: 'AAAA',
			names: [],
			sourceRoot: '',
			sources: ['../src/index.ts'],
			version: 3
		});
		const targetText = 'x\ny\n//# sourceMappingURL=index.d.ts.map\n';
		try {
			installCapturedProvider(targetText, mapText);
			expectUnavailable(
				buildSourceOriginCorrelation(capturedInputs(targetText, mapText) satisfies typeof base),
				'SOURCE_MAP_INVALID'
			);
			const bounded = capturedInputs(targetText, mapText);
			expectUnavailable(
				buildSourceOriginCorrelation({
					...bounded,
					request: {
						...bounded.request,
						budgets: { ...bounded.request.budgets, maxDecodedMapLines: 1 }
					}
				}),
				'BUDGET_EXCEEDED'
			);
		} finally {
			sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration =
				originalProvider;
		}
	});

	it('resolves a tiny real map over one million mixed authored line endings sparsely', () => {
		const dense = createSourceOriginCorrelationFixture();
		const cycles = 333_335;
		const prefix = '\r\n\n\r'.repeat(cycles);
		const statement = 'export const value = `😀` as const;';
		const sourceText = `${prefix}${statement}`;
		try {
			writeFileSync(
				join(dense.root, SOURCE_ORIGIN_CORRELATION_FIXTURE_SOURCE_PATH),
				sourceText,
				'utf8'
			);
			const captures = emitIndependentFixtureCaptures(dense.root);
			const state = resolveFixtureState(dense.root);
			const project = state.semanticSnapshot.projects.find(
				(entry) => entry.configPath === SOURCE_ORIGIN_CORRELATION_FIXTURE_CONFIG_PATH
			);
			const source = state.semanticSnapshot.sources.find(
				(entry) => entry.logicalPath === SOURCE_ORIGIN_CORRELATION_FIXTURE_SOURCE_PATH
			);
			if (project === undefined || source === undefined)
				throw new Error('dense fixture selection missing');
			const outcome = buildSourceOriginCorrelation(
				sourceOriginCorrelationInputs(
					{
						...dense,
						...captures,
						frozenSubject: state.frozenSubject,
						semanticProgramId: project.programId,
						semanticProjectId: project.id,
						semanticSnapshot: state.semanticSnapshot,
						semanticSourceId: source.id
					},
					{},
					{
						maxDecodedMapLines: 1,
						maxDurationMs: 120_000,
						maxSourceTextCodeUnits: sourceText.length
					}
				)
			);
			if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
			const originalLine = cycles * 3;
			expect(statement.length).toBe(35);
			expect(outcome.analysis.coverage).toMatchObject({ decodedLines: 1, decodedSegments: 6 });
			expect(outcome.analysis.segments.map((segment) => segment.originalLine)).toEqual(
				new Array(6).fill(originalLine)
			);
			expect(outcome.analysis.segments.map((segment) => segment.originalColumn)).toEqual([
				0, 7, 13, 18, 34, 35
			]);
			const authoredLocations = outcome.analysis.locations.filter(
				(location) => location.role === 'AUTHORED_ORIGIN'
			);
			expect(authoredLocations).toHaveLength(6);
			for (const location of authoredLocations) {
				expect(location.line).toBe(originalLine);
				expect(location.offset).toBe(prefix.length + location.column);
			}
		} finally {
			dense.cleanup();
		}
	}, 120_000);

	it('cannot let an odd-offset CRLF stride evade authored-line deadline cadence', () => {
		const odd = createSourceOriginCorrelationFixture();
		const originalLine = 10_000;
		const sourceText = `a${'\r\n'.repeat(originalLine)}export const value = 1 as const;`;
		try {
			writeFileSync(
				join(odd.root, SOURCE_ORIGIN_CORRELATION_FIXTURE_SOURCE_PATH),
				sourceText,
				'utf8'
			);
			const captures = emitIndependentFixtureCaptures(odd.root);
			const state = resolveFixtureState(odd.root);
			const project = state.semanticSnapshot.projects.find(
				(entry) => entry.configPath === SOURCE_ORIGIN_CORRELATION_FIXTURE_CONFIG_PATH
			);
			const source = state.semanticSnapshot.sources.find(
				(entry) => entry.logicalPath === SOURCE_ORIGIN_CORRELATION_FIXTURE_SOURCE_PATH
			);
			if (project === undefined || source === undefined)
				throw new Error('odd-offset fixture selection missing');
			const inputs = sourceOriginCorrelationInputs(
				{
					...odd,
					...captures,
					frozenSubject: state.frozenSubject,
					semanticProgramId: project.programId,
					semanticProjectId: project.id,
					semanticSnapshot: state.semanticSnapshot,
					semanticSourceId: source.id
				},
				{},
				{
					maxDecodedMapLines: 1,
					maxDurationMs: 1,
					maxSourceTextCodeUnits: sourceText.length
				}
			);
			let sparseScanStarted = false;
			let sparseClockCalls = 0;
			let maximumSparseCharIndex = -1;
			const originalSetAdd = Set.prototype.add;
			const originalCharCodeAt = String.prototype.charCodeAt;
			const setAddSpy = vi.spyOn(Set.prototype, 'add').mockImplementation(function (
				this: Set<unknown>,
				value: unknown
			) {
				if (value === originalLine) sparseScanStarted = true;
				return Reflect.apply(originalSetAdd, this, [value]) as Set<unknown>;
			});
			const charCodeAtSpy = vi.spyOn(String.prototype, 'charCodeAt').mockImplementation(function (
				this: string,
				index: number
			) {
				if (sparseScanStarted) maximumSparseCharIndex = Math.max(maximumSparseCharIndex, index);
				return Reflect.apply(originalCharCodeAt, this, [index]) as number;
			});
			const clockSpy = vi.spyOn(performance, 'now').mockImplementation(() => {
				if (!sparseScanStarted) return 0;
				return sparseClockCalls++ === 0 ? 0 : 2;
			});
			try {
				const outcome = buildSourceOriginCorrelation(inputs);
				expect(outcome).toMatchObject({
					diagnostics: [{ code: 'BUDGET_EXCEEDED', phase: 'LOCATION_BIND' }],
					outcome: 'unavailable'
				});
				expect(sparseScanStarted).toBe(true);
				expect(sparseClockCalls).toBe(2);
				expect(maximumSparseCharIndex).toBe(510);
			} finally {
				clockSpy.mockRestore();
				charCodeAtSpy.mockRestore();
				setAddSpy.mockRestore();
			}
		} finally {
			odd.cleanup();
		}
	}, 120_000);

	it('orders a real multi-source selected Program by UTF-16 logical path', () => {
		const multi = createSourceOriginCorrelationFixture();
		try {
			writeFileSync(
				join(multi.root, 'packages/origin/src/other.ts'),
				'export interface Other { readonly value: number; }\n',
				'utf8'
			);
			writeFileSync(
				join(multi.root, SOURCE_ORIGIN_CORRELATION_FIXTURE_CONFIG_PATH),
				`${JSON.stringify(
					{
						compilerOptions: {
							declaration: true,
							declarationMap: true,
							emitDeclarationOnly: true,
							module: 'NodeNext',
							moduleResolution: 'NodeNext',
							noLib: true,
							outDir: 'dist',
							rootDir: 'src',
							strict: true,
							target: 'ES2022'
						},
						files: ['src/index.ts', 'src/other.ts']
					},
					null,
					2
				)}\n`,
				'utf8'
			);
			const subjectRequest: ResolveSubjectRequest = {
				budgets: {
					maxBytes: 16 * 1024 * 1024,
					maxConfigDepth: 32,
					maxDiagnostics: 1_000,
					maxDurationMs: 30_000,
					maxFiles: 10_000,
					maxProjects: 10
				},
				filters: { exclude: [], include: [] },
				operationVersion: 'cap014-multi-source-test/1.0.0',
				outputs: [],
				policyVersion: SUBJECT_POLICY_VERSION,
				rootLocator: multi.root,
				schemaVersion: SUBJECT_REQUEST_SCHEMA_VERSION,
				scope: {
					kind: 'EXPLICIT_PROJECTS',
					projects: [SOURCE_ORIGIN_CORRELATION_FIXTURE_CONFIG_PATH]
				},
				subjectKind: 'WORKTREE'
			};
			const subject = resolveSubject(subjectRequest);
			if (subject.outcome !== 'resolved') throw new Error(JSON.stringify(subject));
			const semanticRequest: BuildStaticSemanticSnapshotRequest = {
				assignabilityRequests: [],
				budgets: {
					maxAstDepth: 128,
					maxAstNodes: 100_000,
					maxCompilerFacts: 100_000,
					maxCompilerInputMetadataBytes: 8 * 1024 * 1024,
					maxCompilerQueries: 100_000,
					maxCompilerQueryInvocations: 1_000_000,
					maxContextBytes: 16 * 1024 * 1024,
					maxContextFileBytes: 4 * 1024 * 1024,
					maxContextFiles: 10_000,
					maxDiagnosticCharacters: 1_000_000,
					maxDiagnostics: 10_000,
					maxDirectoryEntries: 100_000,
					maxDurationMs: 60_000,
					maxLiteralCharacters: 10_000,
					maxPathCharacters: 4_096,
					maxProjects: 10,
					maxScopes: 100_000,
					maxSnapshotBytes: 64 * 1024 * 1024,
					maxSources: 10_000
				},
				capabilities: ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'],
				expectEmpty: false,
				operationVersion: SEMANTIC_OPERATION_VERSION,
				rootLocator: multi.root,
				schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
				subjectId: subject.subject.descriptor.subjectId
			};
			const semantic = buildStaticSemanticSnapshot(semanticRequest, { subject: subject.subject });
			if (semantic.outcome === 'unavailable' || semantic.outcome === 'incompatible')
				throw new Error(JSON.stringify(semantic));
			const project = semantic.snapshot.projects.find(
				(entry) => entry.configPath === SOURCE_ORIGIN_CORRELATION_FIXTURE_CONFIG_PATH
			);
			const source = semantic.snapshot.sources.find(
				(entry) => entry.logicalPath === SOURCE_ORIGIN_CORRELATION_FIXTURE_SOURCE_PATH
			);
			if (project === undefined || source === undefined)
				throw new Error('missing multi-source selection');
			const outcome = buildSourceOriginCorrelation(
				sourceOriginCorrelationInputs({
					...multi,
					frozenSubject: subject.subject,
					semanticProgramId: project.programId,
					semanticProjectId: project.id,
					semanticSnapshot: semantic.snapshot,
					semanticSourceId: source.id
				})
			);
			expect(outcome.outcome).toBe('partial');
			if (outcome.outcome === 'partial')
				expect(outcome.analysis.coverage.programSourceFiles).toBe(2);
		} finally {
			multi.cleanup();
		}
	}, 30_000);

	it('rejects a seam-only witness discrepancy during independent validation', () => {
		const base = sourceOriginCorrelationInputs(fixture);
		try {
			sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration = (
				...arguments_: Parameters<typeof originalProvider>
			) => {
				const emitted = originalProvider(...arguments_);
				return {
					...emitted,
					emissionWitness: {
						...emitted.emissionWitness,
						attributedUniqueQueries: emitted.emissionWitness.attributedUniqueQueries + 1
					}
				};
			};
			expectUnavailable(buildSourceOriginCorrelation(base), 'VALIDATION_FAILED');
		} finally {
			sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration =
				originalProvider;
		}
	});

	it('rejects provider content mismatches and inconsistent source witnesses', () => {
		const base = sourceOriginCorrelationInputs(fixture);
		try {
			sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration = (
				...arguments_: Parameters<typeof originalProvider>
			) => {
				const emitted = originalProvider(...arguments_);
				const outputs = emitted.outputs.map((output) =>
					output.kind === 'DECLARATION'
						? { ...output, content: `${output.content} `, textLength: output.textLength + 1 }
						: output
				);
				return {
					...emitted,
					emissionWitness: { ...emitted.emissionWitness, outputs },
					outputs
				};
			};
			expectUnavailable(buildSourceOriginCorrelation(base), 'EMISSION_OUTPUT_MISMATCH');

			sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration = (
				...arguments_: Parameters<typeof originalProvider>
			) => {
				const emitted = originalProvider(...arguments_);
				return {
					...emitted,
					materializedSource: {
						...emitted.materializedSource,
						text: `${emitted.materializedSource.text} `
					}
				};
			};
			expectUnavailable(buildSourceOriginCorrelation(base), 'EMISSION_FAILED');
		} finally {
			sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration =
				originalProvider;
		}
	});

	it('reports ordered isolated progress without making observers semantic', async () => {
		const events: string[] = [];
		const outcome = buildSourceOriginCorrelation(sourceOriginCorrelationInputs(fixture), {
			onProgress(event) {
				events.push(`${event.sequence}:${event.phase}:${event.state}`);
				if (event.sequence === 0) throw new Error('observer failure');
			}
		});
		expect(outcome.outcome).toBe('partial');
		await Promise.resolve();
		expect(events[0]).toBe('0:REQUEST_BIND:STARTED');
		expect(events.some((event) => event.includes('ANALYSIS_VALIDATE:COMPLETED'))).toBe(true);
	});
});
