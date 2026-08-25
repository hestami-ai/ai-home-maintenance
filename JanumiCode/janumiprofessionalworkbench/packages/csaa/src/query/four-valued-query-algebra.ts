import { isProxy } from 'node:util/types';

export const FOUR_VALUED_QUERY_ALGEBRA_VERSION =
	'jan-csaa-four-valued-query-algebra/0.1.0' as const;

export const FOUR_VALUED_TRUTHS = Object.freeze(['TRUE', 'FALSE', 'UNKNOWN', 'CONFLICT'] as const);

export const FOUR_VALUED_QUERY_SAFETY_CEILINGS = Object.freeze({
	maxDepth: 64,
	maxEvaluations: 4_096,
	maxFanout: 256,
	maxNodes: 4_096,
	maxTraceNodes: 4_096
} as const);

export type FourValuedTruth = (typeof FOUR_VALUED_TRUTHS)[number];
export type FourValuedSupportBit = 0 | 1;
export type FourValuedEvaluationMode = 'EAGER' | 'SHORT_CIRCUIT';
export type FourValuedPopulationClosure = 'CLOSED' | 'OPEN';
export type FourValuedEvaluationCompleteness = 'COMPLETE' | 'INCOMPLETE';

export interface FourValuedEvidencePair {
	readonly falseSupport: FourValuedSupportBit;
	readonly trueSupport: FourValuedSupportBit;
}

export interface FourValuedPopulationBoundary {
	readonly closure: FourValuedPopulationClosure;
	readonly completeness: FourValuedEvaluationCompleteness;
}

export interface FourValuedLiteralExpression {
	readonly kind: 'VALUE';
	readonly nodeId: string;
	readonly truth: FourValuedTruth;
}

export interface FourValuedNotExpression {
	readonly kind: 'NOT';
	readonly nodeId: string;
	readonly operand: FourValuedExpression;
}

export interface FourValuedAndExpression {
	readonly kind: 'AND';
	readonly nodeId: string;
	readonly operands: readonly [FourValuedExpression, ...FourValuedExpression[]];
}

export interface FourValuedOrExpression {
	readonly kind: 'OR';
	readonly nodeId: string;
	readonly operands: readonly [FourValuedExpression, ...FourValuedExpression[]];
}

export interface FourValuedAllExpression extends FourValuedPopulationBoundary {
	readonly kind: 'ALL';
	readonly members: readonly FourValuedExpression[];
	readonly nodeId: string;
}

export interface FourValuedAnyExpression extends FourValuedPopulationBoundary {
	readonly kind: 'ANY';
	readonly members: readonly FourValuedExpression[];
	readonly nodeId: string;
}

export type FourValuedExpression =
	| FourValuedLiteralExpression
	| FourValuedNotExpression
	| FourValuedAndExpression
	| FourValuedOrExpression
	| FourValuedAllExpression
	| FourValuedAnyExpression;

export interface FourValuedQueryBudgets {
	readonly maxDepth: number;
	readonly maxEvaluations: number;
	readonly maxFanout: number;
	readonly maxNodes: number;
	readonly maxTraceNodes: number;
}

export interface EvaluateFourValuedExpressionInput {
	readonly budgets: FourValuedQueryBudgets;
	readonly expression: FourValuedExpression;
	readonly mode: FourValuedEvaluationMode;
}

export interface FourValuedNormalizedNode {
	readonly childNodeIds: readonly string[];
	readonly closure?: FourValuedPopulationClosure;
	readonly completeness?: FourValuedEvaluationCompleteness;
	readonly depth: number;
	readonly kind: FourValuedExpression['kind'];
	readonly nodeId: string;
	readonly nodePath: readonly number[];
	readonly ordinal: number;
	readonly truth?: FourValuedTruth;
}

export interface FourValuedNormalizedExpression {
	readonly maxObservedDepth: number;
	readonly maxObservedFanout: number;
	readonly nodeCount: number;
	readonly nodes: readonly FourValuedNormalizedNode[];
	readonly rootNodeId: string;
}

export type FourValuedCompositionRule =
	| 'LITERAL_EVIDENCE_PAIR'
	| 'NOT_SWAP_SUPPORT'
	| 'AND_ALL_TRUE_ANY_FALSE'
	| 'OR_ANY_TRUE_ALL_FALSE'
	| 'ALL_CLOSED_COMPLETE_OR_UNKNOWN_BOUNDARY'
	| 'ANY_CLOSED_COMPLETE_OR_UNKNOWN_BOUNDARY';

export type FourValuedShortCircuitRule = 'AND_FALSE' | 'OR_TRUE' | 'ALL_FALSE' | 'ANY_TRUE';

export interface FourValuedQuantifierTraceBoundary extends FourValuedPopulationBoundary {
	readonly appliedUnknownBoundary: boolean;
	readonly emptyPopulation: boolean;
	readonly identityTruth: 'TRUE' | 'FALSE';
	readonly unknownBoundaryRequired: boolean;
}

interface FourValuedTraceNodeBase {
	readonly algebraVersion: typeof FOUR_VALUED_QUERY_ALGEBRA_VERSION;
	readonly childNodeIds: readonly string[];
	readonly kind: FourValuedExpression['kind'];
	readonly nodeId: string;
	readonly nodePath: readonly number[];
	readonly ordinal: number;
}

export interface FourValuedEvaluatedTraceNode extends FourValuedTraceNodeBase {
	readonly decisiveChildId: string | null;
	readonly disposition: 'EVALUATED';
	readonly evaluatedChildNodeIds: readonly string[];
	readonly evidencePair: FourValuedEvidencePair;
	readonly inputTruths: readonly FourValuedTruth[];
	readonly intermediateTruths: readonly FourValuedTruth[];
	readonly quantifierBoundary: FourValuedQuantifierTraceBoundary | null;
	readonly rule: FourValuedCompositionRule;
	readonly skippedChildNodeIds: readonly string[];
	readonly truth: FourValuedTruth;
}

export interface FourValuedShortCircuitedTraceNode extends FourValuedTraceNodeBase {
	readonly disposition: 'SHORT_CIRCUITED';
	readonly skippedBy: {
		readonly ancestorNodeId: string;
		readonly decisiveChildId: string;
		readonly rule: FourValuedShortCircuitRule;
	};
}

export type FourValuedExplanationTraceNode =
	FourValuedEvaluatedTraceNode | FourValuedShortCircuitedTraceNode;

export interface FourValuedExpressionEvaluation {
	readonly algebraVersion: typeof FOUR_VALUED_QUERY_ALGEBRA_VERSION;
	readonly coverage: {
		readonly evaluatedNodes: number;
		readonly nodeTotalTrace: boolean;
		readonly shortCircuitedNodes: number;
		readonly totalNodes: number;
	};
	readonly evidencePair: FourValuedEvidencePair;
	readonly expression: FourValuedNormalizedExpression;
	readonly mode: FourValuedEvaluationMode;
	readonly trace: readonly FourValuedExplanationTraceNode[];
	readonly truth: FourValuedTruth;
}

export type FourValuedEvaluationDiagnosticCode =
	| 'INPUT_INVALID'
	| 'AST_INVALID'
	| 'AST_BUDGET_EXCEEDED'
	| 'EVALUATION_BUDGET_EXCEEDED'
	| 'INTERNAL_EVALUATION_FAILED';

export interface FourValuedEvaluationDiagnostic {
	readonly code: FourValuedEvaluationDiagnosticCode;
	readonly message: string;
	readonly phase: 'VALIDATE_INPUT' | 'VALIDATE_AST' | 'EVALUATE';
}

export type FourValuedExpressionEvaluationOutcome =
	| {
			readonly evaluation: FourValuedExpressionEvaluation;
			readonly state: 'EVALUATED';
	  }
	| {
			readonly diagnostic: FourValuedEvaluationDiagnostic;
			readonly state: 'REFUSED';
	  };

const EVIDENCE_PAIRS = Object.freeze({
	CONFLICT: Object.freeze({ falseSupport: 1, trueSupport: 1 }),
	FALSE: Object.freeze({ falseSupport: 1, trueSupport: 0 }),
	TRUE: Object.freeze({ falseSupport: 0, trueSupport: 1 }),
	UNKNOWN: Object.freeze({ falseSupport: 0, trueSupport: 0 })
} satisfies Readonly<Record<FourValuedTruth, FourValuedEvidencePair>>);

const TRUTH_SET = new Set<FourValuedTruth>(FOUR_VALUED_TRUTHS);
const MODES = new Set<FourValuedEvaluationMode>(['EAGER', 'SHORT_CIRCUIT']);
const CLOSURES = new Set<FourValuedPopulationClosure>(['CLOSED', 'OPEN']);
const COMPLETENESS = new Set<FourValuedEvaluationCompleteness>(['COMPLETE', 'INCOMPLETE']);
const MAX_IDENTIFIER_CHARACTERS = 1_024;

type DiagnosticPhase = FourValuedEvaluationDiagnostic['phase'];

class FourValuedRefusal extends Error {
	readonly code: FourValuedEvaluationDiagnosticCode;
	readonly phase: DiagnosticPhase;

	constructor(code: FourValuedEvaluationDiagnosticCode, phase: DiagnosticPhase, message: string) {
		super(message);
		this.code = code;
		this.phase = phase;
	}
}

interface InspectedObject {
	readonly values: ReadonlyMap<string, unknown>;
}

interface InternalNormalizedNode {
	childOrdinals: number[];
	closure?: FourValuedPopulationClosure;
	completeness?: FourValuedEvaluationCompleteness;
	readonly depth: number;
	readonly kind: FourValuedExpression['kind'];
	readonly nodeId: string;
	readonly nodePath: number[];
	readonly ordinal: number;
	truth?: FourValuedTruth;
}

interface InternalNormalizedAst {
	readonly expression: FourValuedNormalizedExpression;
	readonly nodes: readonly InternalNormalizedNode[];
}

interface SkipReason {
	readonly ancestorNodeId: string;
	readonly decisiveChildId: string;
	readonly rule: FourValuedShortCircuitRule;
}

function refuse(
	code: FourValuedEvaluationDiagnosticCode,
	phase: DiagnosticPhase,
	message: string
): never {
	throw new FourValuedRefusal(code, phase, message);
}

function deepFreezeConstructed<Value>(value: Value): Value {
	if (value === null || typeof value !== 'object') return value;
	const seen = new WeakSet<object>();
	const stack: object[] = [value];
	while (stack.length > 0) {
		const current = stack.pop()!;
		if (seen.has(current)) continue;
		seen.add(current);
		for (const key of Reflect.ownKeys(current)) {
			const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
			if (descriptor === undefined || !('value' in descriptor)) continue;
			const child = descriptor.value;
			if (child !== null && typeof child === 'object') stack.push(child);
		}
		Object.freeze(current);
	}
	return value;
}

function isUnicodeScalarString(text: string): boolean {
	for (let index = 0; index < text.length; index += 1) {
		const code = text.charCodeAt(index);
		if (code >= 0xd800 && code <= 0xdbff) {
			const next = text.charCodeAt(index + 1);
			if (!Number.isInteger(next) || next < 0xdc00 || next > 0xdfff) return false;
			index += 1;
		} else if (code >= 0xdc00 && code <= 0xdfff) return false;
	}
	return true;
}

function inspectPlainObject(
	value: unknown,
	code: FourValuedEvaluationDiagnosticCode,
	phase: DiagnosticPhase,
	message: string
): InspectedObject {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		refuse(code, phase, message);
	const prototype = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null) refuse(code, phase, message);
	const values = new Map<string, unknown>();
	for (const key of Reflect.ownKeys(value)) {
		if (typeof key !== 'string') refuse(code, phase, message);
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			refuse(code, phase, message);
		values.set(key, descriptor.value);
	}
	return { values };
}

function requireExactKeys(
	inspected: InspectedObject,
	expectedKeys: readonly string[],
	code: FourValuedEvaluationDiagnosticCode,
	phase: DiagnosticPhase,
	message: string
): void {
	if (inspected.values.size !== expectedKeys.length) refuse(code, phase, message);
	for (const key of expectedKeys) if (!inspected.values.has(key)) refuse(code, phase, message);
}

function inspectPlainArray(
	value: unknown,
	seenContainers: WeakSet<object>,
	maxLength: number
): readonly unknown[] {
	if (!Array.isArray(value) || isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype)
		refuse('AST_INVALID', 'VALIDATE_AST', 'Expression child collections must be plain arrays.');
	if (seenContainers.has(value))
		refuse('AST_INVALID', 'VALIDATE_AST', 'Expression containers must have unique ownership.');
	seenContainers.add(value);
	const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, 'length');
	if (lengthDescriptor === undefined || !('value' in lengthDescriptor))
		refuse('AST_INVALID', 'VALIDATE_AST', 'Expression child collections are malformed.');
	const lengthValue = lengthDescriptor.value;
	if (typeof lengthValue !== 'number' || !Number.isSafeInteger(lengthValue) || lengthValue < 0)
		refuse('AST_INVALID', 'VALIDATE_AST', 'Expression child collections are malformed.');
	const length = lengthValue;
	if (length > FOUR_VALUED_QUERY_SAFETY_CEILINGS.maxFanout || length > maxLength)
		refuse('AST_BUDGET_EXCEEDED', 'VALIDATE_AST', 'Expression fanout exceeds its budget.');
	if (Reflect.ownKeys(value).length !== length + 1)
		refuse('AST_INVALID', 'VALIDATE_AST', 'Expression child collections must be dense arrays.');
	const items: unknown[] = [];
	for (let index = 0; index < length; index += 1) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			refuse('AST_INVALID', 'VALIDATE_AST', 'Expression child collections must be dense arrays.');
		items.push(descriptor.value);
	}
	return items;
}

function requireNodeId(value: unknown): string {
	if (
		typeof value !== 'string' ||
		value.length === 0 ||
		value.length > MAX_IDENTIFIER_CHARACTERS ||
		!isUnicodeScalarString(value)
	)
		refuse('AST_INVALID', 'VALIDATE_AST', 'Every expression node needs a valid nodeId.');
	return value;
}

function requireTruth(value: unknown): FourValuedTruth {
	if (typeof value !== 'string' || !TRUTH_SET.has(value as FourValuedTruth))
		refuse('AST_INVALID', 'VALIDATE_AST', 'VALUE truth is not a four-valued truth.');
	return value as FourValuedTruth;
}

function requireClosure(value: unknown): FourValuedPopulationClosure {
	if (typeof value !== 'string' || !CLOSURES.has(value as FourValuedPopulationClosure))
		refuse('AST_INVALID', 'VALIDATE_AST', 'Quantifier population closure is invalid.');
	return value as FourValuedPopulationClosure;
}

function requireCompleteness(value: unknown): FourValuedEvaluationCompleteness {
	if (typeof value !== 'string' || !COMPLETENESS.has(value as FourValuedEvaluationCompleteness))
		refuse('AST_INVALID', 'VALIDATE_AST', 'Quantifier evaluation completeness is invalid.');
	return value as FourValuedEvaluationCompleteness;
}

function validateBudgets(value: unknown): FourValuedQueryBudgets {
	const inspected = inspectPlainObject(
		value,
		'INPUT_INVALID',
		'VALIDATE_INPUT',
		'Budgets must be a closed plain-data object.'
	);
	const keys = ['maxDepth', 'maxEvaluations', 'maxFanout', 'maxNodes', 'maxTraceNodes'] as const;
	requireExactKeys(
		inspected,
		keys,
		'INPUT_INVALID',
		'VALIDATE_INPUT',
		'Budgets must contain exactly the registered fields.'
	);
	const result = {} as Record<(typeof keys)[number], number>;
	for (const key of keys) {
		const candidate = inspected.values.get(key);
		if (
			typeof candidate !== 'number' ||
			!Number.isSafeInteger(candidate) ||
			candidate < 1 ||
			candidate > FOUR_VALUED_QUERY_SAFETY_CEILINGS[key]
		)
			refuse(
				'INPUT_INVALID',
				'VALIDATE_INPUT',
				'Budgets must be positive safe integers within fixed safety ceilings.'
			);
		result[key] = candidate;
	}
	return result;
}

function normalizeExpression(
	root: unknown,
	budgets: FourValuedQueryBudgets
): InternalNormalizedAst {
	const nodes: InternalNormalizedNode[] = [];
	const nodeIds = new Set<string>();
	const seenContainers = new WeakSet<object>();
	let maxObservedDepth = 0;
	let maxObservedFanout = 0;

	function visit(candidate: unknown, depth: number, nodePath: number[]): number {
		if (depth > FOUR_VALUED_QUERY_SAFETY_CEILINGS.maxDepth || depth > budgets.maxDepth)
			refuse('AST_BUDGET_EXCEEDED', 'VALIDATE_AST', 'Expression depth exceeds its budget.');
		const inspected = inspectPlainObject(
			candidate,
			'AST_INVALID',
			'VALIDATE_AST',
			'Every expression node must be a closed plain-data object.'
		);
		if (seenContainers.has(candidate as object))
			refuse('AST_INVALID', 'VALIDATE_AST', 'Expression nodes must have unique tree ownership.');
		seenContainers.add(candidate as object);
		const kindValue = inspected.values.get('kind');
		if (
			kindValue !== 'VALUE' &&
			kindValue !== 'NOT' &&
			kindValue !== 'AND' &&
			kindValue !== 'OR' &&
			kindValue !== 'ALL' &&
			kindValue !== 'ANY'
		)
			refuse('AST_INVALID', 'VALIDATE_AST', 'Expression kind is not registered.');
		const kind = kindValue;
		const nodeId = requireNodeId(inspected.values.get('nodeId'));
		if (nodeIds.has(nodeId))
			refuse('AST_INVALID', 'VALIDATE_AST', 'Expression nodeIds must be unique.');
		nodeIds.add(nodeId);
		if (
			nodes.length >= FOUR_VALUED_QUERY_SAFETY_CEILINGS.maxNodes ||
			nodes.length >= budgets.maxNodes
		)
			refuse('AST_BUDGET_EXCEEDED', 'VALIDATE_AST', 'Expression node count exceeds its budget.');
		const ordinal = nodes.length;
		const internal: InternalNormalizedNode = {
			childOrdinals: [],
			depth,
			kind,
			nodeId,
			nodePath: [...nodePath],
			ordinal
		};
		nodes.push(internal);
		maxObservedDepth = Math.max(maxObservedDepth, depth);

		let children: readonly unknown[] = [];
		if (kind === 'VALUE') {
			requireExactKeys(
				inspected,
				['kind', 'nodeId', 'truth'],
				'AST_INVALID',
				'VALIDATE_AST',
				'VALUE nodes must contain exactly kind, nodeId, and truth.'
			);
			internal.truth = requireTruth(inspected.values.get('truth'));
		} else if (kind === 'NOT') {
			requireExactKeys(
				inspected,
				['kind', 'nodeId', 'operand'],
				'AST_INVALID',
				'VALIDATE_AST',
				'NOT nodes must contain exactly kind, nodeId, and operand.'
			);
			children = [inspected.values.get('operand')];
		} else if (kind === 'AND' || kind === 'OR') {
			requireExactKeys(
				inspected,
				['kind', 'nodeId', 'operands'],
				'AST_INVALID',
				'VALIDATE_AST',
				'Logical nodes must contain exactly kind, nodeId, and operands.'
			);
			children = inspectPlainArray(
				inspected.values.get('operands'),
				seenContainers,
				budgets.maxFanout
			);
			if (children.length === 0)
				refuse('AST_INVALID', 'VALIDATE_AST', 'AND and OR require at least one operand.');
		} else {
			requireExactKeys(
				inspected,
				['closure', 'completeness', 'kind', 'members', 'nodeId'],
				'AST_INVALID',
				'VALIDATE_AST',
				'Quantifier nodes must contain exactly their registered fields.'
			);
			internal.closure = requireClosure(inspected.values.get('closure'));
			internal.completeness = requireCompleteness(inspected.values.get('completeness'));
			children = inspectPlainArray(
				inspected.values.get('members'),
				seenContainers,
				budgets.maxFanout
			);
		}
		maxObservedFanout = Math.max(maxObservedFanout, children.length);
		for (const [childIndex, child] of children.entries())
			internal.childOrdinals.push(visit(child, depth + 1, [...nodePath, childIndex]));
		return ordinal;
	}

	const rootOrdinal = visit(root, 1, []);
	if (nodes.length > budgets.maxEvaluations || nodes.length > budgets.maxTraceNodes)
		refuse(
			'EVALUATION_BUDGET_EXCEEDED',
			'VALIDATE_AST',
			'The complete expression exceeds its evaluation or node-total trace budget.'
		);
	const normalizedNodes: FourValuedNormalizedNode[] = nodes.map((node) => ({
		childNodeIds: node.childOrdinals.map((childOrdinal) => nodes[childOrdinal]!.nodeId),
		...(node.closure === undefined ? {} : { closure: node.closure }),
		...(node.completeness === undefined ? {} : { completeness: node.completeness }),
		depth: node.depth,
		kind: node.kind,
		nodeId: node.nodeId,
		nodePath: [...node.nodePath],
		ordinal: node.ordinal,
		...(node.truth === undefined ? {} : { truth: node.truth })
	}));
	return {
		expression: {
			maxObservedDepth,
			maxObservedFanout,
			nodeCount: nodes.length,
			nodes: normalizedNodes,
			rootNodeId: nodes[rootOrdinal]!.nodeId
		},
		nodes
	};
}

function assertTruthVector(
	values: readonly FourValuedTruth[],
	allowEmpty: boolean
): asserts values is readonly FourValuedTruth[] {
	if (
		!Array.isArray(values) ||
		isProxy(values) ||
		(!allowEmpty && values.length === 0) ||
		values.length > FOUR_VALUED_QUERY_SAFETY_CEILINGS.maxFanout ||
		values.some((value) => !TRUTH_SET.has(value))
	)
		throw new TypeError('Expected a bounded vector of four-valued truths.');
}

export function evidencePairForFourValuedTruth(truth: FourValuedTruth): FourValuedEvidencePair {
	if (!TRUTH_SET.has(truth)) throw new TypeError('Expected a four-valued truth.');
	return EVIDENCE_PAIRS[truth];
}

export function fourValuedTruthForEvidencePair(pair: FourValuedEvidencePair): FourValuedTruth {
	if (
		pair === null ||
		typeof pair !== 'object' ||
		isProxy(pair) ||
		(pair.trueSupport !== 0 && pair.trueSupport !== 1) ||
		(pair.falseSupport !== 0 && pair.falseSupport !== 1)
	)
		throw new TypeError('Expected a four-valued evidence pair.');
	if (pair.trueSupport === 1) return pair.falseSupport === 1 ? 'CONFLICT' : 'TRUE';
	return pair.falseSupport === 1 ? 'FALSE' : 'UNKNOWN';
}

export function fourValuedNot(truth: FourValuedTruth): FourValuedTruth {
	const pair = evidencePairForFourValuedTruth(truth);
	return fourValuedTruthForEvidencePair({
		falseSupport: pair.trueSupport,
		trueSupport: pair.falseSupport
	});
}

export function fourValuedAnd(
	truths: readonly [FourValuedTruth, ...FourValuedTruth[]]
): FourValuedTruth {
	assertTruthVector(truths, false);
	return fourValuedTruthForEvidencePair({
		falseSupport: truths.some((truth) => evidencePairForFourValuedTruth(truth).falseSupport === 1)
			? 1
			: 0,
		trueSupport: truths.every((truth) => evidencePairForFourValuedTruth(truth).trueSupport === 1)
			? 1
			: 0
	});
}

export function fourValuedOr(
	truths: readonly [FourValuedTruth, ...FourValuedTruth[]]
): FourValuedTruth {
	assertTruthVector(truths, false);
	return fourValuedTruthForEvidencePair({
		falseSupport: truths.every((truth) => evidencePairForFourValuedTruth(truth).falseSupport === 1)
			? 1
			: 0,
		trueSupport: truths.some((truth) => evidencePairForFourValuedTruth(truth).trueSupport === 1)
			? 1
			: 0
	});
}

function requirePopulationBoundary(
	boundary: FourValuedPopulationBoundary
): FourValuedPopulationBoundary {
	if (
		boundary === null ||
		typeof boundary !== 'object' ||
		isProxy(boundary) ||
		!CLOSURES.has(boundary.closure) ||
		!COMPLETENESS.has(boundary.completeness)
	)
		throw new TypeError('Expected an explicit population boundary.');
	return boundary;
}

function closedAndComplete(boundary: FourValuedPopulationBoundary): boolean {
	return boundary.closure === 'CLOSED' && boundary.completeness === 'COMPLETE';
}

export function fourValuedAll(
	truths: readonly FourValuedTruth[],
	boundary: FourValuedPopulationBoundary
): FourValuedTruth {
	assertTruthVector(truths, true);
	requirePopulationBoundary(boundary);
	const memberTruth =
		truths.length === 0
			? 'TRUE'
			: fourValuedAnd(truths as readonly [FourValuedTruth, ...FourValuedTruth[]]);
	return closedAndComplete(boundary) ? memberTruth : fourValuedAnd([memberTruth, 'UNKNOWN']);
}

export function fourValuedAny(
	truths: readonly FourValuedTruth[],
	boundary: FourValuedPopulationBoundary
): FourValuedTruth {
	assertTruthVector(truths, true);
	requirePopulationBoundary(boundary);
	const memberTruth =
		truths.length === 0
			? 'FALSE'
			: fourValuedOr(truths as readonly [FourValuedTruth, ...FourValuedTruth[]]);
	return closedAndComplete(boundary) ? memberTruth : fourValuedOr([memberTruth, 'UNKNOWN']);
}

function ruleForNode(node: InternalNormalizedNode): FourValuedCompositionRule {
	switch (node.kind) {
		case 'VALUE':
			return 'LITERAL_EVIDENCE_PAIR';
		case 'NOT':
			return 'NOT_SWAP_SUPPORT';
		case 'AND':
			return 'AND_ALL_TRUE_ANY_FALSE';
		case 'OR':
			return 'OR_ANY_TRUE_ALL_FALSE';
		case 'ALL':
			return 'ALL_CLOSED_COMPLETE_OR_UNKNOWN_BOUNDARY';
		case 'ANY':
			return 'ANY_CLOSED_COMPLETE_OR_UNKNOWN_BOUNDARY';
	}
}

function shortCircuitRuleForNode(node: InternalNormalizedNode): FourValuedShortCircuitRule {
	switch (node.kind) {
		case 'AND':
			return 'AND_FALSE';
		case 'OR':
			return 'OR_TRUE';
		case 'ALL':
			return 'ALL_FALSE';
		case 'ANY':
			return 'ANY_TRUE';
		default:
			throw new Error('Only folding nodes can short-circuit.');
	}
}

function decisiveTruthForNode(node: InternalNormalizedNode): FourValuedTruth | null {
	if (node.kind === 'AND' || node.kind === 'ALL') return 'FALSE';
	if (node.kind === 'OR' || node.kind === 'ANY') return 'TRUE';
	return null;
}

function combineForNode(
	node: InternalNormalizedNode,
	left: FourValuedTruth,
	right: FourValuedTruth
): FourValuedTruth {
	return node.kind === 'AND' || node.kind === 'ALL'
		? fourValuedAnd([left, right])
		: fourValuedOr([left, right]);
}

function evaluateNormalizedExpression(
	ast: InternalNormalizedAst,
	mode: FourValuedEvaluationMode
): FourValuedExpressionEvaluation {
	const traces = new Map<number, FourValuedExplanationTraceNode>();
	let evaluatedNodes = 0;
	let shortCircuitedNodes = 0;

	function markShortCircuited(ordinal: number, skippedBy: SkipReason): void {
		const node = ast.nodes[ordinal]!;
		if (traces.has(ordinal)) throw new Error('A node cannot be evaluated and skipped.');
		traces.set(ordinal, {
			algebraVersion: FOUR_VALUED_QUERY_ALGEBRA_VERSION,
			childNodeIds: node.childOrdinals.map((childOrdinal) => ast.nodes[childOrdinal]!.nodeId),
			disposition: 'SHORT_CIRCUITED',
			kind: node.kind,
			nodeId: node.nodeId,
			nodePath: [...node.nodePath],
			ordinal,
			skippedBy: { ...skippedBy }
		});
		shortCircuitedNodes += 1;
		for (const childOrdinal of node.childOrdinals) markShortCircuited(childOrdinal, skippedBy);
	}

	function evaluate(ordinal: number): FourValuedTruth {
		const node = ast.nodes[ordinal]!;
		evaluatedNodes += 1;
		const childNodeIds = node.childOrdinals.map((childOrdinal) => ast.nodes[childOrdinal]!.nodeId);
		const evaluatedChildNodeIds: string[] = [];
		const skippedChildNodeIds: string[] = [];
		const inputTruths: FourValuedTruth[] = [];
		const intermediateTruths: FourValuedTruth[] = [];
		let decisiveChildId: string | null = null;
		let quantifierBoundary: FourValuedQuantifierTraceBoundary | null = null;
		let truth: FourValuedTruth;

		if (node.kind === 'VALUE') {
			truth = node.truth!;
			intermediateTruths.push(truth);
		} else if (node.kind === 'NOT') {
			const child = ast.nodes[node.childOrdinals[0]!]!;
			const input = evaluate(child.ordinal);
			evaluatedChildNodeIds.push(child.nodeId);
			inputTruths.push(input);
			truth = fourValuedNot(input);
			intermediateTruths.push(truth);
		} else {
			const isAll = node.kind === 'ALL';
			const isAny = node.kind === 'ANY';
			const identityTruth: 'TRUE' | 'FALSE' = node.kind === 'AND' || isAll ? 'TRUE' : 'FALSE';
			const decisiveTruth = decisiveTruthForNode(node)!;
			let foldedTruth: FourValuedTruth | undefined;
			for (const [childIndex, childOrdinal] of node.childOrdinals.entries()) {
				const child = ast.nodes[childOrdinal]!;
				const childTruth = evaluate(childOrdinal);
				evaluatedChildNodeIds.push(child.nodeId);
				inputTruths.push(childTruth);
				foldedTruth =
					foldedTruth === undefined ? childTruth : combineForNode(node, foldedTruth, childTruth);
				intermediateTruths.push(foldedTruth);
				const remainingOrdinals = node.childOrdinals.slice(childIndex + 1);
				if (
					mode === 'SHORT_CIRCUIT' &&
					foldedTruth === decisiveTruth &&
					remainingOrdinals.length > 0
				) {
					decisiveChildId = child.nodeId;
					const skipReason: SkipReason = {
						ancestorNodeId: node.nodeId,
						decisiveChildId: child.nodeId,
						rule: shortCircuitRuleForNode(node)
					};
					for (const remainingOrdinal of remainingOrdinals) {
						skippedChildNodeIds.push(ast.nodes[remainingOrdinal]!.nodeId);
						markShortCircuited(remainingOrdinal, skipReason);
					}
					break;
				}
			}
			truth = foldedTruth ?? identityTruth;
			if (isAll || isAny) {
				const unknownBoundaryRequired = !closedAndComplete({
					closure: node.closure!,
					completeness: node.completeness!
				});
				const appliedUnknownBoundary = unknownBoundaryRequired && decisiveChildId === null;
				if (appliedUnknownBoundary) {
					truth = combineForNode(node, truth, 'UNKNOWN');
					intermediateTruths.push(truth);
				} else if (node.childOrdinals.length === 0) intermediateTruths.push(truth);
				quantifierBoundary = {
					appliedUnknownBoundary,
					closure: node.closure!,
					completeness: node.completeness!,
					emptyPopulation: node.childOrdinals.length === 0,
					identityTruth,
					unknownBoundaryRequired
				};
			}
		}

		traces.set(ordinal, {
			algebraVersion: FOUR_VALUED_QUERY_ALGEBRA_VERSION,
			childNodeIds,
			decisiveChildId,
			disposition: 'EVALUATED',
			evaluatedChildNodeIds,
			evidencePair: evidencePairForFourValuedTruth(truth),
			inputTruths,
			intermediateTruths,
			kind: node.kind,
			nodeId: node.nodeId,
			nodePath: [...node.nodePath],
			ordinal,
			quantifierBoundary,
			rule: ruleForNode(node),
			skippedChildNodeIds,
			truth
		});
		return truth;
	}

	const truth = evaluate(0);
	const trace = ast.nodes.map((node) => {
		const traceNode = traces.get(node.ordinal);
		if (traceNode === undefined) throw new Error('The explanation trace is not node-total.');
		return traceNode;
	});
	return {
		algebraVersion: FOUR_VALUED_QUERY_ALGEBRA_VERSION,
		coverage: {
			evaluatedNodes,
			nodeTotalTrace: trace.length === ast.nodes.length,
			shortCircuitedNodes,
			totalNodes: ast.nodes.length
		},
		evidencePair: evidencePairForFourValuedTruth(truth),
		expression: ast.expression,
		mode,
		trace,
		truth
	};
}

export function evaluateFourValuedExpression(
	input: unknown
): FourValuedExpressionEvaluationOutcome {
	try {
		const inspected = inspectPlainObject(
			input,
			'INPUT_INVALID',
			'VALIDATE_INPUT',
			'Evaluation input must be a closed plain-data object.'
		);
		requireExactKeys(
			inspected,
			['budgets', 'expression', 'mode'],
			'INPUT_INVALID',
			'VALIDATE_INPUT',
			'Evaluation input must contain exactly budgets, expression, and mode.'
		);
		const modeValue = inspected.values.get('mode');
		if (typeof modeValue !== 'string' || !MODES.has(modeValue as FourValuedEvaluationMode))
			refuse('INPUT_INVALID', 'VALIDATE_INPUT', 'Evaluation mode is invalid.');
		const mode = modeValue as FourValuedEvaluationMode;
		const budgets = validateBudgets(inspected.values.get('budgets'));
		const ast = normalizeExpression(inspected.values.get('expression'), budgets);
		return deepFreezeConstructed({
			evaluation: evaluateNormalizedExpression(ast, mode),
			state: 'EVALUATED' as const
		});
	} catch (error) {
		const diagnostic: FourValuedEvaluationDiagnostic =
			error instanceof FourValuedRefusal
				? { code: error.code, message: error.message, phase: error.phase }
				: {
						code: 'INTERNAL_EVALUATION_FAILED',
						message: 'Four-valued evaluation failed without exposing internal exception text.',
						phase: 'EVALUATE'
					};
		return deepFreezeConstructed({ diagnostic, state: 'REFUSED' as const });
	}
}
