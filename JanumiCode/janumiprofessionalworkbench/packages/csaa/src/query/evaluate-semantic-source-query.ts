import {
	SEMANTIC_SOURCE_QUERY_ALGEBRA_VERSION,
	SEMANTIC_SOURCE_QUERY_CAPABILITY_STATUS,
	SEMANTIC_SOURCE_QUERY_EXECUTION_MODE,
	SEMANTIC_SOURCE_QUERY_FIELDS,
	SEMANTIC_SOURCE_QUERY_NONCLAIMS,
	SEMANTIC_SOURCE_QUERY_OPERATION_VERSION,
	SEMANTIC_SOURCE_QUERY_POPULATION,
	SEMANTIC_SOURCE_QUERY_SAFETY_CEILINGS,
	type EvaluateSemanticSourceQueryInput,
	type SemanticQueryApplicableProjection,
	type SemanticQueryApplicability,
	type SemanticQueryEvidencePair,
	type SemanticQueryProjection,
	type SemanticQueryTruth,
	type SemanticSourceQueryApplicableLeafEvaluation,
	type SemanticSourceQueryBudgets,
	type SemanticSourceQueryChildContribution,
	type SemanticSourceQueryDiagnostic,
	type SemanticSourceQueryDiagnosticCode,
	type SemanticSourceQueryEpistemicTrace,
	type SemanticSourceQueryEvaluation,
	type SemanticSourceQueryEvaluationCounts,
	type SemanticSourceQueryEvaluationOutcome,
	type SemanticSourceQueryField,
	type SemanticSourceQueryLeafEvaluation,
	type SemanticSourceQueryLeafEvaluator,
	type SemanticSourceQueryNormalizedEqualityNode,
	type SemanticSourceQueryNormalizedExpression,
	type SemanticSourceQueryNormalizedLogicalPathStartsWithNode,
	type SemanticSourceQueryNormalizedNode,
	type SemanticSourceQueryRecord,
	type SemanticSourceQueryRecordResult,
	type SemanticSourceQueryTraceNode
} from '../contracts/semantic-source-query.js';
import type {
	SemanticCapabilityCoverage,
	SemanticConflict,
	SemanticEpistemicState,
	SemanticExecutionHealth,
	SemanticFreshness,
	SemanticInference,
	SemanticSupportBasis
} from '../contracts/semantic.js';
import { isProxyValue, isUnicodeScalarString } from '../semantic/canonical.js';

const MAX_IDENTIFIER_CHARACTERS = 1_024;
const MAX_SCALAR_CHARACTERS = 32_768;
const MAX_EVIDENCE_REFS = 64;
const MAX_UNRESOLVED_REGIONS = 64;

const ANALYSIS_DISPOSITIONS = new Set(['DEEP_INDEXED', 'CONTEXT_ONLY']);
const ARTIFACT_CLASSES = new Set([
	'MANIFEST',
	'LOCKFILE',
	'TOOL_CONFIGURATION',
	'PROJECT_CONFIGURATION',
	'GENERATED_CONFIGURATION',
	'PRODUCTION_SOURCE',
	'TEST_SOURCE',
	'GENERATOR_SOURCE',
	'GENERATED_SOURCE',
	'SCRIPT',
	'VERIFICATION',
	'BUILD_OUTPUT',
	'CACHE',
	'EXTERNAL_DEPENDENCY',
	'VENDOR',
	'OTHER',
	'CONTEXT_ONLY'
]);
const MODULE_KINDS = new Set(['MODULE', 'SCRIPT']);
const SOURCE_ORIGINS = new Set([
	'AUTHORED',
	'TEST',
	'VERIFICATION',
	'SCRIPT',
	'GENERATOR',
	'GENERATED',
	'GENERATED_DECLARATION',
	'WORKSPACE_BUILD_DECLARATION',
	'EXTERNAL_DECLARATION',
	'TOOLCHAIN_LIBRARY',
	'CONFIGURATION',
	'UNKNOWN'
]);
const CAPABILITY_COVERAGE = new Set<SemanticCapabilityCoverage>([
	'supported',
	'partial',
	'unsupported',
	'excluded',
	'not-analyzed'
]);
const EXECUTION_HEALTH = new Set<SemanticExecutionHealth>([
	'succeeded',
	'failed',
	'timed-out',
	'cancelled',
	'resource-exhausted',
	'malformed-output',
	'unavailable',
	'not-run'
]);
const FRESHNESS = new Set<SemanticFreshness>([
	'current-for-subject',
	'stale',
	'invalidated',
	'unknown'
]);
const CONFLICT = new Set<SemanticConflict>([
	'unopposed',
	'corroborated',
	'conflicting',
	'corrected',
	'superseded'
]);
const INFERENCE = new Set<SemanticInference>([
	'direct',
	'derived',
	'candidate',
	'bounded-inference',
	'unknown',
	'not-applicable'
]);
const SUPPORT_BASIS_KINDS = new Set<SemanticSupportBasis['kind']>([
	'direct-extraction',
	'compiler-confirmed',
	'derived',
	'unknown',
	'not-applicable'
]);

type Phase = SemanticSourceQueryDiagnostic['phase'];

class QueryRefusal extends Error {
	readonly code: SemanticSourceQueryDiagnosticCode;
	readonly phase: Phase;

	constructor(code: SemanticSourceQueryDiagnosticCode, phase: Phase, message: string) {
		super(message);
		this.code = code;
		this.phase = phase;
	}
}

interface InspectedRecord {
	readonly values: ReadonlyMap<string, unknown>;
}

interface InternalNormalizedNode {
	readonly childOrdinals: number[];
	readonly depth: number;
	readonly field?: SemanticSourceQueryField;
	readonly kind: SemanticSourceQueryNormalizedNode['kind'];
	readonly nodeId: string;
	readonly ordinal: number;
	readonly value?: boolean | string;
}

interface NormalizedAst {
	readonly expression: SemanticSourceQueryNormalizedExpression;
	readonly nodes: readonly InternalNormalizedNode[];
}

interface InternalApplicableResult {
	readonly disposition: 'applicable-result';
	readonly epistemic: SemanticSourceQueryEpistemicTrace;
	readonly evidencePair: SemanticQueryEvidencePair;
	readonly evidenceRefs: readonly string[];
	readonly trace: SemanticSourceQueryTraceNode;
	readonly truth: SemanticQueryTruth;
}

interface InternalNotApplicableResult {
	readonly applicability: SemanticQueryApplicability;
	readonly disposition: 'not-applicable';
	readonly trace: SemanticSourceQueryTraceNode;
}

type InternalNodeResult = InternalApplicableResult | InternalNotApplicableResult;

function refuse(code: SemanticSourceQueryDiagnosticCode, phase: Phase, message: string): never {
	throw new QueryRefusal(code, phase, message);
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
			if (descriptor !== undefined && 'value' in descriptor) {
				const child = descriptor.value;
				if (child !== null && typeof child === 'object') stack.push(child);
			}
		}
		Object.freeze(current);
	}
	return value;
}

function inspectPlainDataRecord(
	value: unknown,
	code: SemanticSourceQueryDiagnosticCode,
	phase: Phase,
	message: string
): InspectedRecord {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxyValue(value))
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

function assertExactKeys(
	record: InspectedRecord,
	required: readonly string[],
	optional: readonly string[],
	code: SemanticSourceQueryDiagnosticCode,
	phase: Phase,
	message: string
): void {
	const admitted = new Set([...required, ...optional]);
	if (
		required.some((key) => !record.values.has(key)) ||
		[...record.values.keys()].some((key) => !admitted.has(key))
	)
		refuse(code, phase, message);
}

function inspectDenseArray(
	value: unknown,
	maximum: number,
	code: SemanticSourceQueryDiagnosticCode,
	phase: Phase,
	message: string
): readonly unknown[] {
	if (
		!Array.isArray(value) ||
		isProxyValue(value) ||
		Object.getPrototypeOf(value) !== Array.prototype
	)
		refuse(code, phase, message);
	const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, 'length');
	const lengthValue =
		lengthDescriptor !== undefined && 'value' in lengthDescriptor
			? lengthDescriptor.value
			: undefined;
	if (
		!Number.isSafeInteger(lengthValue) ||
		(lengthValue as number) < 0 ||
		(lengthValue as number) > maximum
	)
		refuse(code, phase, message);
	const length = lengthValue as number;
	const keys = Reflect.ownKeys(value);
	if (keys.length !== length + 1 || !keys.includes('length')) refuse(code, phase, message);
	const result: unknown[] = [];
	for (let index = 0; index < length; index += 1) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			refuse(code, phase, message);
		result.push(descriptor.value);
	}
	if (
		keys.some(
			(key) =>
				key !== 'length' &&
				(typeof key !== 'string' ||
					!Number.isSafeInteger(Number(key)) ||
					Number(key) < 0 ||
					Number(key) >= length ||
					String(Number(key)) !== key)
		)
	)
		refuse(code, phase, message);
	return result;
}

function boundedString(value: unknown, maximum = MAX_SCALAR_CHARACTERS): value is string {
	return typeof value === 'string' && value.length <= maximum && isUnicodeScalarString(value);
}

function stableIdentifier(value: unknown): value is string {
	if (!boundedString(value, MAX_IDENTIFIER_CHARACTERS) || value.length === 0) return false;
	for (let index = 0; index < value.length; index += 1) {
		const code = value.charCodeAt(index);
		if (code <= 0x1f || code === 0x7f) return false;
	}
	return true;
}

function fieldValueIsValid(field: SemanticSourceQueryField, value: unknown): boolean {
	switch (field) {
		case 'analysisDisposition':
			return ANALYSIS_DISPOSITIONS.has(value as string);
		case 'artifactClass':
			return ARTIFACT_CLASSES.has(value as string);
		case 'declarationFile':
		case 'rootFile':
			return typeof value === 'boolean';
		case 'id':
		case 'programId':
		case 'projectId':
		case 'provenanceId':
			return stableIdentifier(value);
		case 'languageVariant':
		case 'logicalPath':
		case 'scriptKindName':
			return boundedString(value);
		case 'moduleKind':
			return MODULE_KINDS.has(value as string);
		case 'origin':
			return SOURCE_ORIGINS.has(value as string);
	}
}

function normalizeBudgets(value: unknown): SemanticSourceQueryBudgets {
	const inspected = inspectPlainDataRecord(
		value,
		'INPUT_INVALID',
		'REQUEST',
		'Query budgets must be an exact plain-data record.'
	);
	const keys = Object.keys(SEMANTIC_SOURCE_QUERY_SAFETY_CEILINGS) as Array<
		keyof SemanticSourceQueryBudgets
	>;
	assertExactKeys(
		inspected,
		keys,
		[],
		'INPUT_INVALID',
		'REQUEST',
		'Query budgets must declare every admitted budget and no others.'
	);
	const result = {} as Record<keyof SemanticSourceQueryBudgets, number>;
	for (const key of keys) {
		const candidate = inspected.values.get(key);
		if (
			!Number.isSafeInteger(candidate) ||
			(candidate as number) < 1 ||
			(candidate as number) > SEMANTIC_SOURCE_QUERY_SAFETY_CEILINGS[key]
		)
			refuse(
				'INPUT_INVALID',
				'REQUEST',
				`Query budget ${key} must be a positive safe integer at or below its absolute safety ceiling.`
			);
		result[key] = candidate as number;
	}
	return result;
}

function normalizeExpression(root: unknown, budgets: SemanticSourceQueryBudgets): NormalizedAst {
	const nodes: InternalNormalizedNode[] = [];
	const seenObjects = new WeakSet<object>();
	const nodeIds = new Set<string>();
	let maxObservedDepth = 0;
	let maxObservedFanout = 0;
	const work: Array<{
		readonly candidate: unknown;
		readonly depth: number;
		readonly parent: number | null;
	}> = [{ candidate: root, depth: 1, parent: null }];

	while (work.length > 0) {
		const next = work.pop()!;
		if (next.depth > budgets.maxDepth)
			refuse('AST_BUDGET_EXCEEDED', 'VALIDATE_AST', 'The complete expression exceeds maxDepth.');
		if (nodes.length >= budgets.maxNodes)
			refuse('AST_BUDGET_EXCEEDED', 'VALIDATE_AST', 'The complete expression exceeds maxNodes.');
		if (next.candidate === null || typeof next.candidate !== 'object')
			refuse('AST_INVALID', 'VALIDATE_AST', 'Every expression node must be plain data.');
		if (seenObjects.has(next.candidate))
			refuse(
				'AST_INVALID',
				'VALIDATE_AST',
				'The expression must be a tree without cycles or shared node objects.'
			);
		seenObjects.add(next.candidate);
		const inspected = inspectPlainDataRecord(
			next.candidate,
			'AST_INVALID',
			'VALIDATE_AST',
			'Every expression node must contain exact own data properties.'
		);
		const kind = inspected.values.get('kind');
		const nodeId = inspected.values.get('nodeId');
		if (!stableIdentifier(nodeId))
			refuse('AST_INVALID', 'VALIDATE_AST', 'Every expression node requires a stable nodeId.');
		if (nodeIds.has(nodeId))
			refuse('AST_INVALID', 'VALIDATE_AST', 'Expression nodeId values must be unique.');
		nodeIds.add(nodeId);

		let children: readonly unknown[];
		let field: SemanticSourceQueryField | undefined;
		let scalar: boolean | string | undefined;
		switch (kind) {
			case 'EQUALS': {
				assertExactKeys(
					inspected,
					['field', 'kind', 'nodeId', 'value'],
					[],
					'AST_INVALID',
					'VALIDATE_AST',
					'An EQUALS node must contain exactly field, kind, nodeId, and value.'
				);
				const fieldCandidate = inspected.values.get('field');
				if (!SEMANTIC_SOURCE_QUERY_FIELDS.includes(fieldCandidate as SemanticSourceQueryField))
					refuse(
						'AST_INVALID',
						'VALIDATE_AST',
						'An EQUALS node field must be in the registered semantic-source field set.'
					);
				field = fieldCandidate as SemanticSourceQueryField;
				const value = inspected.values.get('value');
				if (!fieldValueIsValid(field, value))
					refuse(
						'AST_INVALID',
						'VALIDATE_AST',
						'An EQUALS node value must match its registered field type.'
					);
				scalar = value as boolean | string;
				children = [];
				break;
			}
			case 'LOGICAL_PATH_STARTS_WITH': {
				assertExactKeys(
					inspected,
					['field', 'kind', 'nodeId', 'value'],
					[],
					'AST_INVALID',
					'VALIDATE_AST',
					'A LOGICAL_PATH_STARTS_WITH node must contain exactly field, kind, nodeId, and value.'
				);
				if (inspected.values.get('field') !== 'logicalPath')
					refuse(
						'AST_INVALID',
						'VALIDATE_AST',
						'A LOGICAL_PATH_STARTS_WITH node is restricted to the logicalPath field.'
					);
				field = 'logicalPath';
				const value = inspected.values.get('value');
				if (!boundedString(value) || value.length === 0)
					refuse(
						'AST_INVALID',
						'VALIDATE_AST',
						'A LOGICAL_PATH_STARTS_WITH value must be a nonempty bounded Unicode-scalar string.'
					);
				scalar = value;
				children = [];
				break;
			}
			case 'NOT':
				assertExactKeys(
					inspected,
					['kind', 'nodeId', 'operand'],
					[],
					'AST_INVALID',
					'VALIDATE_AST',
					'A NOT node must contain exactly kind, nodeId, and operand.'
				);
				children = [inspected.values.get('operand')];
				break;
			case 'AND':
			case 'OR':
				assertExactKeys(
					inspected,
					['kind', 'nodeId', 'operands'],
					[],
					'AST_INVALID',
					'VALIDATE_AST',
					`An ${kind} node must contain exactly kind, nodeId, and operands.`
				);
				children = inspectDenseArray(
					inspected.values.get('operands'),
					budgets.maxFanout,
					'AST_BUDGET_EXCEEDED',
					'VALIDATE_AST',
					`An ${kind} node must contain a dense operand array within maxFanout.`
				);
				if (children.length === 0)
					refuse(
						'AST_INVALID',
						'VALIDATE_AST',
						'AND and OR nodes require at least one ordered child.'
					);
				break;
			default:
				refuse(
					'AST_INVALID',
					'VALIDATE_AST',
					'Expression kind must be EQUALS, LOGICAL_PATH_STARTS_WITH, NOT, AND, or OR.'
				);
		}

		const ordinal = nodes.length;
		const normalized: InternalNormalizedNode = {
			childOrdinals: [],
			depth: next.depth,
			...(field === undefined ? {} : { field }),
			kind,
			nodeId,
			ordinal,
			...(scalar === undefined ? {} : { value: scalar })
		};
		nodes.push(normalized);
		if (next.parent !== null) nodes[next.parent]!.childOrdinals.push(ordinal);
		maxObservedDepth = Math.max(maxObservedDepth, next.depth);
		maxObservedFanout = Math.max(maxObservedFanout, children.length);
		for (let index = children.length - 1; index >= 0; index -= 1)
			work.push({ candidate: children[index], depth: next.depth + 1, parent: ordinal });
	}

	const publicNodes: SemanticSourceQueryNormalizedNode[] = nodes.map((node) => {
		const base = {
			childNodeIds: node.childOrdinals.map((ordinal) => nodes[ordinal]!.nodeId),
			depth: node.depth,
			kind: node.kind,
			nodeId: node.nodeId,
			ordinal: node.ordinal
		};
		if (node.kind === 'EQUALS')
			return {
				...base,
				childNodeIds: [] as const,
				field: node.field!,
				kind: 'EQUALS' as const,
				value: node.value!
			} as SemanticSourceQueryNormalizedEqualityNode;
		if (node.kind === 'LOGICAL_PATH_STARTS_WITH')
			return {
				...base,
				childNodeIds: [] as const,
				field: 'logicalPath' as const,
				kind: 'LOGICAL_PATH_STARTS_WITH' as const,
				value: node.value!
			} as SemanticSourceQueryNormalizedLogicalPathStartsWithNode;
		if (node.kind === 'NOT')
			return { ...base, childNodeIds: base.childNodeIds as [string], kind: 'NOT' };
		if (node.kind === 'AND')
			return {
				...base,
				childNodeIds: base.childNodeIds as [string, ...string[]],
				kind: 'AND'
			};
		return {
			...base,
			childNodeIds: base.childNodeIds as [string, ...string[]],
			kind: 'OR'
		};
	});
	return {
		expression: {
			maxObservedDepth,
			maxObservedFanout,
			nodeCount: publicNodes.length,
			nodes: publicNodes,
			rootNodeId: publicNodes[0]!.nodeId
		},
		nodes
	};
}

function normalizeRecords(
	value: unknown,
	budgets: SemanticSourceQueryBudgets
): readonly SemanticSourceQueryRecord[] {
	const candidates = inspectDenseArray(
		value,
		budgets.maxPopulation,
		'POPULATION_BUDGET_EXCEEDED',
		'VALIDATE_POPULATION',
		'The semantic-source population must be a dense array within maxPopulation.'
	);
	const records: SemanticSourceQueryRecord[] = [];
	const sourceIds = new Set<string>();
	for (const candidate of candidates) {
		const inspected = inspectPlainDataRecord(
			candidate,
			'POPULATION_INVALID',
			'VALIDATE_POPULATION',
			'Every semantic-source record must expose own plain-data scalar query fields.'
		);
		if (SEMANTIC_SOURCE_QUERY_FIELDS.some((key) => !inspected.values.has(key)))
			refuse(
				'POPULATION_INVALID',
				'VALIDATE_POPULATION',
				'A semantic-source record is missing a required query projection field.'
			);
		const projected = {} as Record<string, unknown>;
		for (const field of SEMANTIC_SOURCE_QUERY_FIELDS) {
			const fieldValue = inspected.values.get(field);
			if (!fieldValueIsValid(field, fieldValue))
				refuse(
					'POPULATION_INVALID',
					'VALIDATE_POPULATION',
					'A semantic-source record contains an invalid registered scalar field.'
				);
			projected[field] = fieldValue;
		}
		const id = projected.id as string;
		if (sourceIds.has(id))
			refuse(
				'POPULATION_INVALID',
				'VALIDATE_POPULATION',
				'Semantic-source identities must be unique within the evaluated population.'
			);
		sourceIds.add(id);
		records.push(projected as SemanticSourceQueryRecord);
	}
	return records;
}

function normalizeStringArray(
	value: unknown,
	maximumItems: number,
	message: string
): readonly string[] {
	const entries = inspectDenseArray(
		value,
		maximumItems,
		'LEAF_EVALUATION_FAILED',
		'EVALUATE',
		message
	);
	if (entries.some((entry) => !boundedString(entry)))
		refuse('LEAF_EVALUATION_FAILED', 'EVALUATE', message);
	return entries as readonly string[];
}

function normalizeSupportBasis(value: unknown): SemanticSupportBasis {
	const record = inspectPlainDataRecord(
		value,
		'LEAF_EVALUATION_FAILED',
		'EVALUATE',
		'Leaf support basis must be an exact plain-data record.'
	);
	assertExactKeys(
		record,
		['kind', 'method', 'rationale', 'sourceRefs'],
		[],
		'LEAF_EVALUATION_FAILED',
		'EVALUATE',
		'Leaf support basis must contain exactly kind, method, rationale, and sourceRefs.'
	);
	const kind = record.values.get('kind');
	const method = record.values.get('method');
	const rationale = record.values.get('rationale');
	if (
		!SUPPORT_BASIS_KINDS.has(kind as SemanticSupportBasis['kind']) ||
		(method !== null && !boundedString(method)) ||
		!boundedString(rationale)
	)
		refuse('LEAF_EVALUATION_FAILED', 'EVALUATE', 'Leaf support basis is invalid.');
	return {
		kind: kind as SemanticSupportBasis['kind'],
		method: method as string | null,
		rationale,
		sourceRefs: normalizeStringArray(
			record.values.get('sourceRefs'),
			MAX_EVIDENCE_REFS,
			'Leaf support-basis sourceRefs must be a bounded dense string array.'
		)
	};
}

function normalizeEpistemic(value: unknown): SemanticEpistemicState {
	const record = inspectPlainDataRecord(
		value,
		'LEAF_EVALUATION_FAILED',
		'EVALUATE',
		'Leaf epistemic state must be an exact plain-data record.'
	);
	assertExactKeys(
		record,
		[
			'capabilityCoverage',
			'conflict',
			'executionHealth',
			'freshness',
			'inference',
			'rationale',
			'supportBasis',
			'unresolvedRegions'
		],
		[],
		'LEAF_EVALUATION_FAILED',
		'EVALUATE',
		'Leaf epistemic state contains missing or unregistered dimensions.'
	);
	const capabilityCoverage = record.values.get('capabilityCoverage');
	const conflict = record.values.get('conflict');
	const executionHealth = record.values.get('executionHealth');
	const freshness = record.values.get('freshness');
	const inference = record.values.get('inference');
	const rationale = record.values.get('rationale');
	if (
		!CAPABILITY_COVERAGE.has(capabilityCoverage as SemanticCapabilityCoverage) ||
		!CONFLICT.has(conflict as SemanticConflict) ||
		!EXECUTION_HEALTH.has(executionHealth as SemanticExecutionHealth) ||
		!FRESHNESS.has(freshness as SemanticFreshness) ||
		!INFERENCE.has(inference as SemanticInference) ||
		!boundedString(rationale)
	)
		refuse('LEAF_EVALUATION_FAILED', 'EVALUATE', 'Leaf epistemic dimensions are invalid.');
	return {
		capabilityCoverage: capabilityCoverage as SemanticCapabilityCoverage,
		conflict: conflict as SemanticConflict,
		executionHealth: executionHealth as SemanticExecutionHealth,
		freshness: freshness as SemanticFreshness,
		inference: inference as SemanticInference,
		rationale,
		supportBasis: normalizeSupportBasis(record.values.get('supportBasis')),
		unresolvedRegions: normalizeStringArray(
			record.values.get('unresolvedRegions'),
			MAX_UNRESOLVED_REGIONS,
			'Leaf unresolvedRegions must be a bounded dense string array.'
		)
	};
}

function normalizeEvidencePair(value: unknown): SemanticQueryEvidencePair {
	const record = inspectPlainDataRecord(
		value,
		'LEAF_EVALUATION_FAILED',
		'EVALUATE',
		'Leaf evidencePair must be an exact plain-data record.'
	);
	assertExactKeys(
		record,
		['falseSupport', 'trueSupport'],
		[],
		'LEAF_EVALUATION_FAILED',
		'EVALUATE',
		'Leaf evidencePair must contain exactly falseSupport and trueSupport.'
	);
	const falseSupport = record.values.get('falseSupport');
	const trueSupport = record.values.get('trueSupport');
	if ((falseSupport !== 0 && falseSupport !== 1) || (trueSupport !== 0 && trueSupport !== 1))
		refuse('LEAF_EVALUATION_FAILED', 'EVALUATE', 'Leaf evidence support must be 0 or 1.');
	return { falseSupport, trueSupport };
}

function normalizeApplicability(value: unknown): SemanticQueryApplicability {
	const record = inspectPlainDataRecord(
		value,
		'LEAF_EVALUATION_FAILED',
		'EVALUATE',
		'Leaf applicability must be an exact plain-data record.'
	);
	assertExactKeys(
		record,
		['applicabilityBasis', 'rationale', 'reasonCode', 'semanticOwnerRef'],
		[],
		'LEAF_EVALUATION_FAILED',
		'EVALUATE',
		'Leaf applicability contains missing or unregistered fields.'
	);
	const rationale = record.values.get('rationale');
	const reasonCode = record.values.get('reasonCode');
	const semanticOwnerRef = record.values.get('semanticOwnerRef');
	if (
		!boundedString(rationale) ||
		!stableIdentifier(reasonCode) ||
		!stableIdentifier(semanticOwnerRef)
	)
		refuse('LEAF_EVALUATION_FAILED', 'EVALUATE', 'Leaf applicability fields are invalid.');
	return {
		applicabilityBasis: normalizeStringArray(
			record.values.get('applicabilityBasis'),
			MAX_EVIDENCE_REFS,
			'Leaf applicabilityBasis must be a bounded dense string array.'
		),
		rationale,
		reasonCode,
		semanticOwnerRef
	};
}

function normalizeLeafEvaluation(value: unknown): SemanticSourceQueryLeafEvaluation {
	const record = inspectPlainDataRecord(
		value,
		'LEAF_EVALUATION_FAILED',
		'EVALUATE',
		'Leaf evaluator output must be an exact plain-data record.'
	);
	const disposition = record.values.get('disposition');
	if (disposition === 'applicable-result') {
		assertExactKeys(
			record,
			['disposition', 'epistemic', 'evidencePair', 'evidenceRefs'],
			[],
			'LEAF_EVALUATION_FAILED',
			'EVALUATE',
			'Applicable leaf output contains missing or unregistered fields.'
		);
		const epistemic = normalizeEpistemic(record.values.get('epistemic'));
		const evidencePair = normalizeEvidencePair(record.values.get('evidencePair'));
		if (truthForEvidencePair(evidencePair) === 'C' && epistemic.conflict !== 'conflicting')
			refuse(
				'LEAF_EVALUATION_FAILED',
				'EVALUATE',
				'Contradictory leaf support requires an explicit conflicting epistemic state.'
			);
		return {
			disposition,
			epistemic,
			evidencePair,
			evidenceRefs: normalizeStringArray(
				record.values.get('evidenceRefs'),
				MAX_EVIDENCE_REFS,
				'Leaf evidenceRefs must be a bounded dense string array.'
			)
		};
	}
	if (disposition === 'not-applicable') {
		assertExactKeys(
			record,
			['applicability', 'disposition'],
			[],
			'LEAF_EVALUATION_FAILED',
			'EVALUATE',
			'Not-applicable leaf output contains missing or unregistered fields.'
		);
		return {
			applicability: normalizeApplicability(record.values.get('applicability')),
			disposition
		};
	}
	refuse(
		'LEAF_EVALUATION_FAILED',
		'EVALUATE',
		'Leaf evaluator disposition must be applicable-result or not-applicable.'
	);
}

export function evidencePairForTruth(truth: SemanticQueryTruth): SemanticQueryEvidencePair {
	switch (truth) {
		case 'T':
			return Object.freeze({ falseSupport: 0, trueSupport: 1 });
		case 'F':
			return Object.freeze({ falseSupport: 1, trueSupport: 0 });
		case 'U':
			return Object.freeze({ falseSupport: 0, trueSupport: 0 });
		case 'C':
			return Object.freeze({ falseSupport: 1, trueSupport: 1 });
	}
}

export function truthForEvidencePair(evidencePair: SemanticQueryEvidencePair): SemanticQueryTruth {
	if (
		(evidencePair.falseSupport !== 0 && evidencePair.falseSupport !== 1) ||
		(evidencePair.trueSupport !== 0 && evidencePair.trueSupport !== 1)
	)
		throw new TypeError('Evidence support must be 0 or 1.');
	if (evidencePair.trueSupport === 1) return evidencePair.falseSupport === 1 ? 'C' : 'T';
	return evidencePair.falseSupport === 1 ? 'F' : 'U';
}

function applicableProjection(
	evidencePair: SemanticQueryEvidencePair
): SemanticQueryApplicableProjection {
	return Object.freeze({
		disposition: 'applicable-result',
		evidencePair: Object.freeze({ ...evidencePair }),
		truth: truthForEvidencePair(evidencePair)
	});
}

function allChildrenNotApplicable(
	operator: 'AND' | 'OR',
	children: readonly SemanticQueryProjection[]
): SemanticQueryProjection {
	return Object.freeze({
		applicability: Object.freeze({
			applicabilityBasis: Object.freeze(
				boundedUniqueStrings(
					children.map((child) =>
						child.disposition === 'not-applicable' ? child.applicability.applicabilityBasis : []
					),
					MAX_EVIDENCE_REFS,
					'Aggregate not-applicable evidence exceeds the fixed vector ceiling.'
				)
			),
			rationale: `Every ordered ${operator} child was reasoned not applicable.`,
			reasonCode: 'ALL_CHILDREN_NOT_APPLICABLE',
			semanticOwnerRef: 'semantic-source-query-logical-expression'
		}),
		disposition: 'not-applicable'
	});
}

export function semanticQueryNot(child: SemanticQueryProjection): SemanticQueryProjection {
	if (child.disposition === 'not-applicable') {
		if (child.applicability.applicabilityBasis.length > MAX_EVIDENCE_REFS)
			throw new RangeError('NOT applicability evidence exceeds the fixed vector ceiling.');
		return Object.freeze({
			applicability: Object.freeze({
				...child.applicability,
				applicabilityBasis: Object.freeze([...child.applicability.applicabilityBasis])
			}),
			disposition: 'not-applicable'
		});
	}
	return applicableProjection({
		falseSupport: child.evidencePair.trueSupport,
		trueSupport: child.evidencePair.falseSupport
	});
}

export function semanticQueryAnd(
	children: readonly [SemanticQueryProjection, ...SemanticQueryProjection[]]
): SemanticQueryProjection {
	if (children.length === 0) throw new RangeError('AND requires at least one child.');
	if (children.length > SEMANTIC_SOURCE_QUERY_SAFETY_CEILINGS.maxFanout)
		throw new RangeError('AND exceeds the fixed fanout ceiling.');
	if (children.every((child) => child.disposition === 'not-applicable'))
		return allChildrenNotApplicable('AND', children);
	let falseSupport: 0 | 1 = 0;
	let trueSupport: 0 | 1 = 1;
	for (const child of children) {
		const evidencePair =
			child.disposition === 'applicable-result'
				? child.evidencePair
				: ({ falseSupport: 0, trueSupport: 0 } as const);
		if (evidencePair.falseSupport === 1) falseSupport = 1;
		if (evidencePair.trueSupport === 0) trueSupport = 0;
	}
	return applicableProjection({ falseSupport, trueSupport });
}

export function semanticQueryOr(
	children: readonly [SemanticQueryProjection, ...SemanticQueryProjection[]]
): SemanticQueryProjection {
	if (children.length === 0) throw new RangeError('OR requires at least one child.');
	if (children.length > SEMANTIC_SOURCE_QUERY_SAFETY_CEILINGS.maxFanout)
		throw new RangeError('OR exceeds the fixed fanout ceiling.');
	if (children.every((child) => child.disposition === 'not-applicable'))
		return allChildrenNotApplicable('OR', children);
	let falseSupport: 0 | 1 = 1;
	let trueSupport: 0 | 1 = 0;
	for (const child of children) {
		const evidencePair =
			child.disposition === 'applicable-result'
				? child.evidencePair
				: ({ falseSupport: 0, trueSupport: 0 } as const);
		if (evidencePair.falseSupport === 0) falseSupport = 0;
		if (evidencePair.trueSupport === 1) trueSupport = 1;
	}
	return applicableProjection({ falseSupport, trueSupport });
}

function defaultLeafEvaluation(
	expression:
		| SemanticSourceQueryNormalizedEqualityNode
		| SemanticSourceQueryNormalizedLogicalPathStartsWithNode,
	record: SemanticSourceQueryRecord
): SemanticSourceQueryApplicableLeafEvaluation {
	const fieldValue = (record as unknown as Record<SemanticSourceQueryField, unknown>)[
		expression.field
	];
	const evidenceRefs = [
		`semantic-source:${record.id}`,
		`semantic-provenance:${record.provenanceId}`,
		`semantic-source-field:${expression.field}`
	];
	const supported =
		expression.kind === 'EQUALS'
			? Object.is(fieldValue, expression.value)
			: record.logicalPath.startsWith(expression.value);
	return {
		disposition: 'applicable-result',
		epistemic: {
			capabilityCoverage: 'supported',
			conflict: 'unopposed',
			executionHealth: 'succeeded',
			freshness: 'unknown',
			inference: 'direct',
			rationale:
				'The registered scalar predicate was evaluated directly over a retained SemanticSourceRecord; snapshot currentness is intentionally not asserted by this core.',
			supportBasis: {
				kind: 'direct-extraction',
				method: `${SEMANTIC_SOURCE_QUERY_OPERATION_VERSION}:${expression.kind}`,
				rationale:
					expression.kind === 'EQUALS'
						? 'The compared scalar is an explicit SemanticSourceRecord data property.'
						: 'The retained logicalPath was compared to the exact nonempty case-sensitive prefix without normalization, globbing, regular-expression matching, or path-segment inference.',
				sourceRefs: evidenceRefs
			},
			unresolvedRegions: ['snapshot-currentness-not-bound-in-query-core']
		},
		evidencePair: evidencePairForTruth(supported ? 'T' : 'F'),
		evidenceRefs
	};
}

function boundedUniqueStrings(
	groups: readonly (readonly string[])[],
	maximum: number,
	message: string
): readonly string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const values of groups)
		for (const value of values)
			if (!seen.has(value)) {
				if (result.length >= maximum) refuse('EVALUATION_BUDGET_EXCEEDED', 'EVALUATE', message);
				seen.add(value);
				result.push(value);
			}
	return result;
}

function composeCapabilityCoverage(
	states: readonly SemanticCapabilityCoverage[]
): SemanticCapabilityCoverage {
	if (states.every((state) => state === 'supported')) return 'supported';
	if (states.every((state) => state === 'excluded')) return 'excluded';
	if (states.every((state) => state === 'not-analyzed')) return 'not-analyzed';
	if (states.every((state) => state === 'unsupported')) return 'unsupported';
	return 'partial';
}

function composeFreshness(states: readonly SemanticFreshness[]): SemanticFreshness {
	if (states.length === 0) return 'unknown';
	if (states.includes('invalidated')) return 'invalidated';
	if (states.includes('stale')) return 'stale';
	if (states.includes('unknown')) return 'unknown';
	return 'current-for-subject';
}

function composeExecutionHealth(
	states: readonly SemanticExecutionHealth[]
): SemanticExecutionHealth {
	for (const state of [
		'failed',
		'timed-out',
		'cancelled',
		'resource-exhausted',
		'malformed-output',
		'unavailable',
		'not-run'
	] as const)
		if (states.includes(state)) return state;
	return 'succeeded';
}

function composeConflict(states: readonly SemanticConflict[]): SemanticConflict {
	if (states.includes('conflicting')) return 'conflicting';
	if (states.includes('corrected')) return 'corrected';
	if (states.includes('superseded')) return 'superseded';
	if (states.includes('corroborated')) return 'corroborated';
	return 'unopposed';
}

function epistemicTraceForLeaf(
	epistemic: SemanticEpistemicState
): SemanticSourceQueryEpistemicTrace {
	return {
		contributions: {
			capabilityCoverage: [epistemic.capabilityCoverage],
			conflict: [epistemic.conflict],
			executionHealth: [epistemic.executionHealth],
			freshness: [epistemic.freshness],
			inference: [epistemic.inference],
			supportBasis: [epistemic.supportBasis]
		},
		effective: epistemic
	};
}

function composeEpistemic(
	kind: 'NOT' | 'AND' | 'OR',
	projection: SemanticQueryApplicableProjection,
	children: readonly InternalNodeResult[],
	evidenceRefs: readonly string[]
): SemanticSourceQueryEpistemicTrace {
	const applicable = children.filter(
		(child): child is InternalApplicableResult => child.disposition === 'applicable-result'
	);
	const capabilityCoverage = applicable.map(
		(child) => child.epistemic.effective.capabilityCoverage
	);
	const conflict = applicable.map((child) => child.epistemic.effective.conflict);
	const executionHealth = applicable.map((child) => child.epistemic.effective.executionHealth);
	const freshness = applicable.map((child) => child.epistemic.effective.freshness);
	const inference = applicable.map((child) => child.epistemic.effective.inference);
	const supportBasis = applicable.map((child) => child.epistemic.effective.supportBasis);
	const determiningFreshness = applicable
		.filter((child) => {
			const childTrueSupport =
				kind === 'NOT' ? child.evidencePair.falseSupport : child.evidencePair.trueSupport;
			const childFalseSupport =
				kind === 'NOT' ? child.evidencePair.trueSupport : child.evidencePair.falseSupport;
			return (
				(projection.evidencePair.trueSupport === 1 && childTrueSupport === 1) ||
				(projection.evidencePair.falseSupport === 1 && childFalseSupport === 1)
			);
		})
		.map((child) => child.epistemic.effective.freshness);
	const unresolvedRegions = boundedUniqueStrings(
		[
			...applicable.map((child) => child.epistemic.effective.unresolvedRegions),
			...(determiningFreshness.length === 0
				? [['query-result-has-no-determining-support'] as const]
				: [])
		],
		MAX_UNRESOLVED_REGIONS,
		'Aggregate unresolved-region evidence exceeds the fixed vector ceiling.'
	);
	return {
		contributions: {
			capabilityCoverage,
			conflict,
			executionHealth,
			freshness,
			inference,
			supportBasis
		},
		effective: {
			capabilityCoverage: composeCapabilityCoverage(capabilityCoverage),
			conflict: composeConflict(conflict),
			executionHealth: composeExecutionHealth(executionHealth),
			freshness: composeFreshness(determiningFreshness),
			inference: 'derived',
			rationale: `The ${kind} operator completed a deterministic left-to-right fold while retaining each orthogonal child dimension.`,
			supportBasis: {
				kind: 'derived',
				method: `${SEMANTIC_SOURCE_QUERY_OPERATION_VERSION}:${SEMANTIC_SOURCE_QUERY_ALGEBRA_VERSION}:${kind}`,
				rationale:
					'The effective predicate projection is derived from the exact four-valued evidence-pair algebra.',
				sourceRefs: evidenceRefs
			},
			unresolvedRegions
		}
	};
}

function projectionOf(result: InternalNodeResult): SemanticQueryProjection {
	if (result.disposition === 'not-applicable')
		return { applicability: result.applicability, disposition: result.disposition };
	return {
		disposition: result.disposition,
		evidencePair: result.evidencePair,
		truth: result.truth
	};
}

function childContribution(result: InternalNodeResult): SemanticSourceQueryChildContribution {
	if (result.disposition === 'not-applicable')
		return {
			applicability: result.applicability,
			disposition: result.disposition,
			nodeId: result.trace.nodeId
		};
	return {
		disposition: result.disposition,
		epistemic: result.epistemic.effective,
		evidencePair: result.evidencePair,
		evidenceRefs: result.evidenceRefs,
		nodeId: result.trace.nodeId,
		truth: result.truth
	};
}

function evaluateRecord(
	record: SemanticSourceQueryRecord,
	ast: NormalizedAst,
	evaluateLeaf: SemanticSourceQueryLeafEvaluator | undefined
): SemanticSourceQueryRecordResult {
	const evaluated: InternalNodeResult[] = new Array(ast.nodes.length);
	// Invoke every leaf in registered pre-order so observable callback order is
	// deterministic left-to-right, independent of the post-order composition pass.
	for (let ordinal = 0; ordinal < ast.nodes.length; ordinal += 1) {
		const node = ast.nodes[ordinal]!;
		if (node.kind !== 'EQUALS' && node.kind !== 'LOGICAL_PATH_STARTS_WITH') continue;
		const publicNode = ast.expression.nodes[ordinal]!;
		const childResults = node.childOrdinals.map((childOrdinal) => evaluated[childOrdinal]!);
		const childContributions = childResults.map(childContribution);
		const expression = publicNode as
			| SemanticSourceQueryNormalizedEqualityNode
			| SemanticSourceQueryNormalizedLogicalPathStartsWithNode;
		let leaf: SemanticSourceQueryLeafEvaluation;
		try {
			leaf = normalizeLeafEvaluation(
				evaluateLeaf === undefined
					? defaultLeafEvaluation(expression, record)
					: evaluateLeaf(deepFreezeConstructed({ expression, record }))
			);
		} catch (error) {
			if (error instanceof QueryRefusal) throw error;
			refuse(
				'LEAF_EVALUATION_FAILED',
				'EVALUATE',
				'A registered leaf evaluator failed or returned unsafe output.'
			);
		}
		if (leaf.disposition === 'not-applicable') {
			const trace: SemanticSourceQueryTraceNode = {
				applicability: leaf.applicability,
				childContributions,
				childNodeIds: publicNode.childNodeIds,
				compositionRuleVersion: SEMANTIC_SOURCE_QUERY_ALGEBRA_VERSION,
				disposition: leaf.disposition,
				kind: node.kind,
				nodeId: node.nodeId,
				ordinal
			};
			evaluated[ordinal] = {
				applicability: leaf.applicability,
				disposition: leaf.disposition,
				trace
			};
			continue;
		}
		const truth = truthForEvidencePair(leaf.evidencePair);
		const epistemic = epistemicTraceForLeaf(leaf.epistemic);
		const trace: SemanticSourceQueryTraceNode = {
			childContributions,
			childNodeIds: publicNode.childNodeIds,
			compositionRuleVersion: SEMANTIC_SOURCE_QUERY_ALGEBRA_VERSION,
			disposition: leaf.disposition,
			epistemic,
			evidencePair: leaf.evidencePair,
			evidenceRefs: leaf.evidenceRefs,
			kind: node.kind,
			nodeId: node.nodeId,
			ordinal,
			truth
		};
		evaluated[ordinal] = {
			disposition: leaf.disposition,
			epistemic,
			evidencePair: leaf.evidencePair,
			evidenceRefs: leaf.evidenceRefs,
			trace,
			truth
		};
	}

	// Compose operators bottom-up only after every leaf callback has completed.
	for (let ordinal = ast.nodes.length - 1; ordinal >= 0; ordinal -= 1) {
		const node = ast.nodes[ordinal]!;
		if (node.kind === 'EQUALS' || node.kind === 'LOGICAL_PATH_STARTS_WITH') continue;
		const publicNode = ast.expression.nodes[ordinal]!;
		const childResults = node.childOrdinals.map((childOrdinal) => evaluated[childOrdinal]!);
		const childContributions = childResults.map(childContribution);
		const projections = childResults.map(projectionOf) as [
			SemanticQueryProjection,
			...SemanticQueryProjection[]
		];
		const projection =
			node.kind === 'NOT'
				? semanticQueryNot(projections[0]!)
				: node.kind === 'AND'
					? semanticQueryAnd(projections)
					: semanticQueryOr(projections);
		if (projection.disposition === 'not-applicable') {
			const trace: SemanticSourceQueryTraceNode = {
				applicability: projection.applicability,
				childContributions,
				childNodeIds: publicNode.childNodeIds,
				compositionRuleVersion: SEMANTIC_SOURCE_QUERY_ALGEBRA_VERSION,
				disposition: projection.disposition,
				kind: node.kind,
				nodeId: node.nodeId,
				ordinal
			};
			evaluated[ordinal] = {
				applicability: projection.applicability,
				disposition: projection.disposition,
				trace
			};
			continue;
		}
		const evidenceRefs = boundedUniqueStrings(
			childResults.map((child) =>
				child.disposition === 'applicable-result' ? child.evidenceRefs : []
			),
			MAX_EVIDENCE_REFS,
			'Aggregate query evidence references exceed the fixed vector ceiling.'
		);
		const epistemic = composeEpistemic(node.kind, projection, childResults, evidenceRefs);
		const trace: SemanticSourceQueryTraceNode = {
			childContributions,
			childNodeIds: publicNode.childNodeIds,
			compositionRuleVersion: SEMANTIC_SOURCE_QUERY_ALGEBRA_VERSION,
			disposition: projection.disposition,
			epistemic,
			evidencePair: projection.evidencePair,
			evidenceRefs,
			kind: node.kind,
			nodeId: node.nodeId,
			ordinal,
			truth: projection.truth
		};
		evaluated[ordinal] = {
			disposition: projection.disposition,
			epistemic,
			evidencePair: projection.evidencePair,
			evidenceRefs,
			trace,
			truth: projection.truth
		};
	}

	const root = evaluated[0]!;
	const trace = evaluated.map((result) => result.trace);
	if (root.disposition === 'not-applicable')
		return {
			applicability: root.applicability,
			disposition: root.disposition,
			sourceId: record.id,
			trace
		};
	return {
		disposition: root.disposition,
		epistemic: root.epistemic,
		evidencePair: root.evidencePair,
		evidenceRefs: root.evidenceRefs,
		sourceId: record.id,
		trace,
		truth: root.truth
	};
}

function countsFor(
	results: readonly SemanticSourceQueryRecordResult[]
): SemanticSourceQueryEvaluationCounts {
	const counts: SemanticSourceQueryEvaluationCounts = {
		conflicting: 0,
		notApplicable: 0,
		supportedFalse: 0,
		supportedTrue: 0,
		unknown: 0
	};
	for (const result of results) {
		if (result.disposition === 'not-applicable') {
			(counts as { notApplicable: number }).notApplicable += 1;
			continue;
		}
		switch (result.truth) {
			case 'T':
				(counts as { supportedTrue: number }).supportedTrue += 1;
				break;
			case 'F':
				(counts as { supportedFalse: number }).supportedFalse += 1;
				break;
			case 'U':
				(counts as { unknown: number }).unknown += 1;
				break;
			case 'C':
				(counts as { conflicting: number }).conflicting += 1;
				break;
		}
	}
	return counts;
}

function safeProduct(left: number, right: number): number | null {
	const product = left * right;
	return Number.isSafeInteger(product) ? product : null;
}

function evaluateInternal(input: unknown): SemanticSourceQueryEvaluationOutcome {
	const shell = inspectPlainDataRecord(
		input,
		'INPUT_INVALID',
		'REQUEST',
		'Query evaluation input must be an exact plain-data shell.'
	);
	assertExactKeys(
		shell,
		['budgets', 'expression', 'mode', 'records'],
		['evaluateLeaf'],
		'INPUT_INVALID',
		'REQUEST',
		'Query evaluation input contains missing or unregistered fields.'
	);
	if (shell.values.get('mode') !== SEMANTIC_SOURCE_QUERY_EXECUTION_MODE)
		refuse('INPUT_INVALID', 'REQUEST', 'Only COMPLETE expression evaluation is implemented.');
	const evaluateLeafCandidate = shell.values.get('evaluateLeaf');
	if (
		evaluateLeafCandidate !== undefined &&
		(typeof evaluateLeafCandidate !== 'function' || isProxyValue(evaluateLeafCandidate))
	)
		refuse('INPUT_INVALID', 'REQUEST', 'evaluateLeaf must be a registered function when provided.');
	const budgets = normalizeBudgets(shell.values.get('budgets'));

	// Absolute ceilings are refusal limits, not completeness claims or default budgets.
	// This complete prepass precedes population inspection and every leaf invocation.
	const ast = normalizeExpression(shell.values.get('expression'), budgets);
	const records = normalizeRecords(shell.values.get('records'), budgets);
	const requiredEvaluations = safeProduct(records.length, ast.nodes.length);
	if (
		requiredEvaluations === null ||
		requiredEvaluations > budgets.maxEvaluations ||
		requiredEvaluations > budgets.maxTraceNodes
	)
		refuse(
			'EVALUATION_BUDGET_EXCEEDED',
			'EVALUATE',
			'COMPLETE evaluation would exceed maxEvaluations or maxTraceNodes.'
		);
	const recordResults = records.map((record) =>
		evaluateRecord(
			record,
			ast,
			evaluateLeafCandidate as SemanticSourceQueryLeafEvaluator | undefined
		)
	);
	const counts = countsFor(recordResults);
	const partitionTotal = Object.values(counts).reduce((total, count) => total + count, 0);
	const evaluation: SemanticSourceQueryEvaluation = {
		capabilityStatus: SEMANTIC_SOURCE_QUERY_CAPABILITY_STATUS,
		coverage: {
			chargedEvaluations: requiredEvaluations,
			counts,
			partitionsReconcile: partitionTotal === records.length,
			populationRecords: records.length,
			traceNodes: requiredEvaluations
		},
		expression: ast.expression,
		mode: SEMANTIC_SOURCE_QUERY_EXECUTION_MODE,
		nonclaims: SEMANTIC_SOURCE_QUERY_NONCLAIMS,
		operationVersion: SEMANTIC_SOURCE_QUERY_OPERATION_VERSION,
		population: SEMANTIC_SOURCE_QUERY_POPULATION,
		recordResults
	};
	return deepFreezeConstructed({ evaluation, state: 'EVALUATED' });
}

export function evaluateSemanticSourceQuery(
	input: EvaluateSemanticSourceQueryInput
): SemanticSourceQueryEvaluationOutcome {
	try {
		return evaluateInternal(input);
	} catch (error) {
		if (error instanceof QueryRefusal)
			return deepFreezeConstructed({
				diagnostic: { code: error.code, message: error.message, phase: error.phase },
				state: 'REFUSED' as const
			});
		return deepFreezeConstructed({
			diagnostic: {
				code: 'INPUT_INVALID' as const,
				message: 'Query inputs could not be inspected safely.',
				phase: 'REQUEST' as const
			},
			state: 'REFUSED' as const
		});
	}
}
