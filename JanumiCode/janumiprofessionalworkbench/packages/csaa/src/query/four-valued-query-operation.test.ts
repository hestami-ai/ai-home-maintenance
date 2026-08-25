import { describe, expect, it } from 'vitest';

import { canonicalSemanticJsonWitness } from '../semantic/canonical.js';
import {
	FOUR_VALUED_QUERY_OPERATION_CAPABILITY,
	FOUR_VALUED_QUERY_OPERATION_CAPABILITY_STATUS,
	FOUR_VALUED_QUERY_OPERATION_MIN_RESULT_BYTES,
	FOUR_VALUED_QUERY_OPERATION_NONCLAIMS,
	FOUR_VALUED_QUERY_OPERATION_REQUEST_SCHEMA_VERSION,
	FOUR_VALUED_QUERY_OPERATION_SAFETY_CEILINGS,
	FOUR_VALUED_QUERY_OPERATION_VERSION,
	runFourValuedQueryOperation,
	validateFourValuedQueryEvaluationReport,
	validateFourValuedQueryOperationRequest,
	type FourValuedQueryOperationEvaluatedOutcome,
	type FourValuedQueryOperationRequest
} from './four-valued-query-operation.js';
import {
	FOUR_VALUED_QUERY_SAFETY_CEILINGS,
	type FourValuedExpression,
	type FourValuedQueryBudgets,
	type FourValuedTruth
} from './four-valued-query-algebra.js';

const evaluationBudgets: FourValuedQueryBudgets = {
	maxDepth: 16,
	maxEvaluations: 256,
	maxFanout: 128,
	maxNodes: 256,
	maxTraceNodes: 256
};

function value(nodeId: string, truth: FourValuedTruth): FourValuedExpression {
	return { kind: 'VALUE', nodeId, truth };
}

function request(
	expression: FourValuedExpression,
	overrides: Partial<FourValuedQueryOperationRequest> = {}
): FourValuedQueryOperationRequest {
	return {
		budgets: {
			evaluation: evaluationBudgets,
			maxExplanationRecords: 256,
			maxResultBytes: 1024 * 1024
		},
		executionId: 'query-operation:test',
		expression,
		mode: 'EAGER',
		operationVersion: FOUR_VALUED_QUERY_OPERATION_VERSION,
		query: {
			id: 'query:test-four-valued-operation',
			purpose: 'Verify bounded four-valued truth projection.',
			version: '0.1.0'
		},
		schemaVersion: FOUR_VALUED_QUERY_OPERATION_REQUEST_SCHEMA_VERSION,
		...overrides
	};
}

function expectUnavailable(
	candidate: unknown,
	code: string,
	stage?: 'REQUEST' | 'EXPRESSION' | 'EXPLANATION' | 'RESULT'
): void {
	const outcome = runFourValuedQueryOperation(candidate);
	expect(outcome).toMatchObject({
		capabilityStatus: FOUR_VALUED_QUERY_OPERATION_CAPABILITY_STATUS,
		code,
		outcome: 'unavailable',
		...(stage === undefined ? {} : { stage })
	});
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

function evaluatedReport(
	expression: FourValuedExpression,
	overrides: Partial<FourValuedQueryOperationRequest> = {}
): FourValuedQueryOperationEvaluatedOutcome {
	const outcome = runFourValuedQueryOperation(request(expression, overrides));
	if (outcome.outcome !== 'evaluated') throw new Error(JSON.stringify(outcome));
	return outcome;
}

function mutableRecord(valueToInspect: unknown): Record<string, unknown> {
	if (
		valueToInspect === null ||
		typeof valueToInspect !== 'object' ||
		Array.isArray(valueToInspect)
	)
		throw new Error('Expected a record in test fixture.');
	return valueToInspect as Record<string, unknown>;
}

function mutableArray(valueToInspect: unknown): unknown[] {
	if (!Array.isArray(valueToInspect)) throw new Error('Expected an array in test fixture.');
	return valueToInspect;
}

describe('four-valued query operation contract', () => {
	it('emits one deterministic closed evaluated report with exact capability boundaries', () => {
		const expression: FourValuedExpression = {
			kind: 'AND',
			nodeId: 'root',
			operands: [
				value('supported', 'TRUE'),
				{ kind: 'NOT', nodeId: 'not', operand: value('false', 'FALSE') },
				{
					closure: 'OPEN',
					completeness: 'COMPLETE',
					kind: 'ALL',
					members: [],
					nodeId: 'open-empty-all'
				}
			]
		};
		const first = runFourValuedQueryOperation(request(expression));
		const second = runFourValuedQueryOperation(request(expression));
		expect(second).toEqual(first);
		expect(Object.keys(first).sort()).toEqual(
			[
				'analysisAuthority',
				'authorityTransfer',
				'capabilityStatus',
				'diagnostics',
				'gateEffect',
				'operationVersion',
				'outcome',
				'request',
				'result',
				'schemaVersion',
				'state'
			].sort()
		);
		expect(first).toMatchObject({
			analysisAuthority: 'NONE',
			authorityTransfer: 'NONE',
			capabilityStatus: 'IMPLEMENTATION_LOCAL_UNREGISTERED',
			diagnostics: [],
			gateEffect: 'NONE',
			outcome: 'evaluated',
			result: {
				capability: {
					fullJanCsaaCapability029SemanticQuery: 'NOT_CLAIMED',
					id: FOUR_VALUED_QUERY_OPERATION_CAPABILITY,
					registeredJanCsaa007Operation: 'NOT_CLAIMED',
					status: FOUR_VALUED_QUERY_OPERATION_CAPABILITY_STATUS
				},
				conclusion: 'UNKNOWN',
				currentness: 'NOT_ASSESSED_NO_SUBJECT_BOUND',
				query: {
					populationBinding: 'CALLER_SUPPLIED_LITERAL_TRUTH_PROJECTIONS_ONLY',
					quantifierBoundaryBasis: 'CALLER_DECLARED_UNVERIFIED',
					queryId: 'query:test-four-valued-operation',
					rootNodeId: 'root'
				}
			},
			state: 'evaluated'
		});
		if (first.outcome !== 'evaluated') throw new Error(JSON.stringify(first));
		expect(first.request).not.toHaveProperty('expression');
		expect(first.result.facadeNonclaims).toBe(FOUR_VALUED_QUERY_OPERATION_NONCLAIMS);
		expect(canonicalSemanticJsonWitness(first).bytes + 1).toBeLessThanOrEqual(
			first.request.budgets.maxResultBytes
		);
		expectDeeplyFrozen(first);
	});

	it('retains exact TRUE, FALSE, UNKNOWN, and CONFLICT conclusions and support pairs', () => {
		for (const [truth, pair] of [
			['TRUE', { falseSupport: 0, trueSupport: 1 }],
			['FALSE', { falseSupport: 1, trueSupport: 0 }],
			['UNKNOWN', { falseSupport: 0, trueSupport: 0 }],
			['CONFLICT', { falseSupport: 1, trueSupport: 1 }]
		] as const) {
			const outcome = runFourValuedQueryOperation(request(value(`literal-${truth}`, truth)));
			expect(outcome).toMatchObject({
				outcome: 'evaluated',
				result: { conclusion: truth, evaluation: { evidencePair: pair, truth } }
			});
		}
	});

	it('uses vacuous identities only for closed complete empty quantifier populations', () => {
		for (const [kind, expectedClosed] of [
			['ALL', 'TRUE'],
			['ANY', 'FALSE']
		] as const) {
			for (const [closure, completeness, expected] of [
				['CLOSED', 'COMPLETE', expectedClosed],
				['OPEN', 'COMPLETE', 'UNKNOWN'],
				['CLOSED', 'INCOMPLETE', 'UNKNOWN']
			] as const) {
				const outcome = runFourValuedQueryOperation(
					request({ closure, completeness, kind, members: [], nodeId: `${kind}:${closure}` })
				);
				expect(outcome).toMatchObject({
					outcome: 'evaluated',
					result: {
						conclusion: expected,
						explanation: {
							accounting: {
								declaredQuantifierNodes: 1,
								emptyEvaluatedQuantifierNodes: 1,
								evaluatedQuantifierNodes: 1,
								unknownBoundaryApplications: expected === 'UNKNOWN' ? 1 : 0
							}
						}
					}
				});
			}
		}
	});

	it('accounts for every normalized child reference through a short-circuited subtree', () => {
		const expression: FourValuedExpression = {
			kind: 'AND',
			nodeId: 'root',
			operands: [
				value('decisive-false', 'FALSE'),
				{
					kind: 'OR',
					nodeId: 'skipped-or',
					operands: [value('skipped-left', 'TRUE'), value('skipped-right', 'FALSE')]
				}
			]
		};
		const outcome = runFourValuedQueryOperation(request(expression, { mode: 'SHORT_CIRCUIT' }));
		expect(outcome).toMatchObject({
			outcome: 'evaluated',
			result: {
				conclusion: 'FALSE',
				explanation: {
					accounting: {
						allDeclaredChildReferencesAccounted: true,
						declaredChildReferences: 4,
						dispositionCountsReconcile: true,
						evaluatedChildReferences: 1,
						evaluatedNodes: 2,
						normalizedNodes: 5,
						ordinalSequenceExact: true,
						shortCircuitedImmediateChildReferences: 1,
						shortCircuitedNodes: 3,
						traceNodeTotal: true,
						unevaluatedDescendantChildReferences: 2
					}
				}
			}
		});
		if (outcome.outcome !== 'evaluated') throw new Error(JSON.stringify(outcome));
		expect(outcome.result.evaluation.trace.map((node) => node.disposition)).toEqual([
			'EVALUATED',
			'EVALUATED',
			'SHORT_CIRCUITED',
			'SHORT_CIRCUITED',
			'SHORT_CIRCUITED'
		]);
	});
});

describe('four-valued query operation admission and budgets', () => {
	it('validates hostile input without retaining the caller expression capability', () => {
		const valid = validateFourValuedQueryOperationRequest(request(value('root', 'TRUE')));
		expect(valid).toMatchObject({
			request: { expressionNodeCount: 1, expressionRootNodeId: 'root' },
			state: 'VALIDATED'
		});
		if (valid.state !== 'VALIDATED') throw new Error(JSON.stringify(valid));
		expect(valid.request).not.toHaveProperty('expression');
		expectDeeplyFrozen(valid);

		let getterHits = 0;
		const accessorRequest = request(value('root', 'TRUE')) as unknown as Record<string, unknown>;
		Object.defineProperty(accessorRequest, 'expression', {
			enumerable: true,
			get() {
				getterHits += 1;
				return value('getter', 'TRUE');
			}
		});
		expect(validateFourValuedQueryOperationRequest(accessorRequest)).toMatchObject({
			diagnostic: { code: 'REQUEST_SHAPE_INVALID' },
			state: 'REFUSED'
		});
		expect(getterHits).toBe(0);
	});

	it('rejects open shells, nested budget drift, proxies, bad versions, modes, and text', () => {
		const base = request(value('root', 'TRUE'));
		for (const candidate of [
			{ ...base, extra: true },
			{ ...base, budgets: { ...base.budgets, extra: 1 } },
			{
				...base,
				budgets: {
					...base.budgets,
					evaluation: { ...base.budgets.evaluation, extra: 1 }
				}
			},
			{ ...base, executionId: 'bad\ud800' },
			{ ...base, mode: 'LAZY' },
			{ ...base, query: { ...base.query, extra: true } },
			{ ...base, query: { ...base.query, purpose: 'bad\ud800' } },
			{ ...base, operationVersion: 'other' },
			{ ...base, schemaVersion: 'other' },
			new Proxy(base, {})
		])
			expect(runFourValuedQueryOperation(candidate)).toMatchObject({ outcome: 'unavailable' });
		expectUnavailable({ ...base, extra: true }, 'REQUEST_SHAPE_INVALID', 'REQUEST');
	});

	it('maps malformed, cyclic, shared, and over-budget expressions to closed refusals', () => {
		const shared = value('shared', 'TRUE');
		const cycle = { kind: 'NOT', nodeId: 'cycle', operand: null } as unknown as {
			kind: 'NOT';
			nodeId: string;
			operand: FourValuedExpression;
		};
		cycle.operand = cycle;
		for (const expression of [
			{ ...value('wide', 'TRUE'), extra: true },
			{ kind: 'AND', nodeId: 'empty', operands: [] },
			{ kind: 'AND', nodeId: 'sharing', operands: [shared, shared] },
			cycle,
			new Proxy(value('proxied', 'TRUE'), {})
		])
			expectUnavailable(
				request(expression as FourValuedExpression),
				'EXPRESSION_INVALID',
				'EXPRESSION'
			);

		const twoNodes: FourValuedExpression = {
			kind: 'NOT',
			nodeId: 'not',
			operand: value('leaf', 'TRUE')
		};
		expectUnavailable(
			request(twoNodes, {
				budgets: {
					...request(twoNodes).budgets,
					evaluation: { ...evaluationBudgets, maxNodes: 1 }
				}
			}),
			'EXPRESSION_BUDGET_EXCEEDED',
			'EXPRESSION'
		);
	});

	it('enforces explanation-record and exact canonical result-byte budgets independently', () => {
		const expression: FourValuedExpression = {
			kind: 'AND',
			nodeId: 'root',
			operands: [value('left', 'TRUE'), value('right', 'TRUE')]
		};
		expectUnavailable(
			request(expression, {
				budgets: { ...request(expression).budgets, maxExplanationRecords: 2 }
			}),
			'EXPLANATION_BUDGET_EXCEEDED',
			'EXPLANATION'
		);
		expectUnavailable(
			request(expression, {
				budgets: {
					...request(expression).budgets,
					maxResultBytes: FOUR_VALUED_QUERY_OPERATION_MIN_RESULT_BYTES - 1
				}
			}),
			'REQUEST_RESULT_BUDGET_TOO_SMALL',
			'REQUEST'
		);

		const wideExpression: FourValuedExpression = {
			kind: 'AND',
			nodeId: 'wide-root',
			operands: Array.from({ length: 100 }, (_, index) =>
				value(`wide-literal-${index}`, index % 2 === 0 ? 'TRUE' : 'UNKNOWN')
			) as [FourValuedExpression, ...FourValuedExpression[]]
		};
		const resultBudgetRefusal = runFourValuedQueryOperation(
			request(wideExpression, {
				budgets: {
					evaluation: evaluationBudgets,
					maxExplanationRecords: 256,
					maxResultBytes: FOUR_VALUED_QUERY_OPERATION_MIN_RESULT_BYTES
				}
			})
		);
		expect(resultBudgetRefusal).toMatchObject({
			code: 'RESULT_BUDGET_EXCEEDED',
			outcome: 'unavailable',
			stage: 'RESULT',
			state: 'resource-refused'
		});
		expect(canonicalSemanticJsonWitness(resultBudgetRefusal).bytes + 1).toBeLessThanOrEqual(
			FOUR_VALUED_QUERY_OPERATION_MIN_RESULT_BYTES
		);
	});

	it('admits a report at its exact canonical byte boundary and refuses one byte less', () => {
		const expression: FourValuedExpression = {
			kind: 'AND',
			nodeId: 'exact-byte-root',
			operands: Array.from({ length: 100 }, (_, index) =>
				value(`exact-byte-literal-${index}`, index % 2 === 0 ? 'TRUE' : 'UNKNOWN')
			) as [FourValuedExpression, ...FourValuedExpression[]]
		};
		let exactBudget = 1024 * 1024;
		let admitted = evaluatedReport(expression, {
			budgets: {
				evaluation: evaluationBudgets,
				maxExplanationRecords: 256,
				maxResultBytes: exactBudget
			}
		});
		for (let attempt = 0; attempt < 8; attempt += 1) {
			const observedBytes = canonicalSemanticJsonWitness(admitted).bytes + 1;
			if (observedBytes === exactBudget) break;
			exactBudget = observedBytes;
			admitted = evaluatedReport(expression, {
				budgets: {
					evaluation: evaluationBudgets,
					maxExplanationRecords: 256,
					maxResultBytes: exactBudget
				}
			});
		}
		expect(exactBudget).toBeGreaterThan(FOUR_VALUED_QUERY_OPERATION_MIN_RESULT_BYTES);
		expect(canonicalSemanticJsonWitness(admitted).bytes + 1).toBe(exactBudget);
		expect(
			runFourValuedQueryOperation(
				request(expression, {
					budgets: {
						evaluation: evaluationBudgets,
						maxExplanationRecords: 256,
						maxResultBytes: exactBudget - 1
					}
				})
			)
		).toMatchObject({
			code: 'RESULT_BUDGET_EXCEEDED',
			outcome: 'unavailable',
			stage: 'RESULT',
			state: 'resource-refused'
		});
	});

	it('keeps post-validation terminal refusals within budget for maximum-width identities', () => {
		const control = '\u0001';
		const identityOverrides = {
			executionId: control.repeat(1_024),
			query: {
				id: control.repeat(1_024),
				purpose: control.repeat(4_096),
				version: control.repeat(1_024)
			}
		};
		const explanationExpression: FourValuedExpression = {
			kind: 'AND',
			nodeId: 'explanation-root',
			operands: [value('explanation-left', 'TRUE'), value('explanation-right', 'TRUE')]
		};
		const explanationRefusal = runFourValuedQueryOperation(
			request(explanationExpression, {
				...identityOverrides,
				budgets: {
					evaluation: evaluationBudgets,
					maxExplanationRecords: 2,
					maxResultBytes: FOUR_VALUED_QUERY_OPERATION_MIN_RESULT_BYTES
				}
			})
		);
		expect(explanationRefusal).toMatchObject({
			code: 'EXPLANATION_BUDGET_EXCEEDED',
			outcome: 'unavailable',
			state: 'resource-refused'
		});
		expect(explanationRefusal).not.toHaveProperty('request');
		expect(canonicalSemanticJsonWitness(explanationRefusal).bytes + 1).toBeLessThanOrEqual(
			FOUR_VALUED_QUERY_OPERATION_MIN_RESULT_BYTES
		);

		const resultExpression: FourValuedExpression = {
			kind: 'AND',
			nodeId: 'result-root',
			operands: Array.from({ length: 100 }, (_, index) =>
				value(`result-literal-${index}`, index % 2 === 0 ? 'TRUE' : 'UNKNOWN')
			) as [FourValuedExpression, ...FourValuedExpression[]]
		};
		const resultRefusal = runFourValuedQueryOperation(
			request(resultExpression, {
				...identityOverrides,
				budgets: {
					evaluation: evaluationBudgets,
					maxExplanationRecords: 256,
					maxResultBytes: FOUR_VALUED_QUERY_OPERATION_MIN_RESULT_BYTES
				}
			})
		);
		expect(resultRefusal).toMatchObject({
			code: 'RESULT_BUDGET_EXCEEDED',
			outcome: 'unavailable',
			state: 'resource-refused'
		});
		expect(resultRefusal).not.toHaveProperty('request');
		expect(canonicalSemanticJsonWitness(resultRefusal).bytes + 1).toBeLessThanOrEqual(
			FOUR_VALUED_QUERY_OPERATION_MIN_RESULT_BYTES
		);
	});

	it('freezes the operation registry, limits, validation refusals, and terminal refusals', () => {
		expect(Object.isFrozen(FOUR_VALUED_QUERY_OPERATION_NONCLAIMS)).toBe(true);
		expect(Object.isFrozen(FOUR_VALUED_QUERY_OPERATION_SAFETY_CEILINGS)).toBe(true);
		expect(Object.isFrozen(FOUR_VALUED_QUERY_OPERATION_SAFETY_CEILINGS.evaluation)).toBe(true);
		expectDeeplyFrozen(validateFourValuedQueryOperationRequest({}));
		expectDeeplyFrozen(runFourValuedQueryOperation({}));
		expect(FOUR_VALUED_QUERY_OPERATION_SAFETY_CEILINGS.maxResultBytes).toBeGreaterThanOrEqual(
			FOUR_VALUED_QUERY_OPERATION_MIN_RESULT_BYTES
		);
	});
});

describe('four-valued query evaluated-report validation', () => {
	const expression: FourValuedExpression = {
		kind: 'AND',
		nodeId: 'report-root',
		operands: [
			value('report-false', 'FALSE'),
			{
				kind: 'OR',
				nodeId: 'report-skipped-or',
				operands: [value('report-true', 'TRUE'), value('report-unknown', 'UNKNOWN')]
			}
		]
	};

	it('accepts only an exact reproducible evaluated report and returns a detached frozen copy', () => {
		const report = evaluatedReport(expression, { mode: 'SHORT_CIRCUIT' });
		const validation = validateFourValuedQueryEvaluationReport(report);
		expect(validation).toMatchObject({ state: 'VALID' });
		if (validation.state !== 'VALID') throw new Error(JSON.stringify(validation));
		expect(validation.report).toEqual(report);
		expect(validation.report).not.toBe(report);
		expect(validation.report.result).not.toBe(report.result);
		expectDeeplyFrozen(validation);
	});

	it('rejects envelope, conclusion, evidence, trace, accounting, query, and nonclaim drift', () => {
		const report = evaluatedReport(expression, { mode: 'SHORT_CIRCUIT' });
		const tamperers: readonly ((candidate: Record<string, unknown>) => void)[] = [
			(candidate) => {
				candidate.analysisAuthority = 'SELF_ASSERTED';
			},
			(candidate) => {
				mutableRecord(candidate.result).conclusion = 'TRUE';
			},
			(candidate) => {
				const result = mutableRecord(candidate.result);
				const evaluation = mutableRecord(result.evaluation);
				mutableRecord(evaluation.evidencePair).trueSupport = 1;
			},
			(candidate) => {
				const result = mutableRecord(candidate.result);
				const evaluation = mutableRecord(result.evaluation);
				mutableRecord(mutableArray(evaluation.trace)[0]).ordinal = 99;
			},
			(candidate) => {
				const result = mutableRecord(candidate.result);
				const explanation = mutableRecord(result.explanation);
				mutableRecord(explanation.accounting).evaluatedNodes = 99;
			},
			(candidate) => {
				const result = mutableRecord(candidate.result);
				mutableRecord(result.query).queryPurpose = 'A different ungoverned purpose.';
			},
			(candidate) => {
				const result = mutableRecord(candidate.result);
				mutableArray(result.facadeNonclaims)[0] = 'CAPABILITY_NOW_CLAIMED';
			},
			(candidate) => {
				candidate.extra = true;
			}
		];

		for (const tamper of tamperers) {
			const candidate = mutableRecord(structuredClone(report));
			tamper(candidate);
			expect(validateFourValuedQueryEvaluationReport(candidate)).toMatchObject({
				diagnostic: { code: 'EVALUATED_REPORT_INVALID', stage: 'RESULT' },
				state: 'INVALID'
			});
		}
	});

	it('rejects hostile report containers without invoking accessors or proxy traps', () => {
		const report = evaluatedReport(expression, { mode: 'SHORT_CIRCUIT' });
		const accessorCandidate = mutableRecord(structuredClone(report));
		const resultDescriptor = Reflect.getOwnPropertyDescriptor(accessorCandidate, 'result');
		if (resultDescriptor === undefined || !('value' in resultDescriptor))
			throw new Error('Expected a data descriptor in test fixture.');
		let getterHits = 0;
		Object.defineProperty(accessorCandidate, 'result', {
			configurable: true,
			enumerable: true,
			get() {
				getterHits += 1;
				return resultDescriptor.value;
			}
		});
		expect(validateFourValuedQueryEvaluationReport(accessorCandidate)).toMatchObject({
			state: 'INVALID'
		});
		expect(getterHits).toBe(0);

		let proxyTrapHits = 0;
		const proxyCandidate = new Proxy(report, {
			get() {
				proxyTrapHits += 1;
				throw new Error('Proxy trap must not run.');
			}
		});
		expect(validateFourValuedQueryEvaluationReport(proxyCandidate)).toMatchObject({
			state: 'INVALID'
		});
		expect(proxyTrapHits).toBe(0);
	});

	it('rejects cyclic, shared, sparse, symbol-bearing, and non-scalar report data', () => {
		const report = evaluatedReport(expression, { mode: 'SHORT_CIRCUIT' });
		const cycle = mutableRecord(structuredClone(report));
		mutableRecord(cycle.request).query = cycle;

		const shared = mutableRecord(structuredClone(report));
		const sharedQuery = mutableRecord(mutableRecord(shared.request).query);
		mutableRecord(shared.result).query = sharedQuery;

		const sparse = mutableRecord(structuredClone(report));
		const trace = mutableArray(mutableRecord(mutableRecord(sparse.result).evaluation).trace);
		delete trace[0];

		const symbolBearing = mutableRecord(structuredClone(report));
		Object.defineProperty(symbolBearing, Symbol('extra'), {
			enumerable: true,
			value: true
		});

		const loneSurrogate = mutableRecord(structuredClone(report));
		mutableRecord(mutableRecord(loneSurrogate.request).query).purpose = 'bad\ud800';

		for (const candidate of [cycle, shared, sparse, symbolBearing, loneSurrogate])
			expect(validateFourValuedQueryEvaluationReport(candidate)).toMatchObject({
				state: 'INVALID'
			});
	});

	it('refuses oversized arrays, node sets, fanout, and flat-encoded depth before reconstruction', () => {
		const report = evaluatedReport(expression, { mode: 'SHORT_CIRCUIT' });
		const oversizedArray = new Array<null>(100_001).fill(null);

		const oversizedNodes = mutableRecord(structuredClone(report));
		const oversizedNodesExpression = mutableRecord(
			mutableRecord(mutableRecord(oversizedNodes.result).evaluation).expression
		);
		oversizedNodesExpression.nodes = Array.from(
			{ length: FOUR_VALUED_QUERY_SAFETY_CEILINGS.maxNodes + 1 },
			(_, index) => ({
				childNodeIds: [],
				kind: 'VALUE',
				nodeId: `oversized-node-${index}`,
				truth: 'TRUE'
			})
		);
		oversizedNodesExpression.rootNodeId = 'oversized-node-0';

		const oversizedFanout = mutableRecord(structuredClone(report));
		const oversizedFanoutExpression = mutableRecord(
			mutableRecord(mutableRecord(oversizedFanout.result).evaluation).expression
		);
		oversizedFanoutExpression.nodes = [
			{
				childNodeIds: Array.from(
					{ length: FOUR_VALUED_QUERY_SAFETY_CEILINGS.maxFanout + 1 },
					(_, index) => `fanout-child-${index}`
				),
				kind: 'AND',
				nodeId: 'fanout-root'
			}
		];
		oversizedFanoutExpression.rootNodeId = 'fanout-root';

		const overDepth = mutableRecord(structuredClone(report));
		const overDepthExpression = mutableRecord(
			mutableRecord(mutableRecord(overDepth.result).evaluation).expression
		);
		overDepthExpression.nodes = Array.from(
			{ length: FOUR_VALUED_QUERY_SAFETY_CEILINGS.maxDepth + 1 },
			(_, index) =>
				index === FOUR_VALUED_QUERY_SAFETY_CEILINGS.maxDepth
					? {
							childNodeIds: [],
							kind: 'VALUE',
							nodeId: `depth-node-${index}`,
							truth: 'TRUE'
						}
					: {
							childNodeIds: [`depth-node-${index + 1}`],
							kind: 'NOT',
							nodeId: `depth-node-${index}`
						}
		);
		overDepthExpression.rootNodeId = 'depth-node-0';

		for (const candidate of [oversizedArray, oversizedNodes, oversizedFanout, overDepth])
			expect(validateFourValuedQueryEvaluationReport(candidate)).toMatchObject({
				diagnostic: { code: 'EVALUATED_REPORT_INVALID' },
				state: 'INVALID'
			});
	});
});
