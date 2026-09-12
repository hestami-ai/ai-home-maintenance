import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type {
	ConditionalExportResolutionBuildInputs,
	ConditionalExportResolutionDiagnosticCode,
	ConditionalExportResolutionRequest,
	ConditionalExportResolutionSnapshot,
	ConditionalExportResolutionValidationIssueCode,
	ConditionalExportResolutionValidationOptions
} from '../contracts/conditional-export-resolution.js';
import { projectContextGraphContentDigest } from '../graph/project-context-graph-canonical.js';
import * as projectContextValidator from '../graph/validate-project-context-graph.js';
import { buildConditionalExportResolution } from './build-conditional-export-resolution.js';
import {
	conditionalExportBranchId,
	conditionalExportDecisionId,
	conditionalExportFrontierId,
	conditionalExportResolutionContentDigest,
	conditionalExportResolutionId,
	conditionalExportResolutionInputDigest
} from './conditional-export-resolution-canonical.js';
import {
	CONDITIONAL_EXPORT_FIXTURE_PACKAGE_NAME,
	conditionalExportResolutionInputs,
	createConditionalExportResolutionFixture,
	type ConditionalExportResolutionFixture
} from './conditional-export-resolution-fixture.test-support.js';
import {
	validateConditionalExportResolution,
	validateConstructedConditionalExportResolution
} from './validate-conditional-export-resolution.js';

function manifestWithExports(exportsSource: string): string {
	return `{
  "name": "${CONDITIONAL_EXPORT_FIXTURE_PACKAGE_NAME}",
  "private": true,
  "type": "module",
  "version": "0.0.0",
  "exports": ${exportsSource}
}\n`;
}

function expectResolution(
	inputs: ConditionalExportResolutionBuildInputs
): ConditionalExportResolutionSnapshot {
	const outcome = buildConditionalExportResolution(inputs);
	expect(outcome.outcome).toBe('partial');
	if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
	expect(validateConditionalExportResolution(outcome.resolution, inputs)).toEqual({
		issues: [],
		state: 'VALID'
	});
	return outcome.resolution;
}

function expectBuildIssue(value: unknown, code: ConditionalExportResolutionDiagnosticCode): void {
	const outcome = buildConditionalExportResolution(value);
	expect(outcome.outcome).toBe('unavailable');
	if (outcome.outcome === 'unavailable') expect(outcome.diagnostics[0]?.code).toBe(code);
}

function expectValidationIssue(
	value: unknown,
	inputsValue: unknown,
	code: ConditionalExportResolutionValidationIssueCode,
	options?: ConditionalExportResolutionValidationOptions
): void {
	const result = validateConditionalExportResolution(
		value,
		inputsValue as ConditionalExportResolutionBuildInputs,
		options
	);
	expect(result.state).toBe(code === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXHAUSTED' : 'INVALID');
	if (result.state !== 'VALID') expect(result.issues[0]?.code).toBe(code);
}

function requestClone(
	inputs: ConditionalExportResolutionBuildInputs,
	overrides: Partial<ConditionalExportResolutionRequest> = {}
): ConditionalExportResolutionRequest {
	return {
		...inputs.request,
		budgets: { ...inputs.request.budgets },
		conditions: [...inputs.request.conditions],
		consumer: { ...inputs.request.consumer },
		projectContextGraph: { ...inputs.request.projectContextGraph },
		...overrides
	};
}

function withRequest(
	inputs: ConditionalExportResolutionBuildInputs,
	overrides: Partial<ConditionalExportResolutionRequest>
): ConditionalExportResolutionBuildInputs {
	return { ...inputs, request: requestClone(inputs, overrides) };
}

function mutableResolution(
	value: ConditionalExportResolutionSnapshot
): ConditionalExportResolutionSnapshot {
	return JSON.parse(JSON.stringify(value)) as ConditionalExportResolutionSnapshot;
}

describe('conditional-export resolution boundary coverage', { timeout: 30_000 }, () => {
	let fixture: ConditionalExportResolutionFixture;
	let inputs: ConditionalExportResolutionBuildInputs;
	let graph: ConditionalExportResolutionSnapshot;

	beforeAll(() => {
		fixture = createConditionalExportResolutionFixture();
		inputs = conditionalExportResolutionInputs(fixture);
		graph = expectResolution(inputs);
	});

	afterAll(() => {
		fixture.cleanup();
	});

	it('derives every canonical identity and digest domain deterministically', () => {
		const binding = {
			consumerEnvironment: graph.consumerEnvironment,
			manifestWitness: graph.manifestWitness
		};
		const inputDigest = conditionalExportResolutionInputDigest(inputs, binding);
		const id = conditionalExportResolutionId({
			inputDigest,
			semanticSnapshotId: graph.semanticSnapshotId,
			subjectId: graph.subjectId
		});
		expect(inputDigest).toBe(graph.inputDigest);
		expect(id).toBe(graph.id);
		for (const branch of graph.branches)
			expect(
				conditionalExportBranchId(id, {
					conditionPath: branch.conditionPath,
					declarationOrdinal: branch.declarationOrdinal,
					keySpan: branch.keySpan,
					ordinal: branch.ordinal,
					valueKind: branch.valueKind,
					valueSpan: branch.valueSpan
				})
			).toBe(branch.id);
		expect(conditionalExportDecisionId(id)).toBe(graph.decision.id);
		for (const frontier of graph.frontiers)
			expect(
				conditionalExportFrontierId(id, {
					declarationOrdinal: frontier.declarationOrdinal,
					declarationPath: frontier.declarationPath,
					ordinal: frontier.ordinal,
					reason: frontier.reason,
					sourceSpan: frontier.sourceSpan
				})
			).toBe(frontier.id);
		expect(conditionalExportResolutionContentDigest(graph)).toBe(graph.contentDigest);
	});

	it('uses public CAP-010 validation exactly once and skips only that duplicate in constructed validation', () => {
		const spy = vi.spyOn(projectContextValidator, 'validateProjectContextGraph');
		try {
			spy.mockClear();
			expect(buildConditionalExportResolution(inputs).outcome).toBe('partial');
			expect(spy).toHaveBeenCalledTimes(1);
			spy.mockClear();
			expect(validateConditionalExportResolution(graph, inputs).state).toBe('VALID');
			expect(spy).toHaveBeenCalledTimes(1);
			spy.mockClear();
			expect(
				validateConstructedConditionalExportResolution(graph, inputs, graph.inputDigest).state
			).toBe('VALID');
			expect(spy).not.toHaveBeenCalled();
		} finally {
			spy.mockRestore();
		}
	});

	it('distinguishes content corruption, redigested derivation corruption, and signature failure', () => {
		const corrupted = mutableResolution(graph);
		(corrupted.decision as { target: string | null }).target = './dist/tampered.js';
		const contentFailure = validateConditionalExportResolution(corrupted, inputs);
		expect(contentFailure.state).toBe('INVALID');
		if (contentFailure.state !== 'VALID')
			expect(contentFailure.issues[0]?.code).toBe('CONTENT_DIGEST_MISMATCH');
		(corrupted as { contentDigest: string }).contentDigest =
			conditionalExportResolutionContentDigest(corrupted);
		const derivationFailure = validateConditionalExportResolution(corrupted, inputs);
		expect(derivationFailure.state).toBe('INVALID');
		if (derivationFailure.state !== 'VALID')
			expect(derivationFailure.issues[0]?.code).toBe('DERIVATION_MISMATCH');
		const call = validateConditionalExportResolution as unknown as (...args: unknown[]) => {
			readonly state: string;
		};
		expect(call(graph).state).toBe('INVALID');
		expect(call(graph, inputs, {}, 'extra').state).toBe('INVALID');
		const constructed = validateConstructedConditionalExportResolution as unknown as (
			...args: unknown[]
		) => { readonly state: string };
		expect(constructed(graph, inputs, 'not-a-digest').state).toBe('INVALID');
		expect(constructed(graph, inputs, '0'.repeat(64)).state).toBe('INVALID');
		const identityCorruption = mutableResolution(graph);
		(identityCorruption as { id: string }).id = 'conditional-export-resolution-tampered';
		const identityFailure = validateConditionalExportResolution(identityCorruption, inputs);
		expect(identityFailure.state).toBe('INVALID');
		if (identityFailure.state !== 'VALID')
			expect(identityFailure.issues[0]?.code).toBe('IDENTITY_MISMATCH');
	});

	it('fails closed before invoking accessors and rejects proxies, cycles, sparse arrays, and symbols', () => {
		let getterCalls = 0;
		const accessor = { ...inputs } as Record<string, unknown>;
		Object.defineProperty(accessor, 'request', {
			enumerable: true,
			get() {
				getterCalls += 1;
				return inputs.request;
			}
		});
		expectBuildIssue(accessor, 'REQUEST_INVALID');
		expect(getterCalls).toBe(0);

		expectBuildIssue({ ...inputs, request: new Proxy(inputs.request, {}) }, 'REQUEST_INVALID');

		const cyclicConditions: unknown[] = ['source'];
		cyclicConditions.push(cyclicConditions);
		expectBuildIssue(
			withRequest(inputs, { conditions: cyclicConditions as readonly string[] }),
			'REQUEST_INVALID'
		);

		const sparse = [...inputs.request.conditions];
		delete sparse[1];
		expectBuildIssue(withRequest(inputs, { conditions: sparse }), 'REQUEST_INVALID');

		const expando = [...inputs.request.conditions] as string[] & { extra?: string };
		expando.extra = 'not-an-index';
		expectBuildIssue(withRequest(inputs, { conditions: expando }), 'REQUEST_INVALID');

		const symbolRequest = requestClone(inputs) as ConditionalExportResolutionRequest & {
			[Symbol.iterator]?: string;
		};
		symbolRequest[Symbol.iterator] = 'symbol';
		expectBuildIssue({ ...inputs, request: symbolRequest }, 'REQUEST_INVALID');
	});

	it('covers builder descriptor ingress and exact request guards without invoking hostile values', () => {
		const exoticInput = { ...inputs };
		Object.setPrototypeOf(exoticInput, Date.prototype);
		expectBuildIssue(exoticInput, 'REQUEST_INVALID');
		expectBuildIssue({ ...inputs, frozenSubject: [] }, 'REQUEST_INVALID');
		expectBuildIssue(
			withRequest(inputs, { conditions: { 0: 'source', length: 1 } as never }),
			'REQUEST_INVALID'
		);

		for (const key of ['maxInputRecords', 'maxInputStringCharacters'] as const)
			expectBuildIssue(
				withRequest(inputs, { budgets: { ...inputs.request.budgets, [key]: 0 } }),
				'REQUEST_INVALID'
			);
		expectBuildIssue(
			withRequest(inputs, { budgets: { ...inputs.request.budgets, maxInputRecords: 1 } }),
			'BUDGET_EXCEEDED'
		);
		expectBuildIssue(
			withRequest(inputs, {
				budgets: { ...inputs.request.budgets, maxInputStringCharacters: 1 }
			}),
			'BUDGET_EXCEEDED'
		);

		const exoticArray = [...inputs.request.conditions];
		Object.setPrototypeOf(exoticArray, null);
		expectBuildIssue(withRequest(inputs, { conditions: exoticArray }), 'REQUEST_INVALID');
		const symbolArray = [...inputs.request.conditions] as unknown[] & Record<PropertyKey, unknown>;
		symbolArray[Symbol('hostile')] = true;
		expectBuildIssue(
			withRequest(inputs, { conditions: symbolArray as string[] }),
			'REQUEST_INVALID'
		);
		const unicodeArrayKey = [...inputs.request.conditions] as string[] & Record<string, unknown>;
		unicodeArrayKey['\ud800'] = true;
		expectBuildIssue(withRequest(inputs, { conditions: unicodeArrayKey }), 'REQUEST_INVALID');
		const nonenumerableArray = [...inputs.request.conditions];
		Object.defineProperty(nonenumerableArray, '0', {
			enumerable: false,
			value: nonenumerableArray[0]
		});
		expectBuildIssue(withRequest(inputs, { conditions: nonenumerableArray }), 'REQUEST_INVALID');

		const exoticRecord = { ...inputs.request.consumer };
		Object.setPrototypeOf(exoticRecord, Date.prototype);
		expectBuildIssue(withRequest(inputs, { consumer: exoticRecord }), 'REQUEST_INVALID');
		const symbolRecord = { ...inputs.semanticSnapshot } as Record<PropertyKey, unknown>;
		symbolRecord[Symbol('hostile')] = true;
		expectBuildIssue({ ...inputs, semanticSnapshot: symbolRecord }, 'REQUEST_INVALID');
		const unicodeRecord = { ...inputs.semanticSnapshot } as Record<string, unknown>;
		unicodeRecord['\ud800'] = true;
		expectBuildIssue({ ...inputs, semanticSnapshot: unicodeRecord }, 'REQUEST_INVALID');
		const nonenumerableRecord = { ...inputs.semanticSnapshot };
		Object.defineProperty(nonenumerableRecord, 'provider', {
			enumerable: false,
			value: inputs.semanticSnapshot.provider
		});
		expectBuildIssue({ ...inputs, semanticSnapshot: nonenumerableRecord }, 'REQUEST_INVALID');

		for (const request of [
			withRequest(inputs, {
				budgets: { ...inputs.request.budgets, maxDiagnostics: 100_001 }
			}),
			withRequest(inputs, { schemaVersion: 'unsupported' as never }),
			withRequest(inputs, { operationVersion: 'unsupported' as never }),
			withRequest(inputs, { moduleMode: 'OTHER' as never }),
			withRequest(inputs, { platform: 'OTHER' as never }),
			withRequest(inputs, { manifestPath: '/absolute/package.json' }),
			withRequest(inputs, { packageName: 'INVALID PACKAGE' }),
			withRequest(inputs, {
				projectContextGraph: {
					...inputs.request.projectContextGraph,
					contentDigest: 'not-a-digest'
				}
			}),
			withRequest(inputs, {
				selection: { ...inputs.request.selection, exportMap: 'unsupported' } as never
			})
		])
			expectBuildIssue(request, 'REQUEST_INVALID');

		expectBuildIssue(
			{ ...inputs, frozenSubject: JSON.parse(JSON.stringify(inputs.frozenSubject)) },
			'REQUEST_INVALID'
		);
	});

	it('fails closed across validator options and hostile candidate descriptor trees', () => {
		expectValidationIssue(graph, inputs, 'SHAPE_INVALID', null as never);
		for (const options of [
			{ extra: 1 },
			{ maxDepth: 0 },
			{ maxIssues: 100_001 },
			{ maxRecords: -1 }
		])
			expectValidationIssue(graph, inputs, 'SHAPE_INVALID', options as never);

		expectValidationIssue(graph, inputs, 'BUDGET_EXHAUSTED', { maxRecords: 1 });
		expectValidationIssue([true], inputs, 'BUDGET_EXHAUSTED', { maxRecords: 1 });
		expectValidationIssue({ a: { b: 1 }, c: 1 }, inputs, 'BUDGET_EXHAUSTED', {
			maxRecords: 3
		});
		expectValidationIssue(graph, inputs, 'BUDGET_EXHAUSTED', { maxStringCharacters: 1 });
		expectValidationIssue(graph, inputs, 'BUDGET_EXHAUSTED', { maxDepth: 1 });
		expectValidationIssue('long candidate string', inputs, 'BUDGET_EXHAUSTED', {
			maxStringCharacters: 1
		});
		expectValidationIssue(null, inputs, 'SHAPE_INVALID');
		expectValidationIssue(new Proxy(graph, {}), inputs, 'SHAPE_INVALID');

		const cyclic = mutableResolution(graph) as ConditionalExportResolutionSnapshot & {
			cycle?: unknown;
		};
		cyclic.cycle = cyclic;
		expectValidationIssue(cyclic, inputs, 'SHAPE_INVALID');

		const exotic = mutableResolution(graph);
		Object.setPrototypeOf(exotic, Date.prototype);
		expectValidationIssue(exotic, inputs, 'SHAPE_INVALID');

		const symbolic = mutableResolution(graph) as ConditionalExportResolutionSnapshot &
			Record<PropertyKey, unknown>;
		symbolic[Symbol('hostile')] = true;
		expectValidationIssue(symbolic, inputs, 'SHAPE_INVALID');
		const unicodeKeyCandidate = { ['\ud800']: true };
		expectValidationIssue(unicodeKeyCandidate, inputs, 'SHAPE_INVALID');

		const sparse = mutableResolution(graph);
		delete (sparse.branches as unknown[])[0];
		expectValidationIssue(sparse, inputs, 'SHAPE_INVALID');
		const sparseExpando = [true] as unknown[] & { x?: boolean };
		delete sparseExpando[0];
		sparseExpando.x = true;
		expectValidationIssue(sparseExpando, inputs, 'SHAPE_INVALID');

		const expando = mutableResolution(graph);
		(expando.branches as unknown as { extra?: boolean }).extra = true;
		expectValidationIssue(expando, inputs, 'SHAPE_INVALID');

		const invalidUnicode = mutableResolution(graph);
		(invalidUnicode as { subjectId: string }).subjectId = '\ud800';
		expectValidationIssue(invalidUnicode, inputs, 'SHAPE_INVALID');

		const unsafeNumber = mutableResolution(graph);
		(unsafeNumber.decision as { ordinal: number }).ordinal = Number.POSITIVE_INFINITY;
		expectValidationIssue(unsafeNumber, inputs, 'SHAPE_INVALID');

		let getterCalls = 0;
		const accessor = mutableResolution(graph);
		Object.defineProperty(accessor, 'contentDigest', {
			enumerable: true,
			get() {
				getterCalls += 1;
				return graph.contentDigest;
			}
		});
		expectValidationIssue(accessor, inputs, 'SHAPE_INVALID');
		expect(getterCalls).toBe(0);
	});

	it('fails closed across validator input shells, criteria, identities, and bindings', () => {
		for (const invalidInput of [
			null,
			{ ...inputs, extra: true },
			{ ...inputs, request: [] },
			{ ...inputs, frozenSubject: JSON.parse(JSON.stringify(inputs.frozenSubject)) },
			{ ...inputs, request: { ...requestClone(inputs), extra: true } },
			withRequest(inputs, {
				budgets: { ...inputs.request.budgets, maxDiagnostics: 100_001 }
			}),
			withRequest(inputs, { schemaVersion: 'unsupported' as never }),
			withRequest(inputs, { operationVersion: 'unsupported' as never }),
			withRequest(inputs, {
				selection: { ...inputs.request.selection, exportMap: 'unsupported' } as never
			}),
			withRequest(inputs, { conditions: ['default'] }),
			withRequest(inputs, { conditions: ['1.5'] }),
			withRequest(inputs, { exportSubpath: '../outside' as never }),
			withRequest(inputs, { packageName: 'INVALID PACKAGE' }),
			withRequest(inputs, { manifestPath: '/absolute/package.json' }),
			withRequest(inputs, { moduleMode: 'OTHER' as never }),
			withRequest(inputs, { platform: 'OTHER' as never }),
			withRequest(inputs, { subjectId: '' }),
			withRequest(inputs, {
				consumer: { ...inputs.request.consumer, semanticSourceId: '' as never }
			}),
			withRequest(inputs, {
				projectContextGraph: {
					...inputs.request.projectContextGraph,
					contentDigest: 'not-a-digest'
				}
			}),
			withRequest(inputs, { packageName: '@fixture/not-captured' }),
			withRequest(inputs, { manifestPath: 'packages/consumer/package.json' }),
			withRequest(inputs, {
				consumer: { ...inputs.request.consumer, projectContextProgramId: 'missing' as never }
			})
		])
			expectValidationIssue(graph, invalidInput, 'INPUT_INVALID');
		expectValidationIssue(
			graph,
			{ ...inputs, semanticSnapshot: { ...inputs.semanticSnapshot, subjectId: 'other-subject' } },
			'IDENTITY_MISMATCH'
		);
	});

	it('rejects invalid Unicode, reserved/duplicate conditions, unsafe numbers, and closed request shapes', () => {
		for (const conditions of [
			['\ud800'],
			['default'],
			['import'],
			['node'],
			['0'],
			['1.5'],
			['4294967294'],
			['source', 'source'],
			['']
		])
			expectBuildIssue(withRequest(inputs, { conditions }), 'REQUEST_INVALID');

		for (const bad of [-1, -0, 1.5, Number.MAX_SAFE_INTEGER + 1])
			expectBuildIssue(
				withRequest(inputs, {
					budgets: { ...inputs.request.budgets, maxBranches: bad }
				}),
				'REQUEST_INVALID'
			);

		const extra = { ...requestClone(inputs), extra: true };
		expectBuildIssue({ ...inputs, request: extra }, 'REQUEST_INVALID');
		expectBuildIssue(
			withRequest(inputs, {
				exportSubpath: './node_modules/private'
			}),
			'REQUEST_INVALID'
		);
		expectBuildIssue(
			withRequest(inputs, { exportSubpath: './NoDe_MoDuLeS/private' }),
			'REQUEST_INVALID'
		);

		// The exact FrozenSubject-bound CAP-010 predecessor rejects these decoded
		// lone-surrogate targets before CAP-012 can observe them. The builder keeps
		// the same scalar check defensively at every output-bearing export-string site.
		for (const manifest of [
			manifestWithExports('"./\\uD800"'),
			manifestWithExports('{ ".": { "source": "./\\uD800" } }')
		])
			expect(() => createConditionalExportResolutionFixture(manifest)).toThrow(
				/Project-context fixture construction failed:.*"code":"REQUEST_INVALID".*Unicode scalar text/
			);
	});

	it('rejects numeric condition keys and mixed export-map shapes before derivation', () => {
		for (const manifest of [
			manifestWithExports(`{
      ".": {
				"default": "./dist/index.js",
				"1.5": "./dist/numeric.js"
      }
    }`),
			manifestWithExports('{ ".": "./src/index.ts", "default": "./dist/index.js" }')
		]) {
			const invalid = createConditionalExportResolutionFixture(manifest);
			try {
				const invalidInputs = conditionalExportResolutionInputs(invalid);
				expectBuildIssue(invalidInputs, 'MANIFEST_INVALID');
				expectValidationIssue(graph, invalidInputs, 'INPUT_INVALID');
			} finally {
				invalid.cleanup();
			}
		}
	});

	it('treats a dot-prefixed nested condition as an activatable condition name', () => {
		const dotCondition = createConditionalExportResolutionFixture(
			manifestWithExports(`{
      ".": {
        ".foo": "./src/index.ts",
        "default": "./dist/index.js"
      }
    }`)
		);
		try {
			const result = expectResolution(
				conditionalExportResolutionInputs(dotCondition, { conditions: ['.foo'] })
			);
			expect(result.decision).toMatchObject({
				state: 'SELECTED_TARGET',
				target: './src/index.ts'
			});
			expect(
				result.branches.map(({ condition, evaluation, exclusionReason }) => ({
					condition,
					evaluation,
					exclusionReason
				}))
			).toEqual([
				{ condition: '.foo', evaluation: 'SELECTED', exclusionReason: null },
				{
					condition: 'default',
					evaluation: 'EXCLUDED',
					exclusionReason: 'PRIOR_BRANCH_TERMINATED_EVALUATION'
				}
			]);
		} finally {
			dotCondition.cleanup();
		}
	});

	it('allows an inactive empty manifest condition to fall through to default', () => {
		const emptyCondition = createConditionalExportResolutionFixture(
			manifestWithExports(`{
      ".": {
        "": "./src/index.ts",
        "default": "./dist/index.js"
      }
    }`)
		);
		try {
			const result = expectResolution(conditionalExportResolutionInputs(emptyCondition));
			expect(result.decision).toMatchObject({
				state: 'SELECTED_TARGET',
				target: './dist/index.js'
			});
			expect(
				result.branches.map(({ condition, evaluation }) => ({ condition, evaluation }))
			).toEqual([
				{ condition: '', evaluation: 'EXCLUDED' },
				{ condition: 'default', evaluation: 'SELECTED' }
			]);
		} finally {
			emptyCondition.cleanup();
		}
	});

	it('fails closed on request, package, consumer, and predecessor identity/population mismatches', () => {
		expectBuildIssue(
			withRequest(inputs, { subjectId: 'other-subject' }),
			'INPUT_IDENTITY_MISMATCH'
		);
		expectBuildIssue(
			withRequest(inputs, { packageName: '@fixture/not-captured' }),
			'INPUT_POPULATION_MISMATCH'
		);
		expectBuildIssue(
			withRequest(inputs, { manifestPath: 'packages/consumer/package.json' }),
			'INPUT_POPULATION_MISMATCH'
		);
		expectBuildIssue(
			withRequest(inputs, {
				consumer: { ...inputs.request.consumer, semanticSourceId: 'semantic-source-other' as never }
			}),
			'INPUT_POPULATION_MISMATCH'
		);
		expectBuildIssue(
			withRequest(inputs, {
				projectContextGraph: {
					...inputs.request.projectContextGraph,
					contentDigest: '0'.repeat(64)
				}
			}),
			'INPUT_IDENTITY_MISMATCH'
		);

		const corruptedContext = JSON.parse(
			JSON.stringify(inputs.projectContextGraph)
		) as ConditionalExportResolutionBuildInputs['projectContextGraph'];
		(corruptedContext.coverage as { projectedSources: number }).projectedSources += 1;
		(corruptedContext as { contentDigest: string }).contentDigest =
			projectContextGraphContentDigest(corruptedContext);
		const corruptedInputs = {
			...inputs,
			projectContextGraph: corruptedContext,
			request: requestClone(inputs, {
				projectContextGraph: {
					...inputs.request.projectContextGraph,
					contentDigest: corruptedContext.contentDigest
				}
			})
		};
		expectBuildIssue(corruptedInputs, 'PROJECT_CONTEXT_GRAPH_INVALID');
		expectValidationIssue(graph, corruptedInputs, 'INPUT_INVALID');
	});

	it('preserves nested candidates, inactive ancestry, selected paths, and prior termination', () => {
		const nested = createConditionalExportResolutionFixture(
			manifestWithExports(`{
      ".": {
        "custom": { "missing": "./dist/missing.js" },
        "inactive": { "custom": "./dist/inactive.js" },
        "import": { "browser": "./dist/browser.js", "default": "./dist/index.js" },
        "default": "./dist/fallback.js"
      }
    }`)
		);
		try {
			const result = expectResolution(
				conditionalExportResolutionInputs(nested, {
					conditions: ['custom'],
					platform: 'NEUTRAL'
				})
			);
			expect(result.decision).toMatchObject({
				state: 'SELECTED_TARGET',
				target: './dist/index.js'
			});
			expect(
				result.branches.map((branch) => [
					branch.conditionPath.join('/'),
					branch.evaluation,
					branch.exclusionReason
				])
			).toEqual([
				['custom', 'CANDIDATE', null],
				['custom/missing', 'EXCLUDED', 'CONDITION_INACTIVE'],
				['inactive', 'EXCLUDED', 'CONDITION_INACTIVE'],
				['inactive/custom', 'EXCLUDED', 'ANCESTOR_CONDITION_INACTIVE'],
				['import', 'SELECTED', null],
				['import/browser', 'EXCLUDED', 'CONDITION_INACTIVE'],
				['import/default', 'SELECTED', null],
				['default', 'EXCLUDED', 'PRIOR_BRANCH_TERMINATED_EVALUATION']
			]);
		} finally {
			nested.cleanup();
		}
	});

	it('keeps inactive and post-termination unsupported surfaces outside the selected decision', () => {
		const candidate = createConditionalExportResolutionFixture(
			manifestWithExports(`{
      ".": {
        "inactive": ["../inactive.js"],
        "source": "./src/index.ts",
        "later": ["../later.js"]
      }
    }`)
		);
		try {
			const result = expectResolution(
				conditionalExportResolutionInputs(candidate, { conditions: ['source'] })
			);
			expect(result.decision.state).toBe('SELECTED_TARGET');
			expect(result.closure).toBe('CLOSED_FOR_SELECTED_EXACT_EXPORT_DECISION');
			expect(result.frontiers.map((frontier) => frontier.impact)).toEqual([
				'OUTSIDE_SELECTED_DECISION',
				'OUTSIDE_SELECTED_DECISION'
			]);
			expect(result.branches[0]).toMatchObject({
				condition: 'source',
				evaluation: 'SELECTED'
			});
		} finally {
			candidate.cleanup();
		}
	});

	it('validates absent exports, direct exact null, and reached conditional arrays independently', () => {
		const cases = [
			{
				expected: 'NO_EXACT_EXPORT_KEY',
				manifest: `{
  "name": "${CONDITIONAL_EXPORT_FIXTURE_PACKAGE_NAME}",
  "private": true,
  "type": "module",
  "version": "0.0.0"
}\n`
			},
			{ expected: 'BLOCKED_BY_NULL', manifest: manifestWithExports('{ ".": null }') },
			{ expected: 'UNSUPPORTED', manifest: manifestWithExports('"../outside.js"') },
			{
				expected: 'SELECTED_TARGET',
				manifest: manifestWithExports(
					'{ ".": { "node": "./dist/index.js", "default": "./dist/browser.js" } }'
				)
			},
			{
				expected: 'UNSUPPORTED',
				manifest: manifestWithExports(
					'{ ".": { "source": ["./src/index.ts"], "default": "./dist/index.js" } }'
				)
			}
		] as const;
		for (const testCase of cases) {
			const exact = createConditionalExportResolutionFixture(testCase.manifest);
			try {
				const result = expectResolution(conditionalExportResolutionInputs(exact));
				expect(result.decision.state).toBe(testCase.expected);
			} finally {
				exact.cleanup();
			}
		}
	});

	it('enforces every positive derivation budget independently in public validation', () => {
		const thresholds = {
			maxAstNodes: graph.coverage.astNodes,
			maxBranches: graph.coverage.branchRecords,
			maxConditionChecks: graph.coverage.conditionChecks,
			maxManifestBytes: graph.coverage.manifestBytes,
			maxOutputRecords: graph.coverage.outputRecords,
			maxTraversalSteps: graph.coverage.chargedTraversalSteps
		};
		for (const [key, actual] of Object.entries(thresholds))
			expectValidationIssue(
				graph,
				withRequest(inputs, {
					budgets: { ...inputs.request.budgets, [key]: actual - 1 }
				}),
				'BUDGET_EXHAUSTED'
			);
		for (const budgets of [
			{ ...inputs.request.budgets, maxInputRecords: 1 },
			{ ...inputs.request.budgets, maxInputStringCharacters: 1 }
		])
			expectValidationIssue(graph, withRequest(inputs, { budgets }), 'BUDGET_EXHAUSTED');
	});

	it('rejects the complete declared unsafe target subset without turning it into a miss', () => {
		const unsafeTargets = [
			'./',
			'./a/',
			'./a//b',
			'./.',
			'./..',
			'./node_modules/x',
			'./NoDe_MoDuLeS/x',
			'./a%2fb',
			'./a\\b',
			'./a?b',
			'./a#b',
			'./a*b'
		];
		const entries = unsafeTargets
			.map((target, index) => `${JSON.stringify(`c${index}`)}: ${JSON.stringify(target)}`)
			.join(',\n');
		const unsafe = createConditionalExportResolutionFixture(
			manifestWithExports(`{ ".": { ${entries}, "default": "./dist/index.js" } }`)
		);
		try {
			const result = expectResolution(
				conditionalExportResolutionInputs(unsafe, {
					conditions: unsafeTargets.map((_, index) => `c${index}`)
				})
			);
			expect(result.decision).toMatchObject({
				selectedBranchId: null,
				state: 'UNSUPPORTED',
				target: null
			});
			expect(result.frontiers).toHaveLength(unsafeTargets.length);
			expect(
				result.frontiers.every((frontier) => frontier.reason === 'UNSUPPORTED_EXPORT_TARGET_SYNTAX')
			).toBe(true);
			expect(result.frontiers[0]?.impact).toBe('BLOCKS_SELECTED_DECISION');
			expect(
				result.frontiers
					.slice(1)
					.every((frontier) => frontier.impact === 'OUTSIDE_SELECTED_DECISION')
			).toBe(true);
		} finally {
			unsafe.cleanup();
		}
	});

	it('streams large canonical request strings through independent hashing', () => {
		const result = expectResolution(
			withRequest(inputs, { conditions: ['x'.repeat(70_000), 'source'] })
		);
		expect(result.decision).toMatchObject({
			state: 'SELECTED_TARGET',
			target: './src/index.ts'
		});
	});

	it('isolates throwing telemetry observers and malformed telemetry options', async () => {
		const events: string[] = [];
		expect(
			buildConditionalExportResolution(inputs, {
				onProgress(event) {
					events.push(`${event.phase}:${event.state}`);
					throw new Error('observer failure');
				}
			}).outcome
		).toBe('partial');
		await Promise.resolve();
		expect(events).toHaveLength(20);
		const malformed = buildConditionalExportResolution(inputs, {} as never);
		expect(malformed.outcome).toBe('partial');
	});
});
