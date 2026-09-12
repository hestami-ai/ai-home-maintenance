import ts from 'typescript';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
	ModuleResolutionTraceBuildInputs,
	ModuleResolutionTraceDiagnosticCode,
	ModuleResolutionTraceSnapshot
} from '../contracts/module-resolution-trace.js';
import type { CompilerInputQuery } from '../providers/typescript/compiler-input-journal.js';
import * as graphValidator from '../graph/validate-project-context-graph.js';
import { sha256 } from '../inventory/canonical.js';
import * as compilerCapture from '../semantic/compiler-capture-capability.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import * as semanticValidator from '../semantic/validate-snapshot.js';
import * as conditionalValidator from './validate-conditional-export-resolution.js';
import {
	buildModuleResolutionTrace,
	moduleResolutionTraceTypeScriptPublicApi
} from './build-module-resolution-trace.js';
import {
	MODULE_RESOLUTION_FIXTURE_TARGET_PATH,
	createModuleResolutionTraceFixture,
	moduleResolutionTraceInputs,
	type ModuleResolutionTraceFixture
} from './module-resolution-trace-fixture.test-support.js';
import { moduleResolutionTraceContentDigest } from './module-resolution-trace-canonical.js';
import * as traceValidator from './validate-module-resolution-trace.js';

type Lookup = NonNullable<
	ReturnType<typeof compilerCapture.getStaticSemanticSnapshotCompilerProjectInputLookup>
>;

function buildIssue(value: unknown, code: ModuleResolutionTraceDiagnosticCode): void {
	const outcome = buildModuleResolutionTrace(value);
	expect(outcome.outcome).toBe('unavailable');
	if (outcome.outcome === 'unavailable') expect(outcome.diagnostics[0]?.code).toBe(code);
}

function buildTrace(value: unknown): ModuleResolutionTraceSnapshot {
	const outcome = buildModuleResolutionTrace(value);
	if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
	expect(outcome.outcome).toBe('partial');
	return outcome.trace;
}

function withRequest(
	inputs: ModuleResolutionTraceBuildInputs,
	overrides: Partial<ModuleResolutionTraceBuildInputs['request']>
): ModuleResolutionTraceBuildInputs {
	return {
		...inputs,
		request: {
			...inputs.request,
			budgets: { ...inputs.request.budgets },
			conditionalExportResolution: { ...inputs.request.conditionalExportResolution },
			importer: { ...inputs.request.importer },
			projectContextGraph: { ...inputs.request.projectContextGraph },
			...overrides
		}
	};
}

function plainUsage(value: unknown): { records: number; stringCharacters: number } {
	let records = 0;
	let stringCharacters = 0;
	const pending: unknown[] = [value];
	while (pending.length > 0) {
		const child = pending.pop();
		records += 1;
		if (typeof child === 'string') {
			stringCharacters += child.length;
			continue;
		}
		if (child === null || typeof child !== 'object') continue;
		if (Array.isArray(child)) {
			for (let index = child.length - 1; index >= 0; index -= 1) {
				stringCharacters += String(index).length;
				pending.push(child[index]);
			}
			continue;
		}
		for (const key of Object.keys(child).reverse()) {
			stringCharacters += key.length;
			pending.push((child as Record<string, unknown>)[key]);
		}
	}
	return { records, stringCharacters };
}

function mutableTrace(value: ModuleResolutionTraceSnapshot): ModuleResolutionTraceSnapshot {
	return JSON.parse(JSON.stringify(value)) as ModuleResolutionTraceSnapshot;
}

function freezePlainTree<Value>(value: Value, seen = new WeakSet<object>()): Value {
	if (value === null || typeof value !== 'object') return value;
	if (seen.has(value)) return value;
	seen.add(value);
	for (const key of Reflect.ownKeys(value)) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor !== undefined && 'value' in descriptor) freezePlainTree(descriptor.value, seen);
	}
	return Object.freeze(value);
}

function expectValidationIssue(
	value: unknown,
	inputsValue: unknown,
	code: string,
	options?: Parameters<typeof traceValidator.validateModuleResolutionTrace>[2]
): void {
	const result = traceValidator.validateModuleResolutionTrace(
		value,
		inputsValue as ModuleResolutionTraceBuildInputs,
		options
	);
	expect(result.state).not.toBe('VALID');
	if (result.state !== 'VALID') expect(result.issues[0]?.code).toBe(code);
}

function expectConstructedIssue(
	value: unknown,
	inputsValue: unknown,
	code: string,
	knownInputDigest: string = '0'.repeat(64),
	options?: Parameters<typeof traceValidator.validateConstructedModuleResolutionTrace>[3]
): void {
	const result = traceValidator.validateConstructedModuleResolutionTrace(
		value,
		inputsValue as ModuleResolutionTraceBuildInputs,
		knownInputDigest,
		options
	);
	expect(result.state).not.toBe('VALID');
	if (result.state !== 'VALID') expect(result.issues[0]?.code).toBe(code);
}

function validPredecessors(): void {
	vi.spyOn(semanticValidator, 'validateStaticSemanticSnapshot').mockReturnValue({
		issues: [],
		state: 'VALID'
	});
	vi.spyOn(graphValidator, 'validateConstructedProjectContextGraph').mockReturnValue({
		issues: [],
		state: 'VALID'
	});
	vi.spyOn(conditionalValidator, 'validateConstructedConditionalExportResolution').mockReturnValue({
		issues: [],
		state: 'VALID'
	});
	vi.spyOn(traceValidator, 'validateConstructedModuleResolutionTrace').mockReturnValue({
		issues: [],
		state: 'VALID'
	});
}

function queryKey(query: CompilerInputQuery): string {
	return canonicalSemanticJson(query);
}

function fakeEntry(
	query: CompilerInputQuery,
	result: 'ABSENT' | 'DIRECTORY' | 'NOT_DIRECTORY' | 'PRESENT' | 'RESOLVED',
	text?: string,
	resolvedLogicalPath?: string
): ReturnType<Lookup['lookupAttributedQuery']> {
	const id = `analysis:context-input-${sha256(`coverage:${queryKey(query)}:${result}:${text ?? ''}`)}`;
	const base = {
		id,
		invocationCount: 1,
		logicalPath: query.logicalPath,
		operation: query.operation,
		origin: 'UNKNOWN' as const,
		resultDigest: sha256(`coverage-result:${id}`)
	};
	if (query.operation === 'READ_FILE' && result === 'PRESENT') {
		const bytes = new TextEncoder().encode(text ?? '');
		return {
			attributedInvocationCount: 1,
			bytes,
			observation: {
				...base,
				byteBudgetClass: 'LIVE_COMPILER_CONTEXT',
				contentBytes: bytes.byteLength,
				contentSha256: sha256(bytes),
				operation: 'READ_FILE',
				result: 'PRESENT'
			},
			query: { ...query, operation: 'READ_FILE' }
		} as ReturnType<Lookup['lookupAttributedQuery']>;
	}
	if (query.operation === 'REALPATH' && result === 'RESOLVED')
		return {
			attributedInvocationCount: 1,
			observation: {
				...base,
				operation: 'REALPATH',
				resolvedLogicalPath: resolvedLogicalPath ?? query.logicalPath,
				result: 'RESOLVED'
			},
			query
		} as ReturnType<Lookup['lookupAttributedQuery']>;
	return {
		attributedInvocationCount: 1,
		observation: { ...base, operation: query.operation, result },
		query
	} as ReturnType<Lookup['lookupAttributedQuery']>;
}

function wrappedLookup(
	base: Lookup,
	entries: readonly NonNullable<ReturnType<Lookup['lookupAttributedQuery']>>[],
	overrides: Partial<Lookup> = {}
): Lookup {
	const extra = new Map(entries.map((entry) => [queryKey(entry.query), entry]));
	const ids = entries.map((entry) => entry.observation.id);
	return {
		...base,
		...overrides,
		attribution: {
			...base.attribution,
			contextInputIds: [...base.attribution.contextInputIds, ...ids]
		},
		lookupAttributedQuery(query) {
			const entry = extra.get(queryKey(query));
			if (entry !== undefined)
				return {
					...entry,
					bytes: entry.bytes?.slice(),
					observation: { ...entry.observation },
					query: { ...entry.query }
				};
			return base.lookupAttributedQuery(query);
		}
	} as Lookup;
}

describe('module-resolution trace boundary coverage', { timeout: 30_000 }, () => {
	let fixture: ModuleResolutionTraceFixture;
	let inputs: ModuleResolutionTraceBuildInputs;
	let lookup: Lookup;
	let trace: ModuleResolutionTraceSnapshot;

	beforeAll(() => {
		fixture = createModuleResolutionTraceFixture();
		inputs = moduleResolutionTraceInputs(fixture);
		lookup = compilerCapture.getStaticSemanticSnapshotCompilerProjectInputLookup(
			fixture.semanticSnapshot,
			'packages/consumer/tsconfig.json'
		)!;
		trace = buildTrace(inputs);
	});

	beforeEach(() => {
		validPredecessors();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	afterAll(() => {
		fixture.cleanup();
	});

	it('guards the exact frozen snapshot compiler-capture attachment capability', () => {
		expect(() =>
			compilerCapture.attachVerifiedCompilerCaptureToStaticSemanticSnapshot(
				fixture.semanticSnapshot,
				fixture.frozenSubject,
				{} as never
			)
		).toThrow(/already has a verified compiler capture capability/u);
		expect(() =>
			compilerCapture.attachVerifiedCompilerCaptureToStaticSemanticSnapshot(
				{ ...fixture.semanticSnapshot },
				fixture.frozenSubject,
				{} as never
			)
		).toThrow(/only to the final frozen semantic snapshot/u);
	});

	it(
		'rejects genuine capture attachment population and recipe reconciliation mismatches',
		{ timeout: 60_000 },
		() => {
			vi.restoreAllMocks();
			const originalAttach = compilerCapture.attachVerifiedCompilerCaptureToStaticSemanticSnapshot;
			let captured:
				| Parameters<typeof compilerCapture.attachVerifiedCompilerCaptureToStaticSemanticSnapshot>
				| undefined;
			vi.spyOn(
				compilerCapture,
				'attachVerifiedCompilerCaptureToStaticSemanticSnapshot'
			).mockImplementation((...args) => {
				captured = args;
				originalAttach(...args);
			});
			const guarded = createModuleResolutionTraceFixture();
			try {
				expect(captured).toBeDefined();
				const [snapshot, subject, capture] = captured!;
				vi.mocked(
					compilerCapture.attachVerifiedCompilerCaptureToStaticSemanticSnapshot
				).mockRestore();
				const populationMismatch = freezePlainTree({
					...structuredClone(snapshot),
					projects: structuredClone(snapshot.projects.slice(1))
				});
				expect(() => originalAttach(populationMismatch, subject, capture)).toThrow(
					/populations differ/u
				);

				const recipeClone = structuredClone(snapshot);
				const recipeMismatch = freezePlainTree({
					...recipeClone,
					projects: recipeClone.projects.map((project, index) =>
						index === 0
							? {
									...project,
									programRecipe: {
										...project.programRecipe,
										compilerOptions: {
											...project.programRecipe.compilerOptions,
											strict: project.programRecipe.compilerOptions.strict !== true
										}
									}
								}
							: project
					)
				});
				expect(() => originalAttach(recipeMismatch, subject, capture)).toThrow(
					/does not reproduce its exact subject recipe and Program/u
				);
			} finally {
				guarded.cleanup();
			}
		}
	);

	it('fails descriptor-first without invoking hostile accessors or proxies', () => {
		let getterCalls = 0;
		const accessor = { ...inputs } as Record<string, unknown>;
		Object.defineProperty(accessor, 'request', {
			enumerable: true,
			get() {
				getterCalls += 1;
				throw new Error('must not run');
			}
		});
		buildIssue(accessor, 'REQUEST_INVALID');
		expect(getterCalls).toBe(0);
		buildIssue(new Proxy(inputs, {}), 'REQUEST_INVALID');
		buildIssue(Object.assign(Object.create({}), inputs), 'REQUEST_INVALID');
		buildIssue({ ...inputs, extra: true }, 'REQUEST_INVALID');
		const missing = { ...inputs } as Record<string, unknown>;
		delete missing.conditionalExportRequest;
		buildIssue(missing, 'REQUEST_INVALID');
		buildIssue(null, 'REQUEST_INVALID');
		buildIssue([], 'REQUEST_INVALID');
	});

	it('rejects hostile nested values, Unicode, cycles, sparse arrays, and expandos', () => {
		for (const bad of [undefined, 1.5, Number.NaN, -0, 1n, Symbol('x'), () => undefined])
			buildIssue({ ...inputs, conditionalExportRequest: bad }, 'REQUEST_INVALID');
		buildIssue(withRequest(inputs, { packageName: '\ud800' }), 'REQUEST_INVALID');

		const cyclic = withRequest(inputs, {});
		(cyclic.request as unknown as Record<string, unknown>).cycle = cyclic.request;
		buildIssue(cyclic, 'REQUEST_INVALID');

		const sparseSelection = [...inputs.request.selection.conditionalExportExplicitConditions];
		delete sparseSelection[0];
		buildIssue(
			withRequest(inputs, {
				selection: {
					...inputs.request.selection,
					conditionalExportExplicitConditions: sparseSelection as never
				}
			}),
			'REQUEST_INVALID'
		);
		const expando = [
			...inputs.request.selection.conditionalExportExplicitConditions
		] as string[] & {
			extra?: boolean;
		};
		expando.extra = true;
		buildIssue(
			withRequest(inputs, {
				selection: {
					...inputs.request.selection,
					conditionalExportExplicitConditions: expando as never
				}
			}),
			'REQUEST_INVALID'
		);
		const accessorArray = [...inputs.request.selection.conditionalExportExplicitConditions];
		let arrayGetterCalls = 0;
		Object.defineProperty(accessorArray, '0', {
			enumerable: true,
			get() {
				arrayGetterCalls += 1;
				return 'types';
			}
		});
		buildIssue(
			withRequest(inputs, {
				selection: {
					...inputs.request.selection,
					conditionalExportExplicitConditions: accessorArray as never
				}
			}),
			'REQUEST_INVALID'
		);
		expect(arrayGetterCalls).toBe(0);

		const symbolRecord = { ...inputs.request.importer } as Record<PropertyKey, unknown>;
		symbolRecord[Symbol('x')] = true;
		buildIssue(withRequest(inputs, { importer: symbolRecord as never }), 'REQUEST_INVALID');
		const invalidKey = { ...inputs.request.importer } as Record<string, unknown>;
		invalidKey['\ud800'] = true;
		buildIssue(withRequest(inputs, { importer: invalidKey as never }), 'REQUEST_INVALID');
		buildIssue(
			{ ...inputs, conditionalExportRequest: new Proxy(inputs.conditionalExportRequest, {}) },
			'REQUEST_INVALID'
		);
		const exoticArray = [...inputs.request.selection.conditionalExportExplicitConditions];
		Object.setPrototypeOf(exoticArray, null);
		buildIssue(
			withRequest(inputs, {
				selection: {
					...inputs.request.selection,
					conditionalExportExplicitConditions: exoticArray as never
				}
			}),
			'REQUEST_INVALID'
		);
		buildIssue(
			{
				...inputs,
				conditionalExportRequest: Object.assign(
					Object.create({ inherited: true }),
					inputs.conditionalExportRequest
				)
			},
			'REQUEST_INVALID'
		);
		const nestedAccessor = { ...inputs.conditionalExportRequest } as Record<string, unknown>;
		Object.defineProperty(nestedAccessor, 'conditions', {
			enumerable: true,
			get() {
				throw new Error('must not run');
			}
		});
		buildIssue({ ...inputs, conditionalExportRequest: nestedAccessor }, 'REQUEST_INVALID');
	});

	it('enforces ingress record and string budgets before semantic work', () => {
		const usage = plainUsage(inputs);
		buildIssue(
			withRequest(inputs, {
				budgets: { ...inputs.request.budgets, maxInputRecords: 6 }
			}),
			'BUDGET_EXCEEDED'
		);
		buildIssue(
			withRequest(inputs, {
				budgets: { ...inputs.request.budgets, maxInputRecords: Number.MAX_SAFE_INTEGER }
			}),
			'BUDGET_EXCEEDED'
		);
		buildIssue(
			withRequest(inputs, {
				budgets: { ...inputs.request.budgets, maxInputRecords: usage.records - 1 }
			}),
			'BUDGET_EXCEEDED'
		);
		buildIssue(
			withRequest(inputs, {
				budgets: {
					...inputs.request.budgets,
					maxInputStringCharacters: usage.stringCharacters - 1
				}
			}),
			'BUDGET_EXCEEDED'
		);
		buildIssue(
			withRequest(inputs, {
				budgets: { ...inputs.request.budgets, maxInputRecords: 0 }
			}),
			'REQUEST_INVALID'
		);
		buildIssue(
			withRequest(inputs, {
				budgets: {
					...inputs.request.budgets,
					maxInputStringCharacters: Number.MAX_SAFE_INTEGER + 1
				}
			}),
			'REQUEST_INVALID'
		);
	});

	it('roots the constructed predecessor chain in the strictest semantic budgets', () => {
		const publicGraphValidation = vi.spyOn(graphValidator, 'validateProjectContextGraph');
		const publicConditionalValidation = vi.spyOn(
			conditionalValidator,
			'validateConditionalExportResolution'
		);
		const projectContextGraph = {
			...inputs.projectContextGraph,
			budgets: {
				...inputs.projectContextGraph.budgets,
				maxDiagnostics: 17,
				maxInputRecords: 23,
				maxInputStringCharacters: 29
			}
		};

		expect(buildModuleResolutionTrace({ ...inputs, projectContextGraph }).outcome).toBe('partial');
		expect(semanticValidator.validateStaticSemanticSnapshot).toHaveBeenCalledOnce();
		expect(semanticValidator.validateStaticSemanticSnapshot).toHaveBeenCalledWith(
			inputs.semanticSnapshot,
			{
				maxDepth: 4_096,
				maxDiagnostics: 17,
				maxIssues: 17,
				maxRecords: 23,
				maxReferenceChecks: 23,
				maxStringCharacters: 29
			},
			{ frozenSubject: inputs.frozenSubject }
		);
		expect(graphValidator.validateConstructedProjectContextGraph).toHaveBeenCalledOnce();
		expect(
			conditionalValidator.validateConstructedConditionalExportResolution
		).toHaveBeenCalledOnce();
		expect(traceValidator.validateConstructedModuleResolutionTrace).toHaveBeenCalledOnce();
		const semanticCallOrder = vi.mocked(semanticValidator.validateStaticSemanticSnapshot).mock
			.invocationCallOrder[0]!;
		const graphCallOrder = vi.mocked(graphValidator.validateConstructedProjectContextGraph).mock
			.invocationCallOrder[0]!;
		const conditionalCallOrder = vi.mocked(
			conditionalValidator.validateConstructedConditionalExportResolution
		).mock.invocationCallOrder[0]!;
		const traceCallOrder = vi.mocked(traceValidator.validateConstructedModuleResolutionTrace).mock
			.invocationCallOrder[0]!;
		expect(semanticCallOrder).toBeLessThan(graphCallOrder);
		expect(graphCallOrder).toBeLessThan(conditionalCallOrder);
		expect(conditionalCallOrder).toBeLessThan(traceCallOrder);
		expect(publicGraphValidation).not.toHaveBeenCalled();
		expect(publicConditionalValidation).not.toHaveBeenCalled();
	});

	it('rejects malformed budgets, versions, selection profiles, names, and identities', () => {
		buildIssue(
			withRequest(inputs, {
				budgets: { ...inputs.request.budgets, maxDiagnostics: 100_001 }
			}),
			'REQUEST_INVALID'
		);
		buildIssue(
			withRequest(inputs, { operationVersion: 'unsupported' as never }),
			'UNSUPPORTED_REQUEST'
		);
		buildIssue(
			withRequest(inputs, {
				selection: { ...inputs.request.selection, compilerApi: 'unsupported' as never }
			}),
			'UNSUPPORTED_REQUEST'
		);
		for (const packageName of ['', './relative', 'scope/name/extra', 'white space'])
			buildIssue(withRequest(inputs, { packageName }), 'UNSUPPORTED_REQUEST');
		buildIssue(withRequest(inputs, { specifier: 'different-package' }), 'UNSUPPORTED_REQUEST');
		buildIssue(
			withRequest(inputs, {
				importer: { ...inputs.request.importer, semanticSourceId: '' as never }
			}),
			'REQUEST_INVALID'
		);
		buildIssue(
			withRequest(inputs, {
				projectContextGraph: { ...inputs.request.projectContextGraph, contentDigest: 'x' }
			}),
			'REQUEST_INVALID'
		);
	});

	it('maps each predecessor invalidity and budget exhaustion to its bounded diagnostic', () => {
		vi.mocked(semanticValidator.validateStaticSemanticSnapshot).mockReturnValueOnce({
			issues: [{ code: 'SHAPE_INVALID', message: 'bad', path: '$' }],
			state: 'INVALID'
		} as never);
		buildIssue(inputs, 'SEMANTIC_SNAPSHOT_INVALID');
		vi.mocked(semanticValidator.validateStaticSemanticSnapshot).mockReturnValueOnce({
			issues: [{ code: 'BUDGET_EXHAUSTED', message: 'budget', path: '$' }],
			state: 'BUDGET_EXHAUSTED'
		} as never);
		buildIssue(inputs, 'BUDGET_EXCEEDED');
		vi.mocked(graphValidator.validateConstructedProjectContextGraph).mockReturnValueOnce({
			issues: [{ code: 'DERIVATION_MISMATCH', message: 'bad', path: '$' }],
			state: 'INVALID'
		} as never);
		buildIssue(inputs, 'PROJECT_CONTEXT_GRAPH_INVALID');
		vi.mocked(graphValidator.validateConstructedProjectContextGraph).mockReturnValueOnce({
			issues: [{ code: 'BUDGET_EXHAUSTED', message: 'budget', path: '$' }],
			state: 'BUDGET_EXHAUSTED'
		});
		buildIssue(inputs, 'BUDGET_EXCEEDED');
		vi.mocked(
			conditionalValidator.validateConstructedConditionalExportResolution
		).mockReturnValueOnce({
			issues: [{ code: 'DERIVATION_MISMATCH', message: 'bad', path: '$' }],
			state: 'INVALID'
		});
		buildIssue(inputs, 'CONDITIONAL_EXPORT_RESOLUTION_INVALID');
		vi.mocked(
			conditionalValidator.validateConstructedConditionalExportResolution
		).mockReturnValueOnce({
			issues: [{ code: 'BUDGET_EXHAUSTED', message: 'budget', path: '$' }],
			state: 'BUDGET_EXHAUSTED'
		});
		buildIssue(inputs, 'BUDGET_EXCEEDED');
	});

	it('fails closed across static importer, target, workspace, and capture binding mismatches', () => {
		buildIssue(withRequest(inputs, { subjectId: '0'.repeat(64) }), 'INPUT_IDENTITY_MISMATCH');
		buildIssue(
			{
				...inputs,
				conditionalExportRequest: { ...inputs.conditionalExportRequest, conditions: [] }
			},
			'UNSUPPORTED_REQUEST'
		);
		buildIssue(
			{ ...inputs, semanticSnapshot: { ...inputs.semanticSnapshot, moduleResolutions: [] } },
			'INPUT_POPULATION_MISMATCH'
		);

		const selectedResolution = inputs.semanticSnapshot.moduleResolutions.find(
			(record) => record.id === inputs.request.importer.semanticModuleResolutionId
		)!;
		buildIssue(
			{
				...inputs,
				semanticSnapshot: {
					...inputs.semanticSnapshot,
					moduleResolutions: [
						...inputs.semanticSnapshot.moduleResolutions,
						{ ...selectedResolution, id: `${selectedResolution.id}-duplicate` }
					]
				}
			},
			'INPUT_POPULATION_MISMATCH'
		);
		buildIssue(
			{ ...inputs, semanticSnapshot: { ...inputs.semanticSnapshot, literals: [] } },
			'INPUT_IDENTITY_MISMATCH'
		);

		const target = inputs.semanticSnapshot.sources.find(
			(source) => source.logicalPath === MODULE_RESOLUTION_FIXTURE_TARGET_PATH
		)!;
		buildIssue(
			{
				...inputs,
				semanticSnapshot: {
					...inputs.semanticSnapshot,
					sources: inputs.semanticSnapshot.sources.map((source) =>
						source.id === target.id ? { ...source, declarationFile: false } : source
					)
				}
			},
			'TARGET_UNAVAILABLE'
		);

		vi.spyOn(
			compilerCapture,
			'getStaticSemanticSnapshotCompilerProjectInputLookup'
		).mockReturnValue(undefined);
		buildIssue(inputs, 'CAPTURE_INVALID');
		vi.mocked(compilerCapture.getStaticSemanticSnapshotCompilerProjectInputLookup).mockReturnValue(
			lookup
		);
		const badDigestLookup = {
			...lookup,
			attribution: { ...lookup.attribution, materializedRecipeDigest: '0'.repeat(64) }
		} as Lookup;
		vi.mocked(compilerCapture.getStaticSemanticSnapshotCompilerProjectInputLookup).mockReturnValue(
			badDigestLookup
		);
		buildIssue(inputs, 'CAPTURE_INVALID');
	});

	it('fails closed when captured importer evidence is absent or contradicts semantic bytes', () => {
		const importerPath = 'packages/consumer/src/index.ts';
		const missing = {
			...lookup,
			lookupAttributedQuery(query: CompilerInputQuery) {
				if (query.operation === 'READ_FILE' && query.logicalPath === importerPath) return undefined;
				return lookup.lookupAttributedQuery(query);
			}
		} as Lookup;
		vi.spyOn(
			compilerCapture,
			'getStaticSemanticSnapshotCompilerProjectInputLookup'
		).mockReturnValue(missing);
		buildIssue(inputs, 'CAPTURE_INVALID');

		const importer = inputs.semanticSnapshot.sources.find(
			(source) => source.logicalPath === importerPath
		)!;
		vi.mocked(compilerCapture.getStaticSemanticSnapshotCompilerProjectInputLookup).mockReturnValue(
			lookup
		);
		buildIssue(
			{
				...inputs,
				semanticSnapshot: {
					...inputs.semanticSnapshot,
					sources: inputs.semanticSnapshot.sources.map((source) =>
						source.id === importer.id ? { ...source, textLength: source.textLength + 1 } : source
					)
				}
			},
			'CAPTURE_INVALID'
		);
	});

	it('uses only capture-host callbacks and covers public host method semantics', () => {
		const absentRead = fakeEntry(
			{ logicalPath: 'packages/consumer/missing.json', operation: 'READ_FILE' },
			'ABSENT'
		)!;
		const getDirectories = {
			attributedInvocationCount: 1,
			observation: {
				id: `analysis:context-input-${'1'.repeat(64)}`,
				invocationCount: 1,
				logicalPath: 'packages/consumer',
				operation: 'GET_DIRECTORIES',
				origin: 'UNKNOWN',
				result: 'DIRECTORY',
				resultDigest: '2'.repeat(64),
				resultEntries: ['packages/consumer/src'],
				scannedEntries: 1
			},
			query: { logicalPath: 'packages/consumer', operation: 'GET_DIRECTORIES' }
		} as unknown as NonNullable<ReturnType<Lookup['lookupAttributedQuery']>>;
		const extraLookup = wrappedLookup(lookup, [absentRead, getDirectories]);
		vi.spyOn(
			compilerCapture,
			'getStaticSemanticSnapshotCompilerProjectInputLookup'
		).mockReturnValue(extraLookup);
		const originalImplied = moduleResolutionTraceTypeScriptPublicApi.getImpliedNodeFormatForFile;
		vi.spyOn(
			moduleResolutionTraceTypeScriptPublicApi,
			'getImpliedNodeFormatForFile'
		).mockImplementation(((
			fileName: string,
			cache: unknown,
			host: ts.ModuleResolutionHost,
			options: ts.CompilerOptions
		) => {
			expect(
				host.readFile?.(extraLookup.toRecordedAbsolute('packages/consumer/missing.json'))
			).toBeUndefined();
			expect(host.getDirectories?.(extraLookup.toRecordedAbsolute('packages/consumer'))).toEqual([
				extraLookup.toRecordedAbsolute('packages/consumer/src')
			]);
			return originalImplied(fileName, cache as never, host as never, options);
		}) as typeof ts.getImpliedNodeFormatForFile);
		const result = buildTrace(inputs);
		expect(result.attempts).toContainEqual(
			expect.objectContaining({ purpose: 'RESOLVER_INPUT', query: absentRead.query })
		);
		expect(result.attempts).toContainEqual(
			expect.objectContaining({ purpose: 'DIRECTORY_PROBE', query: getDirectories.query })
		);
	});

	it('parses package type only from one exact object-literal module assignment', () => {
		const cases = ['', '[]', '{type}', '{"type":"commonjs"}'].map((text, index) =>
			fakeEntry(
				{
					logicalPath: `packages/consumer/package-case-${index}/package.json`,
					operation: 'READ_FILE'
				},
				'PRESENT',
				text
			)
		) as NonNullable<ReturnType<Lookup['lookupAttributedQuery']>>[];
		const extraLookup = wrappedLookup(lookup, cases);
		vi.spyOn(
			compilerCapture,
			'getStaticSemanticSnapshotCompilerProjectInputLookup'
		).mockReturnValue(extraLookup);
		const originalImplied = moduleResolutionTraceTypeScriptPublicApi.getImpliedNodeFormatForFile;
		vi.spyOn(
			moduleResolutionTraceTypeScriptPublicApi,
			'getImpliedNodeFormatForFile'
		).mockImplementation(((fileName, cache, host, options) => {
			for (const entry of cases)
				host.readFile?.(extraLookup.toRecordedAbsolute(entry.query.logicalPath));
			return originalImplied(fileName, cache, host, options);
		}) as typeof ts.getImpliedNodeFormatForFile);
		expect(buildTrace(inputs).attempts).toHaveLength(trace.attempts.length + cases.length);
	});

	it('fails closed when the public TypeScript stages do not reproduce the supported environment', () => {
		vi.spyOn(
			moduleResolutionTraceTypeScriptPublicApi,
			'getImpliedNodeFormatForFile'
		).mockReturnValue(ts.ModuleKind.CommonJS);
		buildIssue(inputs, 'UNSUPPORTED_REQUEST');
		vi.mocked(moduleResolutionTraceTypeScriptPublicApi.getImpliedNodeFormatForFile).mockReturnValue(
			ts.ModuleKind.ESNext
		);
		buildIssue(inputs, 'UNSUPPORTED_REQUEST');

		vi.restoreAllMocks();
		validPredecessors();
		vi.spyOn(moduleResolutionTraceTypeScriptPublicApi, 'getModeForUsageLocation').mockReturnValue(
			ts.ModuleKind.CommonJS
		);
		buildIssue(inputs, 'UNSUPPORTED_REQUEST');

		vi.restoreAllMocks();
		validPredecessors();
		vi.spyOn(moduleResolutionTraceTypeScriptPublicApi, 'resolveModuleName').mockReturnValue({
			resolvedModule: undefined
		});
		buildIssue(inputs, 'RESOLUTION_UNAVAILABLE');
	});

	it(
		'rejects baseUrl, paths, and custom conditions in genuine compiler recipes',
		{ timeout: 90_000 },
		() => {
			vi.restoreAllMocks();
			for (const consumerCompilerOptions of [
				{ baseUrl: '.' },
				{ paths: { '@fixture/alias/*': ['src/*'] } },
				{ customConditions: ['x'.repeat(70_000)] }
			]) {
				const aliased = createModuleResolutionTraceFixture({ consumerCompilerOptions });
				try {
					const aliasedInputs = moduleResolutionTraceInputs(aliased);
					buildIssue(aliasedInputs, 'UNSUPPORTED_REQUEST');
					expectConstructedIssue(trace, aliasedInputs, 'INPUT_INVALID', trace.inputDigest);
				} finally {
					aliased.cleanup();
				}
			}
		}
	);

	it(
		'replays a genuine UTF-16LE rootDirs/project-reference recipe to a .d.mts target',
		{ timeout: 60_000 },
		() => {
			vi.restoreAllMocks();
			const variant = createModuleResolutionTraceFixture({
				consumerCompilerOptions: { rootDirs: ['src'] },
				consumerProjectReferences: ['../module-target'],
				consumerSourceEncoding: 'UTF16LE',
				targetDeclarationExtension: 'd.mts'
			});
			try {
				const variantInputs = moduleResolutionTraceInputs(variant);
				const variantTrace = buildTrace(variantInputs);
				expect(variantTrace.targetWitness.logicalPath).toBe(variant.targetPath);
				expect(traceValidator.validateModuleResolutionTrace(variantTrace, variantInputs)).toEqual({
					issues: [],
					state: 'VALID'
				});
			} finally {
				variant.cleanup();
			}
		}
	);

	it('replays a genuine UTF-16BE recipe to a .d.cts target', { timeout: 60_000 }, () => {
		vi.restoreAllMocks();
		const variant = createModuleResolutionTraceFixture({
			consumerSourceEncoding: 'UTF16BE',
			targetDeclarationExtension: 'd.cts'
		});
		try {
			const variantInputs = moduleResolutionTraceInputs(variant);
			const variantTrace = buildTrace(variantInputs);
			expect(variantTrace.targetWitness.logicalPath).toBe(variant.targetPath);
			expect(traceValidator.validateModuleResolutionTrace(variantTrace, variantInputs)).toEqual({
				issues: [],
				state: 'VALID'
			});
		} finally {
			variant.cleanup();
		}
	});

	it('publicly rejects a genuine CommonJS package context', { timeout: 60_000 }, () => {
		vi.restoreAllMocks();
		const variant = createModuleResolutionTraceFixture({
			consumerPackageType: 'commonjs'
		});
		try {
			expectValidationIssue(trace, moduleResolutionTraceInputs(variant), 'INPUT_INVALID');
		} finally {
			variant.cleanup();
		}
	});

	it('fails closed for target mismatch, unsupported extension, and missing selected callback', () => {
		const originalResolve = moduleResolutionTraceTypeScriptPublicApi.resolveModuleName;
		const importerAbsolute = lookup.toRecordedAbsolute('packages/consumer/src/index.ts');
		vi.spyOn(moduleResolutionTraceTypeScriptPublicApi, 'resolveModuleName').mockImplementation(((
			...args: Parameters<typeof ts.resolveModuleName>
		) => {
			const result = originalResolve(...args);
			return {
				...result,
				resolvedModule: result.resolvedModule && {
					...result.resolvedModule,
					resolvedFileName: importerAbsolute
				}
			};
		}) as typeof ts.resolveModuleName);
		buildIssue(inputs, 'TARGET_UNAVAILABLE');

		vi.restoreAllMocks();
		validPredecessors();
		vi.spyOn(moduleResolutionTraceTypeScriptPublicApi, 'resolveModuleName').mockImplementation(((
			...args: Parameters<typeof ts.resolveModuleName>
		) => {
			const result = originalResolve(...args);
			return {
				...result,
				resolvedModule: result.resolvedModule && {
					...result.resolvedModule,
					extension: ts.Extension.Ts
				}
			};
		}) as typeof ts.resolveModuleName);
		buildIssue(inputs, 'UNSUPPORTED_REQUEST');

		vi.restoreAllMocks();
		validPredecessors();
		vi.spyOn(moduleResolutionTraceTypeScriptPublicApi, 'resolveModuleName').mockImplementation(((
			_specifier,
			_importer,
			_options,
			host
		) => {
			if (typeof host.useCaseSensitiveFileNames === 'function') host.useCaseSensitiveFileNames();
			return {
				resolvedModule: {
					extension: ts.Extension.Dts,
					isExternalLibraryImport: true,
					resolvedFileName: lookup.toRecordedAbsolute(MODULE_RESOLUTION_FIXTURE_TARGET_PATH)
				}
			};
		}) as typeof ts.resolveModuleName);
		buildIssue(inputs, 'TARGET_UNAVAILABLE');
	});

	it('materializes absent and present-not-selected callback candidates with frozen precedence', () => {
		const absent = fakeEntry(
			{ logicalPath: 'packages/module-target/missing.d.ts', operation: 'FILE_EXISTS' },
			'ABSENT'
		)!;
		const present = fakeEntry(
			{ logicalPath: 'packages/module-target/other.d.ts', operation: 'FILE_EXISTS' },
			'PRESENT'
		)!;
		const extraLookup = wrappedLookup(lookup, [absent, present]);
		const observedQueries: CompilerInputQuery[] = [];
		const diagnosticLookup = {
			...extraLookup,
			lookupAttributedQuery(query: CompilerInputQuery) {
				observedQueries.push(query);
				return extraLookup.lookupAttributedQuery(query);
			}
		} as Lookup;
		vi.spyOn(
			compilerCapture,
			'getStaticSemanticSnapshotCompilerProjectInputLookup'
		).mockReturnValue(diagnosticLookup);
		const originalResolve = moduleResolutionTraceTypeScriptPublicApi.resolveModuleName;
		vi.spyOn(moduleResolutionTraceTypeScriptPublicApi, 'resolveModuleName').mockImplementation(((
			specifier,
			importer,
			options,
			host,
			...rest
		) => {
			host.fileExists(extraLookup.toRecordedAbsolute(absent.query.logicalPath));
			host.fileExists(extraLookup.toRecordedAbsolute(present.query.logicalPath));
			return originalResolve(specifier, importer, options, host, ...rest);
		}) as typeof ts.resolveModuleName);
		const outcome = buildModuleResolutionTrace(inputs);
		if (outcome.outcome !== 'partial')
			throw new Error(JSON.stringify({ observedQueries, outcome }));
		const result = outcome.trace;
		expect(result.candidates).toContainEqual(
			expect.objectContaining({
				exclusionReason: 'FILE_ABSENT',
				logicalPath: absent.query.logicalPath
			})
		);
		expect(result.candidates).toContainEqual(
			expect.objectContaining({
				exclusionReason: 'PRESENT_NOT_SELECTED',
				logicalPath: present.query.logicalPath
			})
		);
	});

	it('requires the exact FrozenSubject capability and exact importer semantic binding', () => {
		buildIssue({ ...inputs, frozenSubject: { ...inputs.frozenSubject } }, 'REQUEST_INVALID');
		const selected = inputs.semanticSnapshot.moduleResolutions.find(
			(record) => record.id === inputs.request.importer.semanticModuleResolutionId
		)!;
		buildIssue(
			{
				...inputs,
				semanticSnapshot: {
					...inputs.semanticSnapshot,
					moduleResolutions: inputs.semanticSnapshot.moduleResolutions.map((record) =>
						record.id === selected.id ? { ...record, typeOnly: true } : record
					)
				}
			},
			'INPUT_IDENTITY_MISMATCH'
		);
	});

	it('requires captured importer bytes to reproduce the exact semantic literal span', () => {
		vi.spyOn(
			compilerCapture,
			'getStaticSemanticSnapshotCompilerProjectInputLookup'
		).mockReturnValue(lookup);
		buildIssue(
			{
				...inputs,
				semanticSnapshot: {
					...inputs.semanticSnapshot,
					astNodes: inputs.semanticSnapshot.astNodes.map((node) =>
						node.id === inputs.request.importer.specifierNodeId
							? { ...node, start: node.start + 1 }
							: node
					)
				}
			},
			'INPUT_IDENTITY_MISMATCH'
		);
	});

	it('requires a relative CAP-012 target that equals the semantic workspace target', () => {
		buildIssue(
			{
				...inputs,
				conditionalExportResolution: {
					...inputs.conditionalExportResolution,
					decision: { ...inputs.conditionalExportResolution.decision, target: 'dist/index.d.ts' }
				}
			},
			'UNSUPPORTED_REQUEST'
		);
		buildIssue(
			{
				...inputs,
				conditionalExportResolution: {
					...inputs.conditionalExportResolution,
					decision: { ...inputs.conditionalExportResolution.decision, target: './wrong.d.ts' }
				}
			},
			'INPUT_IDENTITY_MISMATCH'
		);
	});

	it('fails closed when recorded path materialization or importer metadata contradicts capture', () => {
		const throwingLookup = {
			...lookup,
			toRecordedAbsolute(path: string) {
				if (path.endsWith('tsconfig.json')) throw new TypeError('outside recorded authority');
				return lookup.toRecordedAbsolute(path);
			}
		} as Lookup;
		vi.spyOn(
			compilerCapture,
			'getStaticSemanticSnapshotCompilerProjectInputLookup'
		).mockReturnValue(throwingLookup);
		buildIssue(inputs, 'CAPTURE_INVALID');

		vi.mocked(compilerCapture.getStaticSemanticSnapshotCompilerProjectInputLookup).mockReturnValue(
			lookup
		);
		const importer = inputs.semanticSnapshot.sources.find(
			(source) => source.logicalPath === 'packages/consumer/src/index.ts'
		)!;
		buildIssue(
			{
				...inputs,
				semanticSnapshot: {
					...inputs.semanticSnapshot,
					sources: inputs.semanticSnapshot.sources.map((source) =>
						source.id === importer.id ? { ...source, bytes: source.bytes + 1 } : source
					)
				}
			},
			'CAPTURE_INVALID'
		);
	});

	it('internally fault-injects captured UTF-16 decoding, including incomplete code units', () => {
		const importerPath = 'packages/consumer/src/index.ts';
		const originalEntry = lookup.lookupAttributedQuery({
			logicalPath: importerPath,
			operation: 'READ_FILE'
		})!;
		const text = new TextDecoder().decode(originalEntry.bytes!);
		const utf16 = (littleEndian: boolean): Uint8Array => {
			const bytes = new Uint8Array(2 + text.length * 2);
			bytes[0] = littleEndian ? 0xff : 0xfe;
			bytes[1] = littleEndian ? 0xfe : 0xff;
			for (let index = 0; index < text.length; index += 1) {
				const code = text.charCodeAt(index);
				bytes[2 + index * 2] = littleEndian ? code & 0xff : code >>> 8;
				bytes[3 + index * 2] = littleEndian ? code >>> 8 : code & 0xff;
			}
			return bytes;
		};
		const encodedCase = (bytes: Uint8Array): ModuleResolutionTraceBuildInputs => {
			const observation = {
				...originalEntry.observation,
				contentBytes: bytes.byteLength,
				contentSha256: sha256(bytes)
			};
			const encodedLookup = wrappedLookup(lookup, [
				{ ...originalEntry, bytes, observation } as NonNullable<
					ReturnType<Lookup['lookupAttributedQuery']>
				>
			]);
			vi.spyOn(
				compilerCapture,
				'getStaticSemanticSnapshotCompilerProjectInputLookup'
			).mockReturnValue(encodedLookup);
			return {
				...inputs,
				semanticSnapshot: {
					...inputs.semanticSnapshot,
					sources: inputs.semanticSnapshot.sources.map((source) =>
						source.logicalPath === importerPath
							? {
									...source,
									bytes: bytes.byteLength,
									contentSha256: sha256(bytes)
								}
							: source
					)
				}
			};
		};

		buildTrace(encodedCase(utf16(true)));
		vi.mocked(compilerCapture.getStaticSemanticSnapshotCompilerProjectInputLookup).mockRestore();
		buildTrace(encodedCase(utf16(false)));
		vi.mocked(compilerCapture.getStaticSemanticSnapshotCompilerProjectInputLookup).mockRestore();
		buildIssue(encodedCase(Uint8Array.of(0xff, 0xfe, 0x41)), 'CAPTURE_INVALID');
		vi.mocked(compilerCapture.getStaticSemanticSnapshotCompilerProjectInputLookup).mockRestore();
		buildIssue(encodedCase(Uint8Array.of(0xfe, 0xff, 0x41)), 'CAPTURE_INVALID');
	});

	it('fails closed for a missing, corrupt, over-budget, or out-of-authority host query', () => {
		const missingLookup = {
			...lookup,
			lookupAttributedQuery(query: CompilerInputQuery) {
				if (query.operation === 'DIRECTORY_EXISTS' && query.logicalPath === 'packages/consumer/src')
					return undefined;
				return lookup.lookupAttributedQuery(query);
			}
		} as Lookup;
		vi.spyOn(
			compilerCapture,
			'getStaticSemanticSnapshotCompilerProjectInputLookup'
		).mockReturnValue(missingLookup);
		buildIssue(inputs, 'RESOLUTION_UNAVAILABLE');

		const corruptLookup = {
			...lookup,
			lookupAttributedQuery(query: CompilerInputQuery) {
				const entry = lookup.lookupAttributedQuery(query);
				if (
					entry !== undefined &&
					entry.bytes !== undefined &&
					query.operation === 'READ_FILE' &&
					query.logicalPath === 'packages/consumer/package.json'
				) {
					const bytes = entry.bytes.slice();
					bytes[0] = bytes[0]! ^ 1;
					return { ...entry, bytes };
				}
				return entry;
			}
		} as Lookup;
		vi.mocked(compilerCapture.getStaticSemanticSnapshotCompilerProjectInputLookup).mockReturnValue(
			corruptLookup
		);
		buildIssue(inputs, 'CAPTURE_INVALID');

		vi.mocked(compilerCapture.getStaticSemanticSnapshotCompilerProjectInputLookup).mockReturnValue(
			lookup
		);
		buildIssue(
			withRequest(inputs, {
				budgets: { ...inputs.request.budgets, maxReadBytes: 79 }
			}),
			'BUDGET_EXCEEDED'
		);
		buildIssue(
			withRequest(inputs, {
				budgets: { ...inputs.request.budgets, maxReadBytes: 77 }
			}),
			'BUDGET_EXCEEDED'
		);

		const outsideLookup = {
			...lookup,
			toRecordedLogical() {
				throw new TypeError('outside recorded authority');
			}
		} as Lookup;
		vi.mocked(compilerCapture.getStaticSemanticSnapshotCompilerProjectInputLookup).mockReturnValue(
			outsideLookup
		);
		buildIssue(inputs, 'RESOLUTION_UNAVAILABLE');
	});

	it('fails closed for an out-of-authority resolver target and contradictory target READ_FILE', () => {
		vi.spyOn(moduleResolutionTraceTypeScriptPublicApi, 'resolveModuleName').mockImplementation(((
			_specifier,
			_importer,
			_options,
			host
		) => {
			if (typeof host.useCaseSensitiveFileNames === 'function') host.useCaseSensitiveFileNames();
			return {
				resolvedModule: {
					extension: ts.Extension.Dts,
					isExternalLibraryImport: true,
					resolvedFileName: 'C:/outside/not-recorded.d.ts'
				}
			};
		}) as typeof ts.resolveModuleName);
		buildIssue(inputs, 'TARGET_UNAVAILABLE');

		vi.restoreAllMocks();
		validPredecessors();
		const targetReadMismatch = {
			...lookup,
			lookupAttributedQuery(query: CompilerInputQuery) {
				const entry = lookup.lookupAttributedQuery(query);
				if (
					entry !== undefined &&
					query.operation === 'READ_FILE' &&
					query.logicalPath === MODULE_RESOLUTION_FIXTURE_TARGET_PATH
				)
					return {
						...entry,
						observation: { ...entry.observation, origin: 'UNKNOWN' as const }
					};
				return entry;
			}
		} as Lookup;
		vi.spyOn(
			compilerCapture,
			'getStaticSemanticSnapshotCompilerProjectInputLookup'
		).mockReturnValue(targetReadMismatch);
		buildIssue(inputs, 'TARGET_UNAVAILABLE');
	});

	it('maps constructed self-validation invalidity and exhaustion without partial output', () => {
		vi.mocked(traceValidator.validateConstructedModuleResolutionTrace).mockReturnValueOnce({
			issues: [{ code: 'DERIVATION_MISMATCH', message: 'bad', path: '$.trace' }],
			state: 'INVALID'
		});
		buildIssue(inputs, 'TRACE_VALIDATION_FAILED');
		vi.mocked(traceValidator.validateConstructedModuleResolutionTrace).mockReturnValueOnce({
			issues: [{ code: 'BUDGET_EXHAUSTED', message: 'budget', path: '$.trace' }],
			state: 'BUDGET_EXHAUSTED'
		});
		buildIssue(inputs, 'BUDGET_EXCEEDED');
	});

	it('rejects digest-redigested semantic derivation tampering independently', () => {
		vi.restoreAllMocks();
		const mutated = mutableTrace(trace);
		(mutated.candidates[0] as { exclusionReason: string }).exclusionReason = 'FILE_ABSENT';
		(mutated as { contentDigest: string }).contentDigest =
			moduleResolutionTraceContentDigest(mutated);
		const result = traceValidator.validateModuleResolutionTrace(mutated, inputs);
		expect(result.state).toBe('INVALID');
		if (result.state === 'INVALID') expect(result.issues[0]?.code).toBe('DERIVATION_MISMATCH');
	});

	it('validates descriptor trees, closed options, dense arrays, and inert properties fail-closed', () => {
		expectValidationIssue(trace, inputs, 'SHAPE_INVALID', null as never);
		expectValidationIssue(trace, inputs, 'SHAPE_INVALID', new Proxy({}, {}) as never);
		expectValidationIssue(trace, inputs, 'SHAPE_INVALID', { unknown: 1 } as never);
		expectValidationIssue(trace, inputs, 'SHAPE_INVALID', { maxIssues: 100_001 });
		const optionAccessor = {};
		Object.defineProperty(optionAccessor, 'maxDepth', {
			enumerable: true,
			get() {
				throw new Error('must not run');
			}
		});
		expectValidationIssue(trace, inputs, 'SHAPE_INVALID', optionAccessor);

		expectValidationIssue({ value: '\ud800' }, inputs, 'SHAPE_INVALID');
		expectValidationIssue({ value: undefined }, inputs, 'SHAPE_INVALID');
		expectValidationIssue({ value: new Proxy({}, {}) }, inputs, 'SHAPE_INVALID');
		const cycle: Record<string, unknown> = {};
		cycle.self = cycle;
		expectValidationIssue(cycle, inputs, 'SHAPE_INVALID');
		const exoticArray: unknown[] = [];
		Object.setPrototypeOf(exoticArray, null);
		expectValidationIssue({ value: exoticArray }, inputs, 'SHAPE_INVALID');
		const exoticRecord = Object.assign(Object.create({ inherited: true }), { value: 1 });
		expectValidationIssue({ value: exoticRecord }, inputs, 'SHAPE_INVALID');
		const symbolRecord: Record<PropertyKey, unknown> = { value: 1 };
		symbolRecord[Symbol('x')] = 2;
		expectValidationIssue(symbolRecord, inputs, 'SHAPE_INVALID');
		const invalidKey: Record<string, unknown> = {};
		invalidKey['\ud800'] = true;
		expectValidationIssue(invalidKey, inputs, 'SHAPE_INVALID');
		const sparse = [1, 2];
		delete sparse[0];
		expectValidationIssue(sparse, inputs, 'SHAPE_INVALID');
		const expando = [1] as number[] & { extra?: boolean };
		expando.extra = true;
		expectValidationIssue(expando, inputs, 'SHAPE_INVALID');
		const accessor = { value: 1 };
		Object.defineProperty(accessor, 'value', {
			enumerable: true,
			get() {
				throw new Error('must not run');
			}
		});
		expectValidationIssue(accessor, inputs, 'SHAPE_INVALID');

		expectValidationIssue({ a: { b: {} } }, inputs, 'BUDGET_EXHAUSTED', { maxDepth: 1 });
		expectValidationIssue({ a: 'long' }, inputs, 'BUDGET_EXHAUSTED', {
			maxStringCharacters: 2
		});
		expectValidationIssue([1, 2], inputs, 'BUDGET_EXHAUSTED', { maxRecords: 2 });
		expectValidationIssue({ a: 1, b: 2 }, inputs, 'BUDGET_EXHAUSTED', { maxRecords: 2 });
		expectValidationIssue({ long: 1 }, inputs, 'BUDGET_EXHAUSTED', {
			maxStringCharacters: 1
		});
	});

	it('validates exact input/request shells, identities, constants, and supported criterion', () => {
		vi.mocked(traceValidator.validateConstructedModuleResolutionTrace).mockRestore();
		expectValidationIssue(trace, null, 'INPUT_INVALID');
		expectValidationIssue(trace, { ...inputs, extra: true }, 'INPUT_INVALID');
		expectValidationIssue(trace, { ...inputs, conditionalExportRequest: null }, 'INPUT_INVALID');
		expectValidationIssue(trace, withRequest(inputs, { extra: true } as never), 'INPUT_INVALID');
		expectValidationIssue(
			trace,
			withRequest(inputs, { budgets: { ...inputs.request.budgets, maxDiagnostics: 100_001 } }),
			'INPUT_INVALID'
		);
		expectValidationIssue(
			trace,
			withRequest(inputs, { packageName: './relative' }),
			'INPUT_INVALID'
		);
		expectValidationIssue(
			trace,
			withRequest(inputs, {
				importer: { ...inputs.request.importer, semanticSourceId: '' as never }
			}),
			'INPUT_INVALID'
		);
		expectValidationIssue(
			trace,
			{ ...inputs, frozenSubject: { ...inputs.frozenSubject } },
			'INPUT_INVALID'
		);
		expectConstructedIssue(
			trace,
			withRequest(inputs, { subjectId: 'f'.repeat(64) }),
			'IDENTITY_MISMATCH',
			trace.inputDigest
		);
		expectValidationIssue(
			trace,
			{
				...inputs,
				conditionalExportRequest: { ...inputs.conditionalExportRequest, conditions: [] }
			},
			'INPUT_INVALID'
		);
	});

	it('validates public and constructed arity, known digest, identity, and content domains', () => {
		vi.mocked(traceValidator.validateConstructedModuleResolutionTrace).mockRestore();
		const publicCall = traceValidator.validateModuleResolutionTrace as (
			...args: unknown[]
		) => ReturnType<typeof traceValidator.validateModuleResolutionTrace>;
		expect(publicCall(trace).issues[0]?.code).toBe('SHAPE_INVALID');
		const constructedCall = traceValidator.validateConstructedModuleResolutionTrace as (
			...args: unknown[]
		) => ReturnType<typeof traceValidator.validateConstructedModuleResolutionTrace>;
		expect(constructedCall(trace, inputs).issues[0]?.code).toBe('SHAPE_INVALID');
		expectConstructedIssue(trace, inputs, 'SHAPE_INVALID', 'not-a-digest');
		expectConstructedIssue(trace, inputs, 'IDENTITY_MISMATCH', 'f'.repeat(64));

		const identityMismatch = mutableTrace(trace);
		(identityMismatch as { inputDigest: string }).inputDigest = '0'.repeat(64);
		expectConstructedIssue(identityMismatch, inputs, 'IDENTITY_MISMATCH', trace.inputDigest);
		const contentMismatch = mutableTrace(trace);
		(contentMismatch as { contentDigest: string }).contentDigest = '0'.repeat(64);
		expectConstructedIssue(contentMismatch, inputs, 'CONTENT_DIGEST_MISMATCH', trace.inputDigest);
	});

	it(
		'publicly rejects a missing importer criterion and detached compiler-capture capability',
		{ timeout: 60_000 },
		() => {
			vi.restoreAllMocks();
			expectValidationIssue(
				trace,
				withRequest(inputs, {
					importer: {
						...inputs.request.importer,
						semanticModuleResolutionId: 'missing-semantic-module-resolution' as never
					}
				}),
				'INPUT_INVALID'
			);
			expectValidationIssue(
				trace,
				{ ...inputs, semanticSnapshot: structuredClone(inputs.semanticSnapshot) },
				'INPUT_INVALID'
			);
			const alternateContextSource = inputs.projectContextGraph.sources.find(
				(source) => source.id !== inputs.request.importer.projectContextSourceId
			)!;
			expectValidationIssue(
				trace,
				withRequest(inputs, {
					importer: {
						...inputs.request.importer,
						projectContextSourceId: alternateContextSource.id
					}
				}),
				'INPUT_INVALID'
			);
		}
	);

	it('fails closed when capture or predecessor dependencies throw', { timeout: 60_000 }, () => {
		vi.restoreAllMocks();
		vi.spyOn(
			compilerCapture,
			'getStaticSemanticSnapshotCompilerProjectInputLookup'
		).mockImplementation(() => {
			throw new Error('capture capability failure');
		});
		expectValidationIssue(trace, inputs, 'INPUT_INVALID');

		vi.restoreAllMocks();
		vi.spyOn(conditionalValidator, 'validateConditionalExportResolution').mockImplementation(() => {
			throw new Error('predecessor validation failure');
		});
		expectValidationIssue(trace, inputs, 'SHAPE_INVALID');
	});

	it('publicly rejects an unavailable exact importer capture query', { timeout: 60_000 }, () => {
		vi.restoreAllMocks();
		const missingImporterLookup = {
			...lookup,
			lookupAttributedQuery(query: CompilerInputQuery) {
				if (
					query.operation === 'READ_FILE' &&
					query.logicalPath === 'packages/consumer/src/index.ts'
				)
					return undefined;
				return lookup.lookupAttributedQuery(query);
			}
		} as Lookup;
		vi.spyOn(
			compilerCapture,
			'getStaticSemanticSnapshotCompilerProjectInputLookup'
		).mockReturnValue(missingImporterLookup);
		expectValidationIssue(trace, inputs, 'INPUT_INVALID');
	});

	it(
		'publicly rejects missing or corrupt exact resolver capture evidence',
		{ timeout: 60_000 },
		() => {
			vi.restoreAllMocks();
			const missingLookup = {
				...lookup,
				lookupAttributedQuery(query: CompilerInputQuery) {
					if (
						query.operation === 'DIRECTORY_EXISTS' &&
						query.logicalPath === 'packages/consumer/src'
					)
						return undefined;
					return lookup.lookupAttributedQuery(query);
				}
			} as Lookup;
			const captureSpy = vi
				.spyOn(compilerCapture, 'getStaticSemanticSnapshotCompilerProjectInputLookup')
				.mockReturnValue(missingLookup);
			expectValidationIssue(trace, inputs, 'INPUT_INVALID');

			const corruptLookup = {
				...lookup,
				lookupAttributedQuery(query: CompilerInputQuery) {
					const entry = lookup.lookupAttributedQuery(query);
					if (
						entry !== undefined &&
						entry.bytes !== undefined &&
						query.operation === 'READ_FILE' &&
						query.logicalPath === 'packages/consumer/package.json'
					) {
						const bytes = entry.bytes.slice();
						bytes[0] = bytes[0]! ^ 1;
						return { ...entry, bytes };
					}
					return entry;
				}
			} as Lookup;
			captureSpy.mockReturnValue(corruptLookup);
			expectValidationIssue(trace, inputs, 'INPUT_INVALID');
		}
	);

	it(
		'independently enforces each reachable replay and final-target budget frontier',
		{ timeout: 60_000 },
		() => {
			vi.restoreAllMocks();
			const exhausted = (budgetOverrides: Partial<typeof inputs.request.budgets>): void =>
				expectConstructedIssue(
					trace,
					withRequest(inputs, {
						budgets: { ...inputs.request.budgets, ...budgetOverrides }
					}),
					'BUDGET_EXHAUSTED',
					trace.inputDigest
				);
			exhausted({ maxAttempts: 1 });
			exhausted({ maxCandidates: 1 });
			exhausted({ maxReadBytes: trace.importerWitness.bytes - 1 });
			exhausted({ maxReadBytes: trace.importerWitness.bytes });
			exhausted({ maxAstNodes: 1 });
			exhausted({
				maxReadBytes:
					trace.coverage.readBytes - trace.targetWitness.targetRead.observation.contentBytes
			});
		}
	);

	it('rejects exact-shell, dense-array, broad-input, and request-budget boundary violations', () => {
		vi.mocked(traceValidator.validateConstructedModuleResolutionTrace).mockRestore();
		expectValidationIssue({}, inputs, 'SHAPE_INVALID');
		const nonCanonicalIndex = [1];
		delete nonCanonicalIndex[0];
		Object.defineProperty(nonCanonicalIndex, '01', {
			enumerable: true,
			value: 1
		});
		expectValidationIssue(nonCanonicalIndex, inputs, 'SHAPE_INVALID');
		expectValidationIssue(
			trace,
			{
				...inputs,
				semanticSnapshot: { ...inputs.semanticSnapshot, unexpected: undefined }
			},
			'INPUT_INVALID'
		);
		const usage = plainUsage(inputs);
		expectConstructedIssue(
			trace,
			withRequest(inputs, {
				budgets: {
					...inputs.request.budgets,
					maxInputRecords: usage.records - 1
				}
			}),
			'BUDGET_EXHAUSTED',
			trace.inputDigest
		);
	});
});
