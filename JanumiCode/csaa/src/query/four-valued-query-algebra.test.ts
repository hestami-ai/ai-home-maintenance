import { describe, expect, it } from 'vitest';

import {
	FOUR_VALUED_QUERY_ALGEBRA_VERSION,
	FOUR_VALUED_QUERY_SAFETY_CEILINGS,
	FOUR_VALUED_TRUTHS,
	evaluateFourValuedExpression,
	evidencePairForFourValuedTruth,
	fourValuedAll,
	fourValuedAnd,
	fourValuedAny,
	fourValuedNot,
	fourValuedOr,
	fourValuedTruthForEvidencePair,
	type EvaluateFourValuedExpressionInput,
	type FourValuedExpression,
	type FourValuedExpressionEvaluation,
	type FourValuedQueryBudgets,
	type FourValuedTruth
} from './four-valued-query-algebra.js';

const budgets: FourValuedQueryBudgets = {
	maxDepth: 16,
	maxEvaluations: 256,
	maxFanout: 32,
	maxNodes: 256,
	maxTraceNodes: 256
};

const closedComplete = { closure: 'CLOSED', completeness: 'COMPLETE' } as const;
const openComplete = { closure: 'OPEN', completeness: 'COMPLETE' } as const;
const closedIncomplete = { closure: 'CLOSED', completeness: 'INCOMPLETE' } as const;

function value(nodeId: string, truth: FourValuedTruth): FourValuedExpression {
	return { kind: 'VALUE', nodeId, truth };
}

function input(
	expression: FourValuedExpression,
	overrides: Partial<EvaluateFourValuedExpressionInput> = {}
): EvaluateFourValuedExpressionInput {
	return { budgets, expression, mode: 'EAGER', ...overrides };
}

function evaluated(candidate: unknown): FourValuedExpressionEvaluation {
	const outcome = evaluateFourValuedExpression(candidate);
	if (outcome.state !== 'EVALUATED') throw new Error(JSON.stringify(outcome));
	return outcome.evaluation;
}

function expectRefused(candidate: unknown, code: string): void {
	expect(evaluateFourValuedExpression(candidate)).toMatchObject({
		diagnostic: { code },
		state: 'REFUSED'
	});
}

function vectors(length: number): FourValuedTruth[][] {
	if (length === 0) return [[]];
	return vectors(length - 1).flatMap((prefix) =>
		FOUR_VALUED_TRUTHS.map((truth) => [...prefix, truth])
	);
}

function expressionForVector(
	kind: 'AND' | 'OR' | 'ALL' | 'ANY',
	truths: readonly FourValuedTruth[]
): FourValuedExpression {
	const children = truths.map((truth, index) => value(`value-${index}`, truth));
	if (kind === 'AND' || kind === 'OR') {
		if (children.length === 0) throw new Error('AND and OR test vectors must be nonempty.');
		const operands = children as [FourValuedExpression, ...FourValuedExpression[]];
		return kind === 'AND'
			? { kind: 'AND', nodeId: 'root', operands }
			: { kind: 'OR', nodeId: 'root', operands };
	}
	return {
		...closedComplete,
		kind,
		members: children,
		nodeId: 'root'
	};
}

function expectDeeplyFrozen(valueToInspect: unknown): void {
	const seen = new WeakSet<object>();
	const stack: unknown[] = [valueToInspect];
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

describe('four-valued evidence-pair algebra', () => {
	it('round-trips the exact TRUE, FALSE, UNKNOWN, and CONFLICT support pairs', () => {
		expect(
			FOUR_VALUED_TRUTHS.map((truth) => [
				truth,
				evidencePairForFourValuedTruth(truth),
				fourValuedTruthForEvidencePair(evidencePairForFourValuedTruth(truth))
			])
		).toEqual([
			['TRUE', { falseSupport: 0, trueSupport: 1 }, 'TRUE'],
			['FALSE', { falseSupport: 1, trueSupport: 0 }, 'FALSE'],
			['UNKNOWN', { falseSupport: 0, trueSupport: 0 }, 'UNKNOWN'],
			['CONFLICT', { falseSupport: 1, trueSupport: 1 }, 'CONFLICT']
		]);
	});

	it('implements exact negation and exhaustive AND/OR truth tables', () => {
		const andTable = [
			['TRUE', 'FALSE', 'UNKNOWN', 'CONFLICT'],
			['FALSE', 'FALSE', 'FALSE', 'FALSE'],
			['UNKNOWN', 'FALSE', 'UNKNOWN', 'FALSE'],
			['CONFLICT', 'FALSE', 'FALSE', 'CONFLICT']
		] as const;
		const orTable = [
			['TRUE', 'TRUE', 'TRUE', 'TRUE'],
			['TRUE', 'FALSE', 'UNKNOWN', 'CONFLICT'],
			['TRUE', 'UNKNOWN', 'UNKNOWN', 'TRUE'],
			['TRUE', 'CONFLICT', 'TRUE', 'CONFLICT']
		] as const;
		expect(FOUR_VALUED_TRUTHS.map(fourValuedNot)).toEqual(['FALSE', 'TRUE', 'UNKNOWN', 'CONFLICT']);
		for (const [leftIndex, left] of FOUR_VALUED_TRUTHS.entries())
			for (const [rightIndex, right] of FOUR_VALUED_TRUTHS.entries()) {
				expect(fourValuedAnd([left, right])).toBe(andTable[leftIndex]![rightIndex]);
				expect(fourValuedOr([left, right])).toBe(orTable[leftIndex]![rightIndex]);
			}
	});

	it('satisfies involution, commutativity, associativity, and both De Morgan laws', () => {
		for (const left of FOUR_VALUED_TRUTHS) {
			expect(fourValuedNot(fourValuedNot(left))).toBe(left);
			for (const right of FOUR_VALUED_TRUTHS) {
				expect(fourValuedAnd([left, right])).toBe(fourValuedAnd([right, left]));
				expect(fourValuedOr([left, right])).toBe(fourValuedOr([right, left]));
				expect(fourValuedNot(fourValuedAnd([left, right]))).toBe(
					fourValuedOr([fourValuedNot(left), fourValuedNot(right)])
				);
				expect(fourValuedNot(fourValuedOr([left, right]))).toBe(
					fourValuedAnd([fourValuedNot(left), fourValuedNot(right)])
				);
				for (const third of FOUR_VALUED_TRUTHS) {
					expect(fourValuedAnd([fourValuedAnd([left, right]), third])).toBe(
						fourValuedAnd([left, fourValuedAnd([right, third])])
					);
					expect(fourValuedOr([fourValuedOr([left, right]), third])).toBe(
						fourValuedOr([left, fourValuedOr([right, third])])
					);
				}
			}
		}
	});

	it('rejects hostile array ownership, descriptors, kinds, identities, and quantifier completeness', () => {
		const proxiedOperands = new Proxy([value('proxy-child', 'TRUE')], {});
		const sparseOperands = new Array<FourValuedExpression>(1);
		const nonEnumerableOperands = [value('hidden-child', 'TRUE')];
		Object.defineProperty(nonEnumerableOperands, '0', {
			enumerable: false,
			value: nonEnumerableOperands[0]
		});
		const sharedOperands = [value('shared-child', 'TRUE')];
		const accessor = { kind: 'VALUE', nodeId: 'accessor' } as Record<string, unknown>;
		Object.defineProperty(accessor, 'truth', {
			enumerable: true,
			get: () => 'TRUE'
		});
		for (const expression of [
			accessor,
			{ kind: 'AND', nodeId: 'proxy-array', operands: proxiedOperands },
			{ kind: 'AND', nodeId: 'sparse-array', operands: sparseOperands },
			{ kind: 'AND', nodeId: 'hidden-array', operands: nonEnumerableOperands },
			{
				kind: 'AND',
				nodeId: 'shared-array-root',
				operands: [
					{ kind: 'AND', nodeId: 'shared-array-left', operands: sharedOperands },
					{ kind: 'OR', nodeId: 'shared-array-right', operands: sharedOperands }
				]
			},
			{ kind: 'UNREGISTERED', nodeId: 'unknown-kind' },
			{
				kind: 'AND',
				nodeId: 'duplicate-root',
				operands: [value('duplicate', 'TRUE'), value('duplicate', 'FALSE')]
			},
			{
				closure: 'CLOSED',
				completeness: 'BROKEN',
				kind: 'ALL',
				members: [],
				nodeId: 'bad-completeness'
			}
		])
			expectRefused(input(expression as unknown as FourValuedExpression), 'AST_INVALID');
		expectRefused(
			input(value('bad-mode', 'TRUE'), { mode: 'INCREMENTAL' as never }),
			'INPUT_INVALID'
		);
	});

	it('rejects malformed standalone truth vectors, evidence pairs, and population boundaries', () => {
		expect(() => fourValuedAnd([] as unknown as [FourValuedTruth, ...FourValuedTruth[]])).toThrow(
			/bounded vector/u
		);
		expect(() =>
			fourValuedTruthForEvidencePair({ falseSupport: 2, trueSupport: 0 } as never)
		).toThrow(/evidence pair/u);
		expect(() => fourValuedAll([], { closure: 'CLOSED', completeness: 'BROKEN' } as never)).toThrow(
			/population boundary/u
		);
	});
});

describe('bounded ALL and ANY quantifiers', () => {
	it('uses vacuous identities only for a closed completely evaluated empty population', () => {
		expect(fourValuedAll([], closedComplete)).toBe('TRUE');
		expect(fourValuedAny([], closedComplete)).toBe('FALSE');
		for (const boundary of [openComplete, closedIncomplete]) {
			expect(fourValuedAll([], boundary)).toBe('UNKNOWN');
			expect(fourValuedAny([], boundary)).toBe('UNKNOWN');
		}
	});

	it('preserves decisive counterexamples and witnesses across an incomplete boundary', () => {
		expect(fourValuedAll(['TRUE', 'FALSE'], openComplete)).toBe('FALSE');
		expect(fourValuedAny(['FALSE', 'TRUE'], closedIncomplete)).toBe('TRUE');
		expect(fourValuedAll(['TRUE'], openComplete)).toBe('UNKNOWN');
		expect(fourValuedAny(['FALSE'], closedIncomplete)).toBe('UNKNOWN');
	});

	it('folds boundary uncertainty through the exact evidence algebra', () => {
		expect(fourValuedAll(['CONFLICT'], openComplete)).toBe('FALSE');
		expect(fourValuedAny(['CONFLICT'], openComplete)).toBe('TRUE');
		expect(fourValuedAll(['CONFLICT'], closedComplete)).toBe('CONFLICT');
		expect(fourValuedAny(['CONFLICT'], closedComplete)).toBe('CONFLICT');
	});
});

describe('four-valued expression evaluation', () => {
	it('produces deterministic normalized nodes and a node-total eager explanation trace', () => {
		const expression: FourValuedExpression = {
			kind: 'AND',
			nodeId: 'root',
			operands: [
				value('true', 'TRUE'),
				{
					kind: 'NOT',
					nodeId: 'not',
					operand: value('false', 'FALSE')
				},
				{
					...closedComplete,
					kind: 'ANY',
					members: [value('unknown', 'UNKNOWN'), value('witness', 'TRUE')],
					nodeId: 'any'
				}
			]
		};
		const first = evaluated(input(expression));
		const second = evaluated(input(expression));
		expect(second).toEqual(first);
		expect(first).toMatchObject({
			algebraVersion: FOUR_VALUED_QUERY_ALGEBRA_VERSION,
			coverage: {
				evaluatedNodes: 7,
				nodeTotalTrace: true,
				shortCircuitedNodes: 0,
				totalNodes: 7
			},
			evidencePair: { falseSupport: 0, trueSupport: 1 },
			truth: 'TRUE'
		});
		expect(
			first.expression.nodes.map((node) => [node.ordinal, node.nodeId, node.nodePath])
		).toEqual([
			[0, 'root', []],
			[1, 'true', [0]],
			[2, 'not', [1]],
			[3, 'false', [1, 0]],
			[4, 'any', [2]],
			[5, 'unknown', [2, 0]],
			[6, 'witness', [2, 1]]
		]);
		expect(first.trace.map((node) => [node.nodeId, node.disposition])).toEqual([
			['root', 'EVALUATED'],
			['true', 'EVALUATED'],
			['not', 'EVALUATED'],
			['false', 'EVALUATED'],
			['any', 'EVALUATED'],
			['unknown', 'EVALUATED'],
			['witness', 'EVALUATED']
		]);
		expectDeeplyFrozen(first);
	});

	it('proves eager and short-circuit truth equivalence exhaustively where decisive projection exists', () => {
		for (const kind of ['AND', 'OR', 'ALL', 'ANY'] as const)
			for (let length = 1; length <= 4; length += 1)
				for (const truthVector of vectors(length)) {
					const expression = expressionForVector(kind, truthVector);
					const eager = evaluated(input(expression, { mode: 'EAGER' }));
					const short = evaluated(input(expression, { mode: 'SHORT_CIRCUIT' }));
					expect(short.truth).toBe(eager.truth);
					expect(short.evidencePair).toEqual(eager.evidencePair);
					expect(short.coverage.nodeTotalTrace).toBe(true);
				}
	});

	it('preserves eager and short-circuit equivalence for open and incomplete quantifier boundaries', () => {
		for (const kind of ['ALL', 'ANY'] as const)
			for (const boundary of [
				openComplete,
				closedIncomplete,
				{ closure: 'OPEN', completeness: 'INCOMPLETE' } as const
			])
				for (let length = 0; length <= 3; length += 1)
					for (const truthVector of vectors(length)) {
						const members = truthVector.map((truth, index) => value(`value-${index}`, truth));
						const expression: FourValuedExpression = {
							...boundary,
							kind,
							members,
							nodeId: 'root'
						};
						const eager = evaluated(input(expression, { mode: 'EAGER' }));
						const short = evaluated(input(expression, { mode: 'SHORT_CIRCUIT' }));
						expect(short.truth).toBe(eager.truth);
						expect(short.evidencePair).toEqual(eager.evidencePair);
					}
	});

	it('short-circuits only on projected FALSE for AND/ALL and TRUE for OR/ANY', () => {
		for (const [kind, truths, expectedRule] of [
			['AND', ['CONFLICT', 'UNKNOWN', 'TRUE'], 'AND_FALSE'],
			['OR', ['UNKNOWN', 'CONFLICT', 'FALSE'], 'OR_TRUE'],
			['ALL', ['CONFLICT', 'UNKNOWN', 'TRUE'], 'ALL_FALSE'],
			['ANY', ['UNKNOWN', 'CONFLICT', 'FALSE'], 'ANY_TRUE']
		] as const) {
			const evaluation = evaluated(
				input(expressionForVector(kind, truths), { mode: 'SHORT_CIRCUIT' })
			);
			const root = evaluation.trace[0]!;
			expect(root).toMatchObject({
				decisiveChildId: 'value-1',
				disposition: 'EVALUATED',
				evaluatedChildNodeIds: ['value-0', 'value-1'],
				skippedChildNodeIds: ['value-2']
			});
			expect(evaluation.trace[3]).toMatchObject({
				disposition: 'SHORT_CIRCUITED',
				skippedBy: {
					ancestorNodeId: 'root',
					decisiveChildId: 'value-1',
					rule: expectedRule
				}
			});
		}
	});

	it('records exact empty and incomplete quantifier boundary explanations', () => {
		const closedAll = evaluated(
			input({ ...closedComplete, kind: 'ALL', members: [], nodeId: 'all' })
		);
		const openAny = evaluated(input({ ...openComplete, kind: 'ANY', members: [], nodeId: 'any' }));
		expect(closedAll.trace[0]).toMatchObject({
			disposition: 'EVALUATED',
			intermediateTruths: ['TRUE'],
			quantifierBoundary: {
				appliedUnknownBoundary: false,
				emptyPopulation: true,
				identityTruth: 'TRUE',
				unknownBoundaryRequired: false
			},
			truth: 'TRUE'
		});
		expect(openAny.trace[0]).toMatchObject({
			disposition: 'EVALUATED',
			intermediateTruths: ['UNKNOWN'],
			quantifierBoundary: {
				appliedUnknownBoundary: true,
				emptyPopulation: true,
				identityTruth: 'FALSE',
				unknownBoundaryRequired: true
			},
			truth: 'UNKNOWN'
		});
	});

	it('validates every subtree before short-circuiting and rejects cycles, sharing, and open shapes', () => {
		const invalidSkippedChild = {
			kind: 'VALUE',
			nodeId: 'invalid',
			truth: 'TRUE',
			unexpected: true
		};
		expectRefused(
			input(
				{
					kind: 'AND',
					nodeId: 'root',
					operands: [value('decisive', 'FALSE'), invalidSkippedChild as FourValuedExpression]
				},
				{ mode: 'SHORT_CIRCUIT' }
			),
			'AST_INVALID'
		);
		const shared = value('shared', 'TRUE');
		expectRefused(
			input({ kind: 'AND', nodeId: 'root', operands: [shared, shared] }),
			'AST_INVALID'
		);
		const cycle = { kind: 'NOT', nodeId: 'cycle', operand: null } as unknown as {
			kind: 'NOT';
			nodeId: string;
			operand: FourValuedExpression;
		};
		cycle.operand = cycle;
		expectRefused(input(cycle), 'AST_INVALID');
		expectRefused(input({ kind: 'AND', nodeId: 'empty', operands: [] } as never), 'AST_INVALID');
	});

	it('refuses malformed data and caller budgets above or below the complete AST requirement', () => {
		const expression: FourValuedExpression = {
			kind: 'AND',
			nodeId: 'root',
			operands: [value('left', 'FALSE'), value('right', 'TRUE')]
		};
		for (const [key, amount, code] of [
			['maxNodes', 2, 'AST_BUDGET_EXCEEDED'],
			['maxDepth', 1, 'AST_BUDGET_EXCEEDED'],
			['maxFanout', 1, 'AST_BUDGET_EXCEEDED'],
			['maxEvaluations', 2, 'EVALUATION_BUDGET_EXCEEDED'],
			['maxTraceNodes', 2, 'EVALUATION_BUDGET_EXCEEDED']
		] as const)
			expectRefused(
				input(expression, {
					budgets: { ...budgets, [key]: amount },
					mode: 'SHORT_CIRCUIT'
				}),
				code
			);
		expectRefused(
			input(expression, {
				budgets: {
					...budgets,
					maxNodes: FOUR_VALUED_QUERY_SAFETY_CEILINGS.maxNodes + 1
				}
			}),
			'INPUT_INVALID'
		);
		expectRefused({ ...input(expression), extra: true }, 'INPUT_INVALID');
		expectRefused(new Proxy(input(expression), {}), 'INPUT_INVALID');
		expectRefused(input(new Proxy(expression, {}) as FourValuedExpression), 'AST_INVALID');
		expectRefused(input(value('bad\ud800', 'TRUE')), 'AST_INVALID');
		expectRefused(input(value('bad-truth', 'NOT_A_TRUTH' as FourValuedTruth)), 'AST_INVALID');
		expectRefused(
			input({
				closure: 'NOT_CLOSED' as 'CLOSED',
				completeness: 'COMPLETE',
				kind: 'ALL',
				members: [],
				nodeId: 'bad-boundary'
			}),
			'AST_INVALID'
		);
	});

	it('freezes public registries, ceilings, successful results, and refusals', () => {
		expect(Object.isFrozen(FOUR_VALUED_TRUTHS)).toBe(true);
		expect(Object.isFrozen(FOUR_VALUED_QUERY_SAFETY_CEILINGS)).toBe(true);
		const success = evaluateFourValuedExpression(input(value('root', 'TRUE')));
		const refusal = evaluateFourValuedExpression({});
		expectDeeplyFrozen(success);
		expectDeeplyFrozen(refusal);
	});
});
