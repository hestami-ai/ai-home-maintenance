import { describe, expect, it, vi } from 'vitest';

import {
	SEMANTIC_SOURCE_QUERY_FIELDS,
	SEMANTIC_SOURCE_QUERY_NONCLAIMS,
	SEMANTIC_SOURCE_QUERY_OPERATORS,
	SEMANTIC_SOURCE_QUERY_SAFETY_CEILINGS,
	type EvaluateSemanticSourceQueryInput,
	type SemanticQueryNotApplicableProjection,
	type SemanticQueryProjection,
	type SemanticQueryTruth,
	type SemanticSourceQueryBudgets,
	type SemanticSourceQueryExpression,
	type SemanticSourceQueryLeafEvaluation
} from '../contracts/semantic-source-query.js';
import type { SemanticEpistemicState, SemanticSourceRecord } from '../contracts/semantic.js';
import {
	evaluateSemanticSourceQuery,
	evidencePairForTruth,
	semanticQueryAnd,
	semanticQueryNot,
	semanticQueryOr,
	truthForEvidencePair
} from './evaluate-semantic-source-query.js';

const budgets: SemanticSourceQueryBudgets = {
	maxDepth: SEMANTIC_SOURCE_QUERY_SAFETY_CEILINGS.maxDepth,
	maxEvaluations: 1_000,
	maxFanout: SEMANTIC_SOURCE_QUERY_SAFETY_CEILINGS.maxFanout,
	maxNodes: SEMANTIC_SOURCE_QUERY_SAFETY_CEILINGS.maxNodes,
	maxPopulation: 100,
	maxTraceNodes: 1_000
};

function source(
	id: string,
	overrides: Partial<Record<keyof SemanticSourceRecord, unknown>> = {}
): SemanticSourceRecord {
	return {
		analysisDisposition: 'DEEP_INDEXED',
		artifactClass: 'PRODUCTION_SOURCE',
		declarationFile: false,
		id,
		languageVariant: 'Standard',
		logicalPath: `packages/${id}.ts`,
		moduleKind: 'MODULE',
		origin: 'AUTHORED',
		programId: `program:${id}`,
		projectId: `project:${id}`,
		provenanceId: `provenance:${id}`,
		rootFile: true,
		scriptKindName: 'TS',
		...overrides
	} as unknown as SemanticSourceRecord;
}

function equals(
	nodeId: string,
	field: 'artifactClass' | 'declarationFile' | 'id' | 'logicalPath' | 'origin' | 'rootFile',
	value: boolean | string
): SemanticSourceQueryExpression {
	return { field, kind: 'EQUALS', nodeId, value } as SemanticSourceQueryExpression;
}

function logicalPathStartsWith(nodeId: string, value: string): SemanticSourceQueryExpression {
	return { field: 'logicalPath', kind: 'LOGICAL_PATH_STARTS_WITH', nodeId, value };
}

function input(
	expression: SemanticSourceQueryExpression,
	records: readonly SemanticSourceRecord[] = [source('one')],
	overrides: Partial<EvaluateSemanticSourceQueryInput> = {}
): EvaluateSemanticSourceQueryInput {
	return {
		budgets,
		expression,
		mode: 'COMPLETE',
		records,
		...overrides
	};
}

function applicable(truth: SemanticQueryTruth): SemanticQueryProjection {
	return {
		disposition: 'applicable-result',
		evidencePair: evidencePairForTruth(truth),
		truth
	};
}

const notApplicable: SemanticQueryNotApplicableProjection = {
	applicability: {
		applicabilityBasis: ['test-basis'],
		rationale: 'The test leaf has no semantic owner in this source.',
		reasonCode: 'TEST_NOT_APPLICABLE',
		semanticOwnerRef: 'test-owner'
	},
	disposition: 'not-applicable'
};

function epistemic(
	executionHealth: SemanticEpistemicState['executionHealth'] = 'succeeded',
	overrides: Partial<SemanticEpistemicState> = {}
): SemanticEpistemicState {
	return {
		capabilityCoverage: 'supported',
		conflict: 'unopposed',
		executionHealth,
		freshness: 'current-for-subject',
		inference: 'direct',
		rationale: 'Test epistemic evidence.',
		supportBasis: {
			kind: 'direct-extraction',
			method: 'test-leaf/1',
			rationale: 'Test leaf evidence.',
			sourceRefs: ['test-ref']
		},
		unresolvedRegions: [],
		...overrides
	};
}

function leafResult(
	truth: SemanticQueryTruth,
	executionHealth: SemanticEpistemicState['executionHealth'] = 'succeeded'
): SemanticSourceQueryLeafEvaluation {
	return {
		disposition: 'applicable-result',
		epistemic: epistemic(executionHealth, truth === 'C' ? { conflict: 'conflicting' } : undefined),
		evidencePair: evidencePairForTruth(truth),
		evidenceRefs: ['test-ref']
	};
}

function evaluated(candidate: EvaluateSemanticSourceQueryInput) {
	const outcome = evaluateSemanticSourceQuery(candidate);
	if (outcome.state !== 'EVALUATED') throw new Error(JSON.stringify(outcome));
	return outcome.evaluation;
}

function expectRefused(
	candidate: unknown,
	code:
		| 'AST_BUDGET_EXCEEDED'
		| 'AST_INVALID'
		| 'EVALUATION_BUDGET_EXCEEDED'
		| 'INPUT_INVALID'
		| 'LEAF_EVALUATION_FAILED'
		| 'POPULATION_BUDGET_EXCEEDED'
		| 'POPULATION_INVALID'
): void {
	expect(evaluateSemanticSourceQuery(candidate as EvaluateSemanticSourceQueryInput)).toMatchObject({
		diagnostic: { code },
		state: 'REFUSED'
	});
}

function expectDeeplyFrozen(value: unknown): void {
	const seen = new WeakSet<object>();
	const stack: unknown[] = [value];
	while (stack.length > 0) {
		const current = stack.pop();
		if (current === null || typeof current !== 'object' || seen.has(current)) continue;
		seen.add(current);
		expect(Object.isFrozen(current)).toBe(true);
		for (const key of Reflect.ownKeys(current)) {
			const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
			if (descriptor !== undefined && 'value' in descriptor) stack.push(descriptor.value);
		}
	}
}

describe('four-valued semantic query algebra', () => {
	it('round-trips every exact evidence pair and preserves NOT', () => {
		for (const [truth, negated] of [
			['T', 'F'],
			['F', 'T'],
			['U', 'U'],
			['C', 'C']
		] as const) {
			expect(truthForEvidencePair(evidencePairForTruth(truth))).toBe(truth);
			expect(semanticQueryNot(applicable(truth))).toEqual(applicable(negated));
		}
	});

	it('implements every cell of the exact AND and OR tables', () => {
		const truths = ['T', 'F', 'U', 'C'] as const;
		const andTable = [
			['T', 'F', 'U', 'C'],
			['F', 'F', 'F', 'F'],
			['U', 'F', 'U', 'F'],
			['C', 'F', 'F', 'C']
		] as const;
		const orTable = [
			['T', 'T', 'T', 'T'],
			['T', 'F', 'U', 'C'],
			['T', 'U', 'U', 'T'],
			['T', 'C', 'T', 'C']
		] as const;
		for (const [leftIndex, left] of truths.entries())
			for (const [rightIndex, right] of truths.entries()) {
				expect(semanticQueryAnd([applicable(left), applicable(right)])).toEqual(
					applicable(andTable[leftIndex]![rightIndex]!)
				);
				expect(semanticQueryOr([applicable(left), applicable(right)])).toEqual(
					applicable(orTable[leftIndex]![rightIndex]!)
				);
			}
	});

	it('keeps reasoned non-applicability separate from U and applies its exact composition rules', () => {
		expect(semanticQueryNot(notApplicable)).toMatchObject({ disposition: 'not-applicable' });
		expect(semanticQueryAnd([notApplicable, notApplicable])).toMatchObject({
			disposition: 'not-applicable'
		});
		expect(semanticQueryOr([notApplicable, notApplicable])).toMatchObject({
			disposition: 'not-applicable'
		});
		for (const [left, andTruth, orTruth] of [
			['T', 'U', 'T'],
			['F', 'F', 'U'],
			['C', 'F', 'T']
		] as const) {
			expect(semanticQueryAnd([applicable(left), notApplicable])).toEqual(applicable(andTruth));
			expect(semanticQueryOr([applicable(left), notApplicable])).toEqual(applicable(orTruth));
		}
		const mutableBasis = ['original-basis'];
		const negated = semanticQueryNot({
			applicability: { ...notApplicable.applicability, applicabilityBasis: mutableBasis },
			disposition: 'not-applicable'
		});
		mutableBasis[0] = 'mutated-basis';
		expect(negated).toMatchObject({
			applicability: { applicabilityBasis: ['original-basis'] },
			disposition: 'not-applicable'
		});
		expect(Object.isFrozen(negated)).toBe(true);
	});

	it('rejects each reachable malformed AST, population, mode, and leaf-output boundary', () => {
		const leaf = equals('leaf', 'origin', 'AUTHORED');
		const nonEnumerableOperands = [leaf];
		Object.defineProperty(nonEnumerableOperands, '0', {
			enumerable: false,
			value: leaf
		});
		const missingProjection = { ...source('missing') } as Record<string, unknown>;
		delete missingProjection.projectId;
		for (const [expression, code] of [
			[1, 'AST_INVALID'],
			[{ field: 'origin', kind: 'EQUALS', nodeId: '', value: 'AUTHORED' }, 'AST_INVALID'],
			[
				{ field: 'unregistered', kind: 'EQUALS', nodeId: 'unknown-field', value: 'AUTHORED' },
				'AST_INVALID'
			],
			[
				{ kind: 'AND', nodeId: 'non-enumerable', operands: nonEnumerableOperands },
				'AST_BUDGET_EXCEEDED'
			]
		] as const)
			expectRefused(input(expression as SemanticSourceQueryExpression), code);
		expectRefused(
			input(leaf, [missingProjection as unknown as SemanticSourceRecord]),
			'POPULATION_INVALID'
		);
		expectRefused(input(leaf, [source('duplicate'), source('duplicate')]), 'POPULATION_INVALID');
		expectRefused({ ...input(leaf), mode: 'PARTIAL' }, 'INPUT_INVALID');

		const invalidLeaves: readonly unknown[] = [
			{ ...leafResult('T'), evidenceRefs: [1] },
			{
				...leafResult('T'),
				epistemic: {
					...epistemic(),
					supportBasis: { ...epistemic().supportBasis, kind: 'invented' }
				}
			},
			{ ...leafResult('T'), epistemic: { ...epistemic(), capabilityCoverage: 'invented' } },
			{ ...leafResult('T'), evidencePair: { falseSupport: 2, trueSupport: 0 } },
			{
				applicability: { ...notApplicable.applicability, reasonCode: '' },
				disposition: 'not-applicable'
			},
			{ disposition: 'invented' }
		];
		for (const invalidLeaf of invalidLeaves)
			expectRefused(
				input(leaf, [source('one')], {
					evaluateLeaf: () => invalidLeaf as SemanticSourceQueryLeafEvaluation
				}),
				'LEAF_EVALUATION_FAILED'
			);
	});

	it('covers fixed algebra ceilings and every capability/non-applicability composition', () => {
		expect(() => truthForEvidencePair({ falseSupport: 2, trueSupport: 0 } as never)).toThrow(
			/Evidence support/u
		);
		expect(() =>
			semanticQueryNot({
				...notApplicable,
				applicability: {
					...notApplicable.applicability,
					applicabilityBasis: Array.from({ length: 65 }, (_, index) => `basis:${index}`)
				}
			})
		).toThrow(/fixed vector ceiling/u);
		expect(() =>
			semanticQueryOr(
				Array.from({ length: SEMANTIC_SOURCE_QUERY_SAFETY_CEILINGS.maxFanout + 1 }, () =>
					applicable('T')
				) as unknown as [SemanticQueryProjection, ...SemanticQueryProjection[]]
			)
		).toThrow(/fanout ceiling/u);

		const logical: SemanticSourceQueryExpression = {
			kind: 'AND',
			nodeId: 'root',
			operands: [equals('child', 'origin', 'AUTHORED')]
		};
		for (const capabilityCoverage of [
			'excluded',
			'not-analyzed',
			'unsupported',
			'partial'
		] as const) {
			const evaluation = evaluated(
				input(logical, [source(capabilityCoverage)], {
					evaluateLeaf: () => ({
						...leafResult('T'),
						epistemic: epistemic('succeeded', { capabilityCoverage })
					})
				})
			);
			expect(evaluation.recordResults[0]).toMatchObject({
				epistemic: { effective: { capabilityCoverage } }
			});
		}

		const allNotApplicable = evaluated(
			input(
				{
					kind: 'AND',
					nodeId: 'na-root',
					operands: [equals('na-left', 'origin', 'AUTHORED'), equals('na-right', 'rootFile', true)]
				},
				[source('na-logical')],
				{
					evaluateLeaf: () => ({ ...notApplicable }) as SemanticSourceQueryLeafEvaluation
				}
			)
		);
		expect(allNotApplicable.recordResults[0]).toMatchObject({ disposition: 'not-applicable' });
	});

	it('contains an unexpected input-inspection failure at the public boundary', () => {
		const getPrototypeOf = vi.spyOn(Object, 'getPrototypeOf').mockImplementationOnce(() => {
			throw new Error('synthetic input inspection failure');
		});
		let outcome!: ReturnType<typeof evaluateSemanticSourceQuery>;
		try {
			outcome = evaluateSemanticSourceQuery(
				input(equals('leaf-after-inspection-failure', 'origin', 'AUTHORED'))
			);
		} finally {
			getPrototypeOf.mockRestore();
		}
		expect(outcome).toMatchObject({
			diagnostic: { code: 'INPUT_INVALID', phase: 'REQUEST' },
			state: 'REFUSED'
		});
	});
});

describe('evaluateSemanticSourceQuery', () => {
	it('completely evaluates a closed registered-scalar AST with deterministic node-total traces', () => {
		const expression: SemanticSourceQueryExpression = {
			kind: 'AND',
			nodeId: 'root',
			operands: [
				equals('path', 'logicalPath', 'packages/one.ts'),
				{
					kind: 'NOT',
					nodeId: 'not-declaration',
					operand: equals('declaration', 'declarationFile', true)
				},
				{
					kind: 'OR',
					nodeId: 'classification',
					operands: [
						equals('test-class', 'artifactClass', 'TEST_SOURCE'),
						equals('authored', 'origin', 'AUTHORED')
					]
				}
			]
		};
		const first = evaluated(input(expression));
		const second = evaluated(input(expression));
		expect(second).toEqual(first);
		expect(first.expression).toMatchObject({
			maxObservedDepth: 3,
			maxObservedFanout: 3,
			nodeCount: 7,
			rootNodeId: 'root'
		});
		expect(first.expression.nodes.map((node) => node.nodeId)).toEqual([
			'root',
			'path',
			'not-declaration',
			'declaration',
			'classification',
			'test-class',
			'authored'
		]);
		expect(first.recordResults).toHaveLength(1);
		expect(first.recordResults[0]).toMatchObject({ disposition: 'applicable-result', truth: 'T' });
		expect(first.recordResults[0]!.trace).toHaveLength(7);
		expect(first.recordResults[0]!.trace.map((node) => node.ordinal)).toEqual([
			0, 1, 2, 3, 4, 5, 6
		]);
		expect(first.coverage).toEqual({
			chargedEvaluations: 7,
			counts: {
				conflicting: 0,
				notApplicable: 0,
				supportedFalse: 0,
				supportedTrue: 1,
				unknown: 0
			},
			partitionsReconcile: true,
			populationRecords: 1,
			traceNodes: 7
		});
		const leafOrder: string[] = [];
		evaluated(
			input(expression, [source('one')], {
				evaluateLeaf: ({ expression: leaf }) => {
					leafOrder.push(leaf.nodeId);
					return leafResult('T');
				}
			})
		);
		expect(leafOrder).toEqual(['path', 'declaration', 'test-class', 'authored']);
		expectDeeplyFrozen(first);
	});

	it('freezes exported registries, policy nonclaims, and absolute safety ceilings', () => {
		expect(Object.isFrozen(SEMANTIC_SOURCE_QUERY_FIELDS)).toBe(true);
		expect(Object.isFrozen(SEMANTIC_SOURCE_QUERY_NONCLAIMS)).toBe(true);
		expect(Object.isFrozen(SEMANTIC_SOURCE_QUERY_OPERATORS)).toBe(true);
		expect(Object.isFrozen(SEMANTIC_SOURCE_QUERY_SAFETY_CEILINGS)).toBe(true);
		expect(() =>
			(SEMANTIC_SOURCE_QUERY_FIELDS as unknown as string[]).push('unregisteredField')
		).toThrow();
		expect(() =>
			(SEMANTIC_SOURCE_QUERY_OPERATORS as unknown as string[]).push('UNREGISTERED_OPERATOR')
		).toThrow();
		expect(() => {
			(SEMANTIC_SOURCE_QUERY_SAFETY_CEILINGS as { maxNodes: number }).maxNodes = 1_000_000;
		}).toThrow();
	});

	it('evaluates exact case-sensitive logicalPath prefixes without path inference', () => {
		const records = [
			source('inside', { logicalPath: 'packages/csaa/src/index.ts' }),
			source('adjacent', { logicalPath: 'packages/csaa-extra/src/index.ts' }),
			source('case-different', { logicalPath: 'Packages/csaa/src/index.ts' }),
			source('exact', { logicalPath: 'packages/csaa/' })
		];
		const evaluation = evaluated(
			input(logicalPathStartsWith('csaa-prefix', 'packages/csaa/'), records)
		);
		expect(evaluation.expression.nodes).toEqual([
			{
				childNodeIds: [],
				depth: 1,
				field: 'logicalPath',
				kind: 'LOGICAL_PATH_STARTS_WITH',
				nodeId: 'csaa-prefix',
				ordinal: 0,
				value: 'packages/csaa/'
			}
		]);
		expect(
			evaluation.recordResults.map((result) =>
				result.disposition === 'applicable-result' ? result.truth : result.disposition
			)
		).toEqual(['T', 'F', 'F', 'T']);
		const rawMidSegmentPrefix = evaluated(
			input(logicalPathStartsWith('raw-mid-segment', 'packages/csaa'), records)
		);
		expect(
			rawMidSegmentPrefix.recordResults.map((result) =>
				result.disposition === 'applicable-result' ? result.truth : result.disposition
			)
		).toEqual(['T', 'T', 'F', 'T']);
		for (const literalPrefix of ['packages\\csaa\\', 'packages/*'])
			expect(
				evaluated(input(logicalPathStartsWith('literal-only', literalPrefix), [records[0]!]))
					.recordResults[0]
			).toMatchObject({ truth: 'F' });
		expect(evaluation.recordResults[0]).toMatchObject({
			epistemic: {
				effective: {
					supportBasis: {
						method: 'jan-csaa-semantic-source-query-core/0.2.0:LOGICAL_PATH_STARTS_WITH'
					}
				}
			}
		});
		const composed = evaluated(
			input(
				{
					kind: 'AND',
					nodeId: 'prefix-and-authored',
					operands: [
						logicalPathStartsWith('prefix', 'packages/csaa/'),
						equals('authored', 'origin', 'AUTHORED')
					]
				},
				[records[0]!]
			)
		);
		expect(composed.recordResults[0]).toMatchObject({ truth: 'T' });
	});

	it('registers exact source, project, program, and provenance identity equality', () => {
		const record = source('identity');
		for (const field of ['id', 'projectId', 'programId', 'provenanceId'] as const) {
			const result = evaluated(
				input(
					{
						field,
						kind: 'EQUALS',
						nodeId: `equals-${field}`,
						value: record[field]
					} as SemanticSourceQueryExpression,
					[record]
				)
			).recordResults[0];
			expect(result).toMatchObject({ disposition: 'applicable-result', truth: 'T' });
		}
	});

	it('admits the contract-defined VIRTUAL source origin', () => {
		const evaluation = evaluated(
			input(equals('virtual-origin', 'origin', 'VIRTUAL'), [
				source('virtual', { origin: 'VIRTUAL' })
			])
		);
		expect(evaluation.recordResults).toHaveLength(1);
		expect(evaluation.recordResults[0]).toMatchObject({
			disposition: 'applicable-result',
			truth: 'T'
		});
		expect(evaluation.coverage).toMatchObject({
			counts: { supportedTrue: 1 },
			partitionsReconcile: true,
			populationRecords: 1
		});
	});

	it('preserves U, C, and not-applicable as distinct per-record partitions', () => {
		const records = [source('unknown'), source('conflict'), source('na')];
		const evaluation = evaluated(
			input(equals('leaf', 'origin', 'AUTHORED'), records, {
				evaluateLeaf: ({ record }) =>
					record.id === 'unknown'
						? leafResult('U')
						: record.id === 'conflict'
							? leafResult('C')
							: { applicability: notApplicable.applicability, disposition: 'not-applicable' }
			})
		);
		expect(evaluation.recordResults.map((result) => result.disposition)).toEqual([
			'applicable-result',
			'applicable-result',
			'not-applicable'
		]);
		expect(evaluation.coverage.counts).toEqual({
			conflicting: 1,
			notApplicable: 1,
			supportedFalse: 0,
			supportedTrue: 0,
			unknown: 1
		});
	});

	it('retains non-succeeded child execution health in the effective logical state', () => {
		const expression: SemanticSourceQueryExpression = {
			kind: 'AND',
			nodeId: 'root',
			operands: [equals('failed', 'origin', 'AUTHORED'), equals('healthy', 'rootFile', true)]
		};
		const evaluation = evaluated(
			input(expression, [source('health')], {
				evaluateLeaf: ({ expression: leaf }) =>
					leaf.nodeId === 'failed' ? leafResult('U', 'failed') : leafResult('T', 'succeeded')
			})
		);
		const result = evaluation.recordResults[0]!;
		expect(result).toMatchObject({
			disposition: 'applicable-result',
			epistemic: {
				contributions: { executionHealth: ['failed', 'succeeded'] },
				effective: { executionHealth: 'failed' }
			},
			truth: 'U'
		});
	});

	it('maps determining freshness through the swapped NOT evidence coordinates', () => {
		const evaluation = evaluated(
			input(
				{
					kind: 'NOT',
					nodeId: 'not',
					operand: equals('leaf', 'origin', 'AUTHORED')
				},
				[source('true-leaf'), source('false-leaf')],
				{
					evaluateLeaf: ({ record }) =>
						record.id === 'true-leaf' ? leafResult('T') : leafResult('F')
				}
			)
		);
		expect(
			evaluation.recordResults.map((result) =>
				result.disposition === 'applicable-result'
					? {
							freshness: result.epistemic.effective.freshness,
							truth: result.truth,
							unresolvedRegions: result.epistemic.effective.unresolvedRegions
						}
					: null
			)
		).toEqual([
			{ freshness: 'current-for-subject', truth: 'F', unresolvedRegions: [] },
			{ freshness: 'current-for-subject', truth: 'T', unresolvedRegions: [] }
		]);
	});

	it('validates the complete AST before invoking a leaf, including a nondetermining branch', () => {
		const evaluateLeaf = vi.fn(() => leafResult('F'));
		let getterHits = 0;
		const hostile = { field: 'origin', kind: 'EQUALS', nodeId: 'hostile' } as Record<
			string,
			unknown
		>;
		Object.defineProperty(hostile, 'value', {
			enumerable: true,
			get() {
				getterHits += 1;
				return 'AUTHORED';
			}
		});
		expectRefused(
			input(
				{
					kind: 'AND',
					nodeId: 'root',
					operands: [
						equals('decisive-false', 'origin', 'TEST'),
						hostile as SemanticSourceQueryExpression
					]
				} as SemanticSourceQueryExpression,
				[source('one')],
				{ evaluateLeaf }
			),
			'AST_INVALID'
		);
		expect(getterHits).toBe(0);
		expect(evaluateLeaf).not.toHaveBeenCalled();
	});

	it('rejects benign proxies at the shell, AST, population-array, record, and callback boundaries', () => {
		const expression = equals('leaf', 'origin', 'AUTHORED');
		expectRefused(new Proxy(input(expression), {}), 'INPUT_INVALID');
		expectRefused(input(new Proxy(expression, {}) as SemanticSourceQueryExpression), 'AST_INVALID');
		expectRefused(
			input(expression, new Proxy([source('one')], {}) as readonly SemanticSourceRecord[]),
			'POPULATION_BUDGET_EXCEEDED'
		);
		expectRefused(input(expression, [new Proxy(source('one'), {})]), 'POPULATION_INVALID');
		expectRefused(
			input(expression, [source('one')], {
				evaluateLeaf: new Proxy(() => leafResult('T'), {})
			}),
			'INPUT_INVALID'
		);
	});

	it('rejects lone-surrogate text in both the expression and source population', () => {
		expectRefused(input(equals('leaf', 'logicalPath', '\ud800')), 'AST_INVALID');
		expectRefused(input(logicalPathStartsWith('prefix', '\ud800')), 'AST_INVALID');
		expectRefused(
			input(equals('leaf', 'origin', 'AUTHORED'), [source('one', { logicalPath: '\ud800' })]),
			'POPULATION_INVALID'
		);
	});

	it('enforces exact closed shapes, nonempty operands, unique nodes, and acyclic tree ownership', () => {
		const leaf = equals('leaf', 'origin', 'AUTHORED');
		const cycle = { kind: 'NOT', nodeId: 'cycle', operand: null } as unknown as {
			kind: 'NOT';
			nodeId: string;
			operand: SemanticSourceQueryExpression;
		};
		cycle.operand = cycle;
		for (const candidate of [
			{ ...leaf, extra: true },
			{ field: 'logicalPath', kind: 'LOGICAL_PATH_STARTS_WITH', nodeId: 'empty-prefix', value: '' },
			{
				field: 'origin',
				kind: 'LOGICAL_PATH_STARTS_WITH',
				nodeId: 'alien-prefix-field',
				value: 'packages/'
			},
			{
				extra: true,
				field: 'logicalPath',
				kind: 'LOGICAL_PATH_STARTS_WITH',
				nodeId: 'wide-prefix',
				value: 'packages/'
			},
			{ kind: 'AND', nodeId: 'empty', operands: [] },
			{ kind: 'AND', nodeId: 'shared', operands: [leaf, leaf] },
			{
				kind: 'OR',
				nodeId: 'duplicate-parent',
				operands: [leaf, { ...leaf }]
			},
			cycle
		])
			expectRefused(input(candidate as SemanticSourceQueryExpression), 'AST_INVALID');
	});

	it('enforces caller budgets and absolute safety ceilings before evaluation', () => {
		const expression: SemanticSourceQueryExpression = {
			kind: 'AND',
			nodeId: 'root',
			operands: [equals('left', 'origin', 'AUTHORED'), equals('right', 'rootFile', true)]
		};
		for (const [key, value, code] of [
			['maxNodes', 2, 'AST_BUDGET_EXCEEDED'],
			['maxDepth', 1, 'AST_BUDGET_EXCEEDED'],
			['maxFanout', 1, 'AST_BUDGET_EXCEEDED'],
			['maxPopulation', 1, 'POPULATION_BUDGET_EXCEEDED'],
			['maxEvaluations', 5, 'EVALUATION_BUDGET_EXCEEDED'],
			['maxTraceNodes', 5, 'EVALUATION_BUDGET_EXCEEDED']
		] as const)
			expectRefused(
				input(expression, [source('one'), source('two')], {
					budgets: { ...budgets, [key]: value }
				}),
				code
			);
		expectRefused(
			input(expression, [source('one')], {
				budgets: {
					...budgets,
					maxNodes: SEMANTIC_SOURCE_QUERY_SAFETY_CEILINGS.maxNodes + 1
				}
			}),
			'INPUT_INVALID'
		);
	});

	it('refuses aggregate evidence vectors and standalone algebra fanout beyond fixed ceilings', () => {
		const expression: SemanticSourceQueryExpression = {
			kind: 'AND',
			nodeId: 'root',
			operands: [equals('left', 'origin', 'AUTHORED'), equals('right', 'rootFile', true)]
		};
		for (const vector of ['evidenceRefs', 'unresolvedRegions'] as const)
			expectRefused(
				input(expression, [source('one')], {
					evaluateLeaf: ({ expression: leaf }) => {
						const offset = leaf.nodeId === 'left' ? 0 : 40;
						const values = Array.from({ length: 40 }, (_, index) => `${vector}:${offset + index}`);
						return {
							...leafResult('T'),
							epistemic: epistemic('succeeded', {
								unresolvedRegions: vector === 'unresolvedRegions' ? values : []
							}),
							evidenceRefs: vector === 'evidenceRefs' ? values : ['shared-ref']
						};
					}
				}),
				'EVALUATION_BUDGET_EXCEEDED'
			);

		expect(() =>
			semanticQueryAnd(
				Array.from({ length: SEMANTIC_SOURCE_QUERY_SAFETY_CEILINGS.maxFanout + 1 }, () =>
					applicable('T')
				) as unknown as [SemanticQueryProjection, ...SemanticQueryProjection[]]
			)
		).toThrow(/fanout ceiling/u);

		expectRefused(
			input(
				{
					kind: 'AND',
					nodeId: 'unknown-root',
					operands: [equals('unknown-leaf', 'origin', 'AUTHORED')]
				},
				[source('one')],
				{
					evaluateLeaf: () => ({
						...leafResult('U'),
						epistemic: epistemic('succeeded', {
							unresolvedRegions: Array.from({ length: 64 }, (_, index) => `region:${index}`)
						})
					})
				}
			),
			'EVALUATION_BUDGET_EXCEEDED'
		);
	});

	it('refuses unsafe leaf output and does not expose exception text', () => {
		expectRefused(
			input(equals('leaf', 'origin', 'AUTHORED'), [source('one')], {
				evaluateLeaf: () => ({
					...leafResult('C'),
					epistemic: epistemic('succeeded', { conflict: 'unopposed' })
				})
			}),
			'LEAF_EVALUATION_FAILED'
		);
		expectRefused(
			input(equals('leaf', 'origin', 'AUTHORED'), [source('one')], {
				evaluateLeaf: () => {
					throw new Error('secret exception text');
				}
			}),
			'LEAF_EVALUATION_FAILED'
		);
		const outcome = evaluateSemanticSourceQuery(
			input(equals('leaf', 'origin', 'AUTHORED'), [source('one')], {
				evaluateLeaf: () => {
					throw new Error('secret exception text');
				}
			})
		);
		expect(JSON.stringify(outcome)).not.toContain('secret exception text');
	});
});
