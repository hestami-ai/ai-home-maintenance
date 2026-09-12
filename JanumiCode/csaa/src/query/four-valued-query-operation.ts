import { isProxy } from 'node:util/types';

import { canonicalSemanticJson, canonicalSemanticJsonWitness } from '../semantic/canonical.js';
import {
	FOUR_VALUED_QUERY_ALGEBRA_VERSION,
	FOUR_VALUED_QUERY_SAFETY_CEILINGS,
	evaluateFourValuedExpression,
	type FourValuedEvaluationDiagnostic,
	type FourValuedEvaluationMode,
	type FourValuedExpression,
	type FourValuedExpressionEvaluation,
	type FourValuedQueryBudgets,
	type FourValuedTruth
} from './four-valued-query-algebra.js';

export const FOUR_VALUED_QUERY_OPERATION_REQUEST_SCHEMA_VERSION =
	'jan-csaa-four-valued-query-operation-request/0.1.0' as const;
export const FOUR_VALUED_QUERY_OPERATION_SCHEMA_VERSION =
	'jan-csaa-four-valued-query-operation/0.1.0' as const;
export const FOUR_VALUED_QUERY_OPERATION_RESULT_SCHEMA_VERSION =
	'jan-csaa-four-valued-query-operation-result/0.1.0' as const;
export const FOUR_VALUED_QUERY_OPERATION_VERSION =
	'jan-csaa-evaluate-four-valued-query/0.1.0' as const;
export const FOUR_VALUED_QUERY_OPERATION_CAPABILITY =
	'IMPLEMENTATION_LOCAL_FOUR_VALUED_QUERY_OPERATION' as const;
export const FOUR_VALUED_QUERY_OPERATION_CAPABILITY_STATUS =
	'IMPLEMENTATION_LOCAL_UNREGISTERED' as const;
export const FOUR_VALUED_QUERY_OPERATION_ANALYSIS_AUTHORITY = 'NONE' as const;
export const FOUR_VALUED_QUERY_OPERATION_AUTHORITY_TRANSFER = 'NONE' as const;
export const FOUR_VALUED_QUERY_OPERATION_GATE_EFFECT = 'NONE' as const;
export const FOUR_VALUED_QUERY_OPERATION_MIN_RESULT_BYTES = 16 * 1024;

export const FOUR_VALUED_QUERY_OPERATION_NONCLAIMS = Object.freeze([
	'FULL_JAN_CSAA_CAP_029_SEMANTIC_QUERY',
	'DWP_005_DWP_006_OR_G5_COMPLETION_OR_PASSAGE',
	'JAN_CSAA_007_REGISTERED_QUERY_REFERENCE_QUERY_RESULT_BINDING_OR_OPERATION_RESPONSE',
	'JAN_CSAA_QUERY_RESULT_OR_QUERY_RESULT_OCCURRENCE_CONFORMANCE',
	'FULL_JAN_CSAA_007_008_009_010_OR_011_CONFORMANCE',
	'STATIC_SEMANTIC_SNAPSHOT_EXECUTION_EVIDENCE_OR_ANALYSIS_RUN_BINDING',
	'RAW_EVIDENCE_OR_TRANSFORMATION_PROVENANCE',
	'PROVIDER_INVOCATION_OR_PROVIDER_EXECUTION_EVIDENCE',
	'REDACTION_POLICY_OR_REDACTION_EXECUTION',
	'OBSERVATION_TIME_RECORD_TIME_OR_LOGICAL_INVALIDATION_DEPENDENCY',
	'CALLER_QUERY_IDENTITY_REGISTRATION_PERSISTENCE_OR_GOVERNED_PURPOSE_VALIDATION',
	'REPORT_AUTHENTICITY_SIGNATURE_OR_EXTERNAL_INTEGRITY_BINDING',
	'LITERAL_TRUTH_SUPPORT_PROVENANCE_OR_CORRECTNESS_VALIDATION',
	'NOT_APPLICABLE_UNSUPPORTED_EXCLUDED_STALE_FAILED_OR_SIX_DIMENSION_EPISTEMIC_COMPOSITION',
	'PREDICATE_TRAVERSAL_SLICE_JOIN_AGGREGATION_ORDERING_PAGING_OR_DYNAMIC_EVIDENCE',
	'POPULATION_CLOSURE_BEYOND_EACH_CALLER_DECLARED_QUANTIFIER_BOUNDARY',
	'CALLER_DECLARED_CLOSED_COMPLETE_AS_DEMONSTRATED_POPULATION_CLOSURE',
	'NODE_TOTAL_SHORT_CIRCUIT_TRACE_AS_COMPLETE_CHILD_EVIDENCE',
	'WHOLE_REPOSITORY_WHOLE_PROGRAM_RUNTIME_OR_NEGATIVE_POPULATION_CLOSURE',
	'RULE_FINDING_SEVERITY_GATE_REMEDIATION_DISPOSITION_OR_DESIGN_AUTHORITY',
	'ACCESS_CONTROL_PERSISTENCE_CANCELLATION_CURRENTNESS_OR_CROSS_REVISION_COMPARISON',
	'PROVIDER_QUALIFICATION_OR_ORACLE_CONFERRAL'
] as const);

export interface FourValuedQueryOperationBudgets {
	readonly evaluation: FourValuedQueryBudgets;
	/** Maximum normalized-expression trace records retained in a successful result. */
	readonly maxExplanationRecords: number;
	/** Maximum canonical terminal result bytes, including one trailing LF. */
	readonly maxResultBytes: number;
}

export const FOUR_VALUED_QUERY_OPERATION_SAFETY_CEILINGS = Object.freeze({
	evaluation: Object.freeze({ ...FOUR_VALUED_QUERY_SAFETY_CEILINGS }),
	maxExplanationRecords: FOUR_VALUED_QUERY_SAFETY_CEILINGS.maxTraceNodes,
	maxResultBytes: 16 * 1024 * 1024
} satisfies FourValuedQueryOperationBudgets);

export interface FourValuedQueryOperationRequest {
	readonly budgets: FourValuedQueryOperationBudgets;
	/** Caller-owned correlation identity; it conveys no authority or evidence provenance. */
	readonly executionId: string;
	readonly expression: FourValuedExpression;
	readonly mode: FourValuedEvaluationMode;
	readonly operationVersion: typeof FOUR_VALUED_QUERY_OPERATION_VERSION;
	readonly query: {
		readonly id: string;
		readonly purpose: string;
		readonly version: string;
	};
	readonly schemaVersion: typeof FOUR_VALUED_QUERY_OPERATION_REQUEST_SCHEMA_VERSION;
}

/** Materialized safe request fields retained after the raw expression has been normalized. */
export interface ValidatedFourValuedQueryOperationRequest {
	readonly budgets: FourValuedQueryOperationBudgets;
	readonly executionId: string;
	readonly expressionNodeCount: number;
	readonly expressionRootNodeId: string;
	readonly mode: FourValuedEvaluationMode;
	readonly operationVersion: typeof FOUR_VALUED_QUERY_OPERATION_VERSION;
	readonly query: {
		readonly id: string;
		readonly purpose: string;
		readonly version: string;
	};
	readonly schemaVersion: typeof FOUR_VALUED_QUERY_OPERATION_REQUEST_SCHEMA_VERSION;
}

export type FourValuedQueryOperationStage = 'REQUEST' | 'EXPRESSION' | 'EXPLANATION' | 'RESULT';

export type FourValuedQueryOperationFailureState = 'failed' | 'incompatible' | 'resource-refused';

export interface FourValuedQueryOperationDiagnostic {
	readonly algebraCode: FourValuedEvaluationDiagnostic['code'] | null;
	readonly code: string;
	readonly message: string;
	readonly path: string | null;
	readonly source: 'OPERATION' | 'FOUR_VALUED_ALGEBRA';
	readonly stage: FourValuedQueryOperationStage;
}

export interface FourValuedQueryOperationValidationSuccess {
	readonly evaluation: FourValuedExpressionEvaluation;
	readonly request: ValidatedFourValuedQueryOperationRequest;
	readonly state: 'VALIDATED';
}

export interface FourValuedQueryOperationValidationRefusal {
	readonly diagnostic: FourValuedQueryOperationDiagnostic;
	readonly failureState: FourValuedQueryOperationFailureState;
	readonly state: 'REFUSED';
}

export type FourValuedQueryOperationValidationOutcome =
	FourValuedQueryOperationValidationSuccess | FourValuedQueryOperationValidationRefusal;

export interface FourValuedQueryExplanationAccounting {
	readonly allDeclaredChildReferencesAccounted: boolean;
	readonly declaredChildReferences: number;
	readonly declaredQuantifierNodes: number;
	readonly dispositionCountsReconcile: boolean;
	readonly emptyEvaluatedQuantifierNodes: number;
	readonly evaluatedChildReferences: number;
	readonly evaluatedNodes: number;
	readonly evaluatedQuantifierNodes: number;
	readonly inputTruthContributions: number;
	readonly intermediateTruthSteps: number;
	readonly normalizedNodes: number;
	readonly ordinalSequenceExact: boolean;
	readonly shortCircuitedImmediateChildReferences: number;
	readonly shortCircuitedNodes: number;
	readonly shortCircuitedQuantifierNodes: number;
	readonly traceNodes: number;
	readonly traceNodeTotal: boolean;
	readonly unevaluatedDescendantChildReferences: number;
	readonly unknownBoundaryApplications: number;
}

export interface FourValuedQueryOperationResult {
	readonly capability: {
		readonly fullJanCsaaCapability029SemanticQuery: 'NOT_CLAIMED';
		readonly id: typeof FOUR_VALUED_QUERY_OPERATION_CAPABILITY;
		readonly registeredJanCsaa007Operation: 'NOT_CLAIMED';
		readonly status: typeof FOUR_VALUED_QUERY_OPERATION_CAPABILITY_STATUS;
	};
	readonly conclusion: FourValuedTruth;
	readonly currentness: 'NOT_ASSESSED_NO_SUBJECT_BOUND';
	readonly evaluation: FourValuedExpressionEvaluation;
	readonly explanation: {
		readonly accounting: FourValuedQueryExplanationAccounting;
		readonly policy: 'NODE_TOTAL_PREORDER_WITH_EXPLICIT_SHORT_CIRCUIT_DISPOSITIONS';
		readonly resultByteAdmission: 'CANONICAL_JSON_PLUS_TERMINAL_LF_WITHIN_CALLER_BUDGET';
	};
	readonly facadeNonclaims: typeof FOUR_VALUED_QUERY_OPERATION_NONCLAIMS;
	readonly query: {
		readonly algebraVersion: typeof FOUR_VALUED_QUERY_ALGEBRA_VERSION;
		readonly executionId: string;
		readonly mode: FourValuedEvaluationMode;
		readonly populationBinding: 'CALLER_SUPPLIED_LITERAL_TRUTH_PROJECTIONS_ONLY';
		readonly quantifierBoundaryBasis: 'CALLER_DECLARED_UNVERIFIED';
		readonly queryId: string;
		readonly queryPurpose: string;
		readonly queryVersion: string;
		readonly rootNodeId: string;
	};
	readonly schemaVersion: typeof FOUR_VALUED_QUERY_OPERATION_RESULT_SCHEMA_VERSION;
}

export interface FourValuedQueryOperationEvaluatedOutcome {
	readonly analysisAuthority: typeof FOUR_VALUED_QUERY_OPERATION_ANALYSIS_AUTHORITY;
	readonly authorityTransfer: typeof FOUR_VALUED_QUERY_OPERATION_AUTHORITY_TRANSFER;
	readonly capabilityStatus: typeof FOUR_VALUED_QUERY_OPERATION_CAPABILITY_STATUS;
	readonly diagnostics: readonly [];
	readonly gateEffect: typeof FOUR_VALUED_QUERY_OPERATION_GATE_EFFECT;
	readonly operationVersion: typeof FOUR_VALUED_QUERY_OPERATION_VERSION;
	readonly outcome: 'evaluated';
	readonly request: ValidatedFourValuedQueryOperationRequest;
	readonly result: FourValuedQueryOperationResult;
	readonly schemaVersion: typeof FOUR_VALUED_QUERY_OPERATION_SCHEMA_VERSION;
	readonly state: 'evaluated';
}

export interface FourValuedQueryOperationUnavailableOutcome {
	readonly analysisAuthority: typeof FOUR_VALUED_QUERY_OPERATION_ANALYSIS_AUTHORITY;
	readonly authorityTransfer: typeof FOUR_VALUED_QUERY_OPERATION_AUTHORITY_TRANSFER;
	readonly capabilityStatus: typeof FOUR_VALUED_QUERY_OPERATION_CAPABILITY_STATUS;
	readonly code: string;
	readonly diagnostics: readonly FourValuedQueryOperationDiagnostic[];
	readonly facadeNonclaims: typeof FOUR_VALUED_QUERY_OPERATION_NONCLAIMS;
	readonly gateEffect: typeof FOUR_VALUED_QUERY_OPERATION_GATE_EFFECT;
	readonly operationVersion: typeof FOUR_VALUED_QUERY_OPERATION_VERSION;
	readonly outcome: 'unavailable';
	readonly request?: ValidatedFourValuedQueryOperationRequest;
	readonly schemaVersion: typeof FOUR_VALUED_QUERY_OPERATION_SCHEMA_VERSION;
	readonly stage: FourValuedQueryOperationStage;
	readonly state: FourValuedQueryOperationFailureState;
}

export type FourValuedQueryOperationOutcome =
	FourValuedQueryOperationEvaluatedOutcome | FourValuedQueryOperationUnavailableOutcome;

export type FourValuedQueryEvaluationReportValidationOutcome =
	| {
			readonly report: FourValuedQueryOperationEvaluatedOutcome;
			readonly state: 'VALID';
	  }
	| {
			readonly diagnostic: FourValuedQueryOperationDiagnostic;
			readonly state: 'INVALID';
	  };

const REQUEST_KEYS = [
	'budgets',
	'executionId',
	'expression',
	'mode',
	'operationVersion',
	'query',
	'schemaVersion'
] as const;
const QUERY_KEYS = ['id', 'purpose', 'version'] as const;
const OPERATION_BUDGET_KEYS = ['evaluation', 'maxExplanationRecords', 'maxResultBytes'] as const;
const EVALUATION_BUDGET_KEYS = [
	'maxDepth',
	'maxEvaluations',
	'maxFanout',
	'maxNodes',
	'maxTraceNodes'
] as const satisfies readonly (keyof FourValuedQueryBudgets)[];
const MODES = new Set<FourValuedEvaluationMode>(['EAGER', 'SHORT_CIRCUIT']);
const MAX_EXECUTION_ID_CHARACTERS = 1_024;
const MAX_QUERY_PURPOSE_CHARACTERS = 4_096;

class OperationRefusal extends Error {
	constructor(
		readonly code: string,
		readonly stage: FourValuedQueryOperationStage,
		readonly failureState: FourValuedQueryOperationFailureState,
		message: string,
		readonly path: string | null = null
	) {
		super(message);
	}
}

interface InspectedRecord {
	readonly values: ReadonlyMap<string, unknown>;
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

function detachTrustedEvaluation(
	evaluation: FourValuedExpressionEvaluation
): FourValuedExpressionEvaluation {
	return JSON.parse(canonicalSemanticJson(evaluation)) as FourValuedExpressionEvaluation;
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

function inspectExactRecord(
	value: unknown,
	expectedKeys: readonly string[],
	message: string
): InspectedRecord {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		throw new OperationRefusal('REQUEST_SHAPE_INVALID', 'REQUEST', 'incompatible', message);
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		throw new OperationRefusal('REQUEST_SHAPE_INVALID', 'REQUEST', 'incompatible', message);
	const ownKeys = Reflect.ownKeys(value);
	if (
		ownKeys.some((key) => typeof key !== 'string') ||
		ownKeys.length !== expectedKeys.length ||
		expectedKeys.some((key) => !ownKeys.includes(key))
	)
		throw new OperationRefusal('REQUEST_SHAPE_INVALID', 'REQUEST', 'incompatible', message);
	const values = new Map<string, unknown>();
	for (const key of expectedKeys) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			throw new OperationRefusal('REQUEST_SHAPE_INVALID', 'REQUEST', 'incompatible', message);
		values.set(key, descriptor.value);
	}
	return { values };
}

function positiveBudget(value: unknown, ceiling: number, path: string): number {
	if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > ceiling)
		throw new OperationRefusal(
			'REQUEST_BUDGET_INVALID',
			'REQUEST',
			value !== null && typeof value === 'number' && value > ceiling
				? 'resource-refused'
				: 'incompatible',
			'Every query-operation budget must be a positive safe integer within its safety ceiling.',
			path
		);
	return value;
}

function materializeBudgets(value: unknown): FourValuedQueryOperationBudgets {
	const record = inspectExactRecord(
		value,
		OPERATION_BUDGET_KEYS,
		'Query-operation budgets must be one exact plain-data object.'
	);
	const evaluationRecord = inspectExactRecord(
		record.values.get('evaluation'),
		EVALUATION_BUDGET_KEYS,
		'Evaluation budgets must be one exact plain-data object.'
	);
	const evaluation = {} as Record<keyof FourValuedQueryBudgets, number>;
	for (const key of EVALUATION_BUDGET_KEYS)
		evaluation[key] = positiveBudget(
			evaluationRecord.values.get(key),
			FOUR_VALUED_QUERY_OPERATION_SAFETY_CEILINGS.evaluation[key],
			`$.budgets.evaluation.${key}`
		);
	const maxExplanationRecords = positiveBudget(
		record.values.get('maxExplanationRecords'),
		FOUR_VALUED_QUERY_OPERATION_SAFETY_CEILINGS.maxExplanationRecords,
		'$.budgets.maxExplanationRecords'
	);
	const maxResultBytes = positiveBudget(
		record.values.get('maxResultBytes'),
		FOUR_VALUED_QUERY_OPERATION_SAFETY_CEILINGS.maxResultBytes,
		'$.budgets.maxResultBytes'
	);
	if (maxResultBytes < FOUR_VALUED_QUERY_OPERATION_MIN_RESULT_BYTES)
		throw new OperationRefusal(
			'REQUEST_RESULT_BUDGET_TOO_SMALL',
			'REQUEST',
			'resource-refused',
			'$.budgets.maxResultBytes is below the operation minimum terminal-envelope budget.',
			'$.budgets.maxResultBytes'
		);
	return Object.freeze({
		evaluation: Object.freeze(evaluation),
		maxExplanationRecords,
		maxResultBytes
	});
}

function executionId(value: unknown): string {
	if (
		typeof value !== 'string' ||
		value.length === 0 ||
		value.length > MAX_EXECUTION_ID_CHARACTERS ||
		!isUnicodeScalarString(value)
	)
		throw new OperationRefusal(
			'REQUEST_EXECUTION_ID_INVALID',
			'REQUEST',
			'incompatible',
			'$.executionId must be a nonempty bounded Unicode scalar string.',
			'$.executionId'
		);
	return value;
}

function queryText(value: unknown, path: string, maximum: number): string {
	if (
		typeof value !== 'string' ||
		value.length === 0 ||
		value.length > maximum ||
		!isUnicodeScalarString(value)
	)
		throw new OperationRefusal(
			'REQUEST_QUERY_IDENTITY_INVALID',
			'REQUEST',
			'incompatible',
			`${path} must be a nonempty bounded Unicode scalar string.`,
			path
		);
	return value;
}

function operationDiagnostic(error: OperationRefusal): FourValuedQueryOperationDiagnostic {
	return {
		algebraCode: null,
		code: error.code,
		message: error.message,
		path: error.path,
		source: 'OPERATION',
		stage: error.stage
	};
}

function algebraDiagnostic(
	diagnostic: FourValuedEvaluationDiagnostic
): FourValuedQueryOperationDiagnostic {
	const budget =
		diagnostic.code === 'AST_BUDGET_EXCEEDED' || diagnostic.code === 'EVALUATION_BUDGET_EXCEEDED';
	return {
		algebraCode: diagnostic.code,
		code: budget
			? 'EXPRESSION_BUDGET_EXCEEDED'
			: diagnostic.code === 'INTERNAL_EVALUATION_FAILED'
				? 'EXPRESSION_EVALUATION_FAILED'
				: 'EXPRESSION_INVALID',
		message: diagnostic.message,
		path: '$.expression',
		source: 'FOUR_VALUED_ALGEBRA',
		stage: 'EXPRESSION'
	};
}

function refusal(
	diagnostic: FourValuedQueryOperationDiagnostic,
	failureState: FourValuedQueryOperationFailureState
): FourValuedQueryOperationValidationRefusal {
	return deepFreezeConstructed({ diagnostic, failureState, state: 'REFUSED' as const });
}

/** IMPLEMENTATION_LOCAL_UNREGISTERED request admission; not a JAN-CSAA-007 operation contract. */
export function validateFourValuedQueryOperationRequest(
	value: unknown
): FourValuedQueryOperationValidationOutcome {
	try {
		const record = inspectExactRecord(
			value,
			REQUEST_KEYS,
			'Four-valued query-operation input must be one exact plain-data object.'
		);
		if (record.values.get('schemaVersion') !== FOUR_VALUED_QUERY_OPERATION_REQUEST_SCHEMA_VERSION)
			throw new OperationRefusal(
				'REQUEST_SCHEMA_INCOMPATIBLE',
				'REQUEST',
				'incompatible',
				'$.schemaVersion is unsupported.',
				'$.schemaVersion'
			);
		if (record.values.get('operationVersion') !== FOUR_VALUED_QUERY_OPERATION_VERSION)
			throw new OperationRefusal(
				'REQUEST_OPERATION_INCOMPATIBLE',
				'REQUEST',
				'incompatible',
				'$.operationVersion is unsupported.',
				'$.operationVersion'
			);
		const budgets = materializeBudgets(record.values.get('budgets'));
		const admittedExecutionId = executionId(record.values.get('executionId'));
		const queryRecord = inspectExactRecord(
			record.values.get('query'),
			QUERY_KEYS,
			'$.query must be one exact plain-data object.'
		);
		const query = Object.freeze({
			id: queryText(queryRecord.values.get('id'), '$.query.id', MAX_EXECUTION_ID_CHARACTERS),
			purpose: queryText(
				queryRecord.values.get('purpose'),
				'$.query.purpose',
				MAX_QUERY_PURPOSE_CHARACTERS
			),
			version: queryText(
				queryRecord.values.get('version'),
				'$.query.version',
				MAX_EXECUTION_ID_CHARACTERS
			)
		});
		const modeValue = record.values.get('mode');
		if (typeof modeValue !== 'string' || !MODES.has(modeValue as FourValuedEvaluationMode))
			throw new OperationRefusal(
				'REQUEST_MODE_INVALID',
				'REQUEST',
				'incompatible',
				'$.mode must be EAGER or SHORT_CIRCUIT.',
				'$.mode'
			);
		const mode = modeValue as FourValuedEvaluationMode;
		const evaluationOutcome = evaluateFourValuedExpression({
			budgets: budgets.evaluation,
			expression: record.values.get('expression'),
			mode
		});
		if (evaluationOutcome.state === 'REFUSED') {
			const diagnostic = algebraDiagnostic(evaluationOutcome.diagnostic);
			return refusal(
				diagnostic,
				evaluationOutcome.diagnostic.code === 'AST_BUDGET_EXCEEDED' ||
					evaluationOutcome.diagnostic.code === 'EVALUATION_BUDGET_EXCEEDED'
					? 'resource-refused'
					: evaluationOutcome.diagnostic.code === 'INTERNAL_EVALUATION_FAILED'
						? 'failed'
						: 'incompatible'
			);
		}
		const evaluation = evaluationOutcome.evaluation;
		const request: ValidatedFourValuedQueryOperationRequest = Object.freeze({
			budgets,
			executionId: admittedExecutionId,
			expressionNodeCount: evaluation.expression.nodeCount,
			expressionRootNodeId: evaluation.expression.rootNodeId,
			mode,
			operationVersion: FOUR_VALUED_QUERY_OPERATION_VERSION,
			query,
			schemaVersion: FOUR_VALUED_QUERY_OPERATION_REQUEST_SCHEMA_VERSION
		});
		return deepFreezeConstructed({ evaluation, request, state: 'VALIDATED' as const });
	} catch (error) {
		if (error instanceof OperationRefusal)
			return refusal(operationDiagnostic(error), error.failureState);
		return refusal(
			{
				algebraCode: null,
				code: 'REQUEST_INSPECTION_FAILED',
				message: 'The query-operation request could not be inspected safely.',
				path: null,
				source: 'OPERATION',
				stage: 'REQUEST'
			},
			'failed'
		);
	}
}

function explanationAccounting(
	evaluation: FourValuedExpressionEvaluation
): FourValuedQueryExplanationAccounting {
	let declaredChildReferences = 0;
	let declaredQuantifierNodes = 0;
	for (const node of evaluation.expression.nodes) {
		declaredChildReferences += node.childNodeIds.length;
		if (node.kind === 'ALL' || node.kind === 'ANY') declaredQuantifierNodes += 1;
	}
	let emptyEvaluatedQuantifierNodes = 0;
	let evaluatedChildReferences = 0;
	let evaluatedNodes = 0;
	let evaluatedQuantifierNodes = 0;
	let inputTruthContributions = 0;
	let intermediateTruthSteps = 0;
	let shortCircuitedImmediateChildReferences = 0;
	let shortCircuitedNodes = 0;
	let shortCircuitedQuantifierNodes = 0;
	let unevaluatedDescendantChildReferences = 0;
	let unknownBoundaryApplications = 0;
	for (const traceNode of evaluation.trace) {
		const normalizedNode = evaluation.expression.nodes[traceNode.ordinal]!;
		if (traceNode.disposition === 'SHORT_CIRCUITED') {
			shortCircuitedNodes += 1;
			unevaluatedDescendantChildReferences += normalizedNode.childNodeIds.length;
			if (traceNode.kind === 'ALL' || traceNode.kind === 'ANY') shortCircuitedQuantifierNodes += 1;
			continue;
		}
		evaluatedNodes += 1;
		evaluatedChildReferences += traceNode.evaluatedChildNodeIds.length;
		shortCircuitedImmediateChildReferences += traceNode.skippedChildNodeIds.length;
		inputTruthContributions += traceNode.inputTruths.length;
		intermediateTruthSteps += traceNode.intermediateTruths.length;
		if (traceNode.quantifierBoundary !== null) {
			evaluatedQuantifierNodes += 1;
			if (traceNode.quantifierBoundary.emptyPopulation) emptyEvaluatedQuantifierNodes += 1;
			if (traceNode.quantifierBoundary.appliedUnknownBoundary) unknownBoundaryApplications += 1;
		}
	}
	const accountedChildReferences =
		evaluatedChildReferences +
		shortCircuitedImmediateChildReferences +
		unevaluatedDescendantChildReferences;
	return {
		allDeclaredChildReferencesAccounted: accountedChildReferences === declaredChildReferences,
		declaredChildReferences,
		declaredQuantifierNodes,
		dispositionCountsReconcile: evaluatedNodes + shortCircuitedNodes === evaluation.trace.length,
		emptyEvaluatedQuantifierNodes,
		evaluatedChildReferences,
		evaluatedNodes,
		evaluatedQuantifierNodes,
		inputTruthContributions,
		intermediateTruthSteps,
		normalizedNodes: evaluation.expression.nodeCount,
		ordinalSequenceExact: evaluation.trace.every((node, ordinal) => node.ordinal === ordinal),
		shortCircuitedImmediateChildReferences,
		shortCircuitedNodes,
		shortCircuitedQuantifierNodes,
		traceNodes: evaluation.trace.length,
		traceNodeTotal:
			evaluation.coverage.nodeTotalTrace &&
			evaluation.trace.length === evaluation.expression.nodeCount,
		unevaluatedDescendantChildReferences,
		unknownBoundaryApplications
	};
}

function unavailable(
	code: string,
	stage: FourValuedQueryOperationStage,
	state: FourValuedQueryOperationFailureState,
	diagnostic: FourValuedQueryOperationDiagnostic,
	request?: ValidatedFourValuedQueryOperationRequest
): FourValuedQueryOperationUnavailableOutcome {
	const compact: FourValuedQueryOperationUnavailableOutcome = {
		analysisAuthority: FOUR_VALUED_QUERY_OPERATION_ANALYSIS_AUTHORITY,
		authorityTransfer: FOUR_VALUED_QUERY_OPERATION_AUTHORITY_TRANSFER,
		capabilityStatus: FOUR_VALUED_QUERY_OPERATION_CAPABILITY_STATUS,
		code,
		diagnostics: [diagnostic],
		facadeNonclaims: FOUR_VALUED_QUERY_OPERATION_NONCLAIMS,
		gateEffect: FOUR_VALUED_QUERY_OPERATION_GATE_EFFECT,
		operationVersion: FOUR_VALUED_QUERY_OPERATION_VERSION,
		outcome: 'unavailable',
		schemaVersion: FOUR_VALUED_QUERY_OPERATION_SCHEMA_VERSION,
		stage,
		state
	};
	if (request !== undefined) {
		const expanded: FourValuedQueryOperationUnavailableOutcome = { ...compact, request };
		try {
			if (canonicalSemanticJsonWitness(expanded).bytes + 1 <= request.budgets.maxResultBytes)
				return deepFreezeConstructed(expanded);
		} catch {
			// The compact trusted envelope below is the deterministic terminal fallback.
		}
	}
	return deepFreezeConstructed(compact);
}

/** IMPLEMENTATION_LOCAL_UNREGISTERED literal truth-projection operation. */
export function runFourValuedQueryOperation(value: unknown): FourValuedQueryOperationOutcome {
	try {
		const validation = validateFourValuedQueryOperationRequest(value);
		if (validation.state === 'REFUSED')
			return unavailable(
				validation.diagnostic.code,
				validation.diagnostic.stage,
				validation.failureState,
				validation.diagnostic
			);
		const { request } = validation;
		const evaluation = detachTrustedEvaluation(validation.evaluation);
		if (evaluation.trace.length > request.budgets.maxExplanationRecords)
			return unavailable(
				'EXPLANATION_BUDGET_EXCEEDED',
				'EXPLANATION',
				'resource-refused',
				{
					algebraCode: null,
					code: 'EXPLANATION_BUDGET_EXCEEDED',
					message: 'The node-total explanation exceeds maxExplanationRecords.',
					path: '$.budgets.maxExplanationRecords',
					source: 'OPERATION',
					stage: 'EXPLANATION'
				},
				request
			);
		const accounting = explanationAccounting(evaluation);
		if (
			!accounting.traceNodeTotal ||
			!accounting.ordinalSequenceExact ||
			!accounting.dispositionCountsReconcile ||
			!accounting.allDeclaredChildReferencesAccounted ||
			accounting.declaredQuantifierNodes !==
				accounting.evaluatedQuantifierNodes + accounting.shortCircuitedQuantifierNodes
		)
			return unavailable(
				'EXPLANATION_ACCOUNTING_FAILED',
				'EXPLANATION',
				'failed',
				{
					algebraCode: null,
					code: 'EXPLANATION_ACCOUNTING_FAILED',
					message: 'The node-total explanation does not reconcile with the normalized expression.',
					path: null,
					source: 'OPERATION',
					stage: 'EXPLANATION'
				},
				request
			);
		const result: FourValuedQueryOperationResult = {
			capability: {
				fullJanCsaaCapability029SemanticQuery: 'NOT_CLAIMED',
				id: FOUR_VALUED_QUERY_OPERATION_CAPABILITY,
				registeredJanCsaa007Operation: 'NOT_CLAIMED',
				status: FOUR_VALUED_QUERY_OPERATION_CAPABILITY_STATUS
			},
			conclusion: evaluation.truth,
			currentness: 'NOT_ASSESSED_NO_SUBJECT_BOUND',
			evaluation,
			explanation: {
				accounting,
				policy: 'NODE_TOTAL_PREORDER_WITH_EXPLICIT_SHORT_CIRCUIT_DISPOSITIONS',
				resultByteAdmission: 'CANONICAL_JSON_PLUS_TERMINAL_LF_WITHIN_CALLER_BUDGET'
			},
			facadeNonclaims: FOUR_VALUED_QUERY_OPERATION_NONCLAIMS,
			query: {
				algebraVersion: FOUR_VALUED_QUERY_ALGEBRA_VERSION,
				executionId: request.executionId,
				mode: request.mode,
				populationBinding: 'CALLER_SUPPLIED_LITERAL_TRUTH_PROJECTIONS_ONLY',
				quantifierBoundaryBasis: 'CALLER_DECLARED_UNVERIFIED',
				queryId: request.query.id,
				queryPurpose: request.query.purpose,
				queryVersion: request.query.version,
				rootNodeId: request.expressionRootNodeId
			},
			schemaVersion: FOUR_VALUED_QUERY_OPERATION_RESULT_SCHEMA_VERSION
		};
		const report: FourValuedQueryOperationEvaluatedOutcome = {
			analysisAuthority: FOUR_VALUED_QUERY_OPERATION_ANALYSIS_AUTHORITY,
			authorityTransfer: FOUR_VALUED_QUERY_OPERATION_AUTHORITY_TRANSFER,
			capabilityStatus: FOUR_VALUED_QUERY_OPERATION_CAPABILITY_STATUS,
			diagnostics: [],
			gateEffect: FOUR_VALUED_QUERY_OPERATION_GATE_EFFECT,
			operationVersion: FOUR_VALUED_QUERY_OPERATION_VERSION,
			outcome: 'evaluated',
			request,
			result,
			schemaVersion: FOUR_VALUED_QUERY_OPERATION_SCHEMA_VERSION,
			state: 'evaluated'
		};
		let resultBytes: number;
		try {
			resultBytes = canonicalSemanticJsonWitness(report).bytes + 1;
		} catch {
			return unavailable(
				'RESULT_SERIALIZATION_FAILED',
				'RESULT',
				'failed',
				{
					algebraCode: null,
					code: 'RESULT_SERIALIZATION_FAILED',
					message: 'The query-operation result could not be serialized safely.',
					path: null,
					source: 'OPERATION',
					stage: 'RESULT'
				},
				request
			);
		}
		if (resultBytes > request.budgets.maxResultBytes)
			return unavailable(
				'RESULT_BUDGET_EXCEEDED',
				'RESULT',
				'resource-refused',
				{
					algebraCode: null,
					code: 'RESULT_BUDGET_EXCEEDED',
					message: 'The canonical query-operation result exceeds maxResultBytes.',
					path: '$.budgets.maxResultBytes',
					source: 'OPERATION',
					stage: 'RESULT'
				},
				request
			);
		return deepFreezeConstructed(report);
	} catch {
		return unavailable('INTERNAL_OPERATION_FAILURE', 'RESULT', 'failed', {
			algebraCode: null,
			code: 'INTERNAL_OPERATION_FAILURE',
			message: 'The four-valued query operation failed closed.',
			path: null,
			source: 'OPERATION',
			stage: 'RESULT'
		});
	}
}

const REPORT_VALIDATOR_MAX_CONTAINERS = 100_000;
const REPORT_VALIDATOR_MAX_DEPTH = 128;
const REPORT_VALIDATOR_MAX_SCALAR_CHARACTERS =
	FOUR_VALUED_QUERY_OPERATION_SAFETY_CEILINGS.maxResultBytes;

class ReportValidationError extends Error {}

function cloneClosedReportData(value: unknown): unknown {
	const seen = new WeakSet<object>();
	let containers = 0;
	let scalarCharacters = 0;

	function clone(candidate: unknown, depth: number): unknown {
		if (depth > REPORT_VALIDATOR_MAX_DEPTH)
			throw new ReportValidationError('Report data exceeds the validator depth ceiling.');
		if (candidate === null || typeof candidate === 'boolean') return candidate;
		if (typeof candidate === 'number') {
			if (!Number.isSafeInteger(candidate))
				throw new ReportValidationError('Report numbers must be safe integers.');
			return candidate;
		}
		if (typeof candidate === 'string') {
			if (!isUnicodeScalarString(candidate))
				throw new ReportValidationError('Report text must be Unicode scalar text.');
			scalarCharacters += candidate.length;
			if (scalarCharacters > REPORT_VALIDATOR_MAX_SCALAR_CHARACTERS)
				throw new ReportValidationError('Report scalar text exceeds the validator ceiling.');
			return candidate;
		}
		if (typeof candidate !== 'object' || isProxy(candidate))
			throw new ReportValidationError('Report values must be closed plain data.');
		if (seen.has(candidate))
			throw new ReportValidationError('Report containers must have unique ownership.');
		seen.add(candidate);
		containers += 1;
		if (containers > REPORT_VALIDATOR_MAX_CONTAINERS)
			throw new ReportValidationError('Report containers exceed the validator ceiling.');

		if (Array.isArray(candidate)) {
			if (Reflect.getPrototypeOf(candidate) !== Array.prototype)
				throw new ReportValidationError('Report arrays must be plain arrays.');
			const lengthDescriptor = Reflect.getOwnPropertyDescriptor(candidate, 'length');
			if (
				lengthDescriptor === undefined ||
				!('value' in lengthDescriptor) ||
				typeof lengthDescriptor.value !== 'number' ||
				!Number.isSafeInteger(lengthDescriptor.value) ||
				lengthDescriptor.value < 0 ||
				lengthDescriptor.value > REPORT_VALIDATOR_MAX_CONTAINERS
			)
				throw new ReportValidationError('Report arrays must be bounded dense arrays.');
			const length = lengthDescriptor.value;
			const keys = Reflect.ownKeys(candidate);
			let denseExactKeys = keys.length === length + 1 && keys[length] === 'length';
			for (let index = 0; denseExactKeys && index < length; index += 1)
				if (keys[index] !== String(index)) denseExactKeys = false;
			if (!denseExactKeys)
				throw new ReportValidationError('Report arrays must be bounded dense arrays.');
			const result: unknown[] = [];
			for (let index = 0; index < length; index += 1) {
				const descriptor = Reflect.getOwnPropertyDescriptor(candidate, String(index));
				if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
					throw new ReportValidationError('Report arrays must contain data properties only.');
				result.push(clone(descriptor.value, depth + 1));
			}
			return result;
		}

		const prototype = Reflect.getPrototypeOf(candidate);
		if (prototype !== Object.prototype && prototype !== null)
			throw new ReportValidationError('Report records must be plain objects.');
		const keys = Reflect.ownKeys(candidate);
		if (keys.some((key) => typeof key !== 'string'))
			throw new ReportValidationError('Report records cannot contain symbol properties.');
		const stringKeys = keys as string[];
		const result: Record<string, unknown> = {};
		for (const key of stringKeys) {
			if (!isUnicodeScalarString(key))
				throw new ReportValidationError('Report property names must be Unicode scalar text.');
			scalarCharacters += key.length;
			if (scalarCharacters > REPORT_VALIDATOR_MAX_SCALAR_CHARACTERS)
				throw new ReportValidationError('Report scalar text exceeds the validator ceiling.');
			const descriptor = Reflect.getOwnPropertyDescriptor(candidate, key);
			if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
				throw new ReportValidationError('Report records must contain data properties only.');
			Object.defineProperty(result, key, {
				configurable: true,
				enumerable: true,
				value: clone(descriptor.value, depth + 1),
				writable: true
			});
		}
		return result;
	}

	return clone(value, 1);
}

function exactReportRecord(
	value: unknown,
	expectedKeys: readonly string[]
): Readonly<Record<string, unknown>> {
	if (value === null || typeof value !== 'object' || Array.isArray(value))
		throw new ReportValidationError('Report shape is invalid.');
	const record = value as Record<string, unknown>;
	const keys = Object.keys(record);
	if (
		keys.length !== expectedKeys.length ||
		expectedKeys.some((key) => !Object.prototype.hasOwnProperty.call(record, key))
	)
		throw new ReportValidationError('Report shape is invalid.');
	return record;
}

function reportStringArray(value: unknown): readonly string[] {
	if (
		!Array.isArray(value) ||
		value.length > FOUR_VALUED_QUERY_SAFETY_CEILINGS.maxFanout ||
		value.some((entry) => typeof entry !== 'string')
	)
		throw new ReportValidationError('Normalized child identities are invalid.');
	return value;
}

interface ReportExpressionNode {
	readonly children: readonly string[];
	readonly record: Readonly<Record<string, unknown>>;
}

interface ReportExpressionBuildFrame {
	readonly depth: number;
	readonly nodeId: string;
	nextChildIndex: number;
}

function expressionFromEvaluatedReport(
	report: Readonly<Record<string, unknown>>
): FourValuedExpression {
	const result = exactReportRecord(report.result, [
		'capability',
		'conclusion',
		'currentness',
		'evaluation',
		'explanation',
		'facadeNonclaims',
		'query',
		'schemaVersion'
	]);
	const evaluation = exactReportRecord(result.evaluation, [
		'algebraVersion',
		'coverage',
		'evidencePair',
		'expression',
		'mode',
		'trace',
		'truth'
	]);
	const normalized = exactReportRecord(evaluation.expression, [
		'maxObservedDepth',
		'maxObservedFanout',
		'nodeCount',
		'nodes',
		'rootNodeId'
	]);
	if (
		!Array.isArray(normalized.nodes) ||
		normalized.nodes.length === 0 ||
		normalized.nodes.length > FOUR_VALUED_QUERY_SAFETY_CEILINGS.maxNodes ||
		typeof normalized.rootNodeId !== 'string'
	)
		throw new ReportValidationError('Normalized expression shape is invalid.');
	const nodes = new Map<string, ReportExpressionNode>();
	let declaredChildReferences = 0;
	for (const candidate of normalized.nodes) {
		if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate))
			throw new ReportValidationError('Normalized expression node shape is invalid.');
		const node = candidate as Readonly<Record<string, unknown>>;
		if (typeof node.nodeId !== 'string' || nodes.has(node.nodeId))
			throw new ReportValidationError('Normalized expression node identity is invalid.');
		const children = reportStringArray(node.childNodeIds);
		declaredChildReferences += children.length;
		if (declaredChildReferences > normalized.nodes.length - 1)
			throw new ReportValidationError('Normalized expression ownership is invalid.');
		nodes.set(node.nodeId, { children, record: node });
	}
	const active = new Set<string>();
	const built = new Map<string, FourValuedExpression>();
	const stack: ReportExpressionBuildFrame[] = [
		{ depth: 1, nextChildIndex: 0, nodeId: normalized.rootNodeId }
	];
	active.add(normalized.rootNodeId);
	while (stack.length > 0) {
		const frame = stack[stack.length - 1]!;
		if (frame.depth > FOUR_VALUED_QUERY_SAFETY_CEILINGS.maxDepth)
			throw new ReportValidationError('Normalized expression depth exceeds the safety ceiling.');
		const reportNode = nodes.get(frame.nodeId);
		if (reportNode === undefined)
			throw new ReportValidationError('Normalized expression ownership is invalid.');
		if (frame.nextChildIndex < reportNode.children.length) {
			const childNodeId = reportNode.children[frame.nextChildIndex]!;
			frame.nextChildIndex += 1;
			if (active.has(childNodeId) || built.has(childNodeId) || !nodes.has(childNodeId))
				throw new ReportValidationError('Normalized expression ownership is invalid.');
			active.add(childNodeId);
			stack.push({ depth: frame.depth + 1, nextChildIndex: 0, nodeId: childNodeId });
			continue;
		}

		const node = reportNode.record;
		const childExpressions = reportNode.children.map((childNodeId) => {
			const child = built.get(childNodeId);
			if (child === undefined)
				throw new ReportValidationError('Normalized expression ownership is invalid.');
			return child;
		});
		let expression: FourValuedExpression;
		switch (node.kind) {
			case 'VALUE':
				if (childExpressions.length !== 0 || typeof node.truth !== 'string')
					throw new ReportValidationError('Normalized VALUE node is invalid.');
				expression = {
					kind: 'VALUE',
					nodeId: frame.nodeId,
					truth: node.truth as FourValuedTruth
				};
				break;
			case 'NOT':
				if (childExpressions.length !== 1)
					throw new ReportValidationError('Normalized NOT node is invalid.');
				expression = {
					kind: 'NOT',
					nodeId: frame.nodeId,
					operand: childExpressions[0]!
				};
				break;
			case 'AND':
			case 'OR': {
				if (childExpressions.length === 0)
					throw new ReportValidationError('Normalized logical node is invalid.');
				const operands = childExpressions as [FourValuedExpression, ...FourValuedExpression[]];
				expression =
					node.kind === 'AND'
						? { kind: 'AND', nodeId: frame.nodeId, operands }
						: { kind: 'OR', nodeId: frame.nodeId, operands };
				break;
			}
			case 'ALL':
			case 'ANY': {
				if (
					(node.closure !== 'CLOSED' && node.closure !== 'OPEN') ||
					(node.completeness !== 'COMPLETE' && node.completeness !== 'INCOMPLETE')
				)
					throw new ReportValidationError('Normalized quantifier boundary is invalid.');
				expression =
					node.kind === 'ALL'
						? {
								closure: node.closure,
								completeness: node.completeness,
								kind: 'ALL',
								members: childExpressions,
								nodeId: frame.nodeId
							}
						: {
								closure: node.closure,
								completeness: node.completeness,
								kind: 'ANY',
								members: childExpressions,
								nodeId: frame.nodeId
							};
				break;
			}
			default:
				throw new ReportValidationError('Normalized expression kind is invalid.');
		}
		active.delete(frame.nodeId);
		built.set(frame.nodeId, expression);
		stack.pop();
	}

	if (built.size !== nodes.size)
		throw new ReportValidationError('Normalized expression contains unreachable nodes.');
	const expression = built.get(normalized.rootNodeId);
	if (expression === undefined)
		throw new ReportValidationError('Normalized expression ownership is invalid.');
	return expression;
}

/**
 * IMPLEMENTATION_LOCAL_UNREGISTERED validator that re-evaluates an evaluated report and refuses
 * any closed-shape or material evidence drift.
 */
export function validateFourValuedQueryEvaluationReport(
	value: unknown
): FourValuedQueryEvaluationReportValidationOutcome {
	try {
		const cloned = cloneClosedReportData(value);
		const report = exactReportRecord(cloned, [
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
		]);
		if (
			report.outcome !== 'evaluated' ||
			report.state !== 'evaluated' ||
			report.analysisAuthority !== FOUR_VALUED_QUERY_OPERATION_ANALYSIS_AUTHORITY ||
			report.authorityTransfer !== FOUR_VALUED_QUERY_OPERATION_AUTHORITY_TRANSFER ||
			report.capabilityStatus !== FOUR_VALUED_QUERY_OPERATION_CAPABILITY_STATUS ||
			report.gateEffect !== FOUR_VALUED_QUERY_OPERATION_GATE_EFFECT ||
			report.operationVersion !== FOUR_VALUED_QUERY_OPERATION_VERSION ||
			report.schemaVersion !== FOUR_VALUED_QUERY_OPERATION_SCHEMA_VERSION ||
			!Array.isArray(report.diagnostics) ||
			report.diagnostics.length !== 0
		)
			throw new ReportValidationError('Evaluated report envelope is incompatible.');
		const request = exactReportRecord(report.request, [
			'budgets',
			'executionId',
			'expressionNodeCount',
			'expressionRootNodeId',
			'mode',
			'operationVersion',
			'query',
			'schemaVersion'
		]);
		const rawRequest: FourValuedQueryOperationRequest = {
			budgets: request.budgets as unknown as FourValuedQueryOperationBudgets,
			executionId: request.executionId as string,
			expression: expressionFromEvaluatedReport(report),
			mode: request.mode as FourValuedEvaluationMode,
			operationVersion: request.operationVersion as typeof FOUR_VALUED_QUERY_OPERATION_VERSION,
			query: request.query as FourValuedQueryOperationRequest['query'],
			schemaVersion:
				request.schemaVersion as typeof FOUR_VALUED_QUERY_OPERATION_REQUEST_SCHEMA_VERSION
		};
		const expected = runFourValuedQueryOperation(rawRequest);
		if (expected.outcome !== 'evaluated')
			throw new ReportValidationError('Embedded evaluated request cannot be reproduced.');
		if (canonicalSemanticJson(expected) !== canonicalSemanticJson(cloned))
			throw new ReportValidationError('Evaluated report content does not reproduce exactly.');
		return deepFreezeConstructed({
			report: cloned as FourValuedQueryOperationEvaluatedOutcome,
			state: 'VALID' as const
		});
	} catch {
		return deepFreezeConstructed({
			diagnostic: {
				algebraCode: null,
				code: 'EVALUATED_REPORT_INVALID',
				message: 'The four-valued query evaluation report is not an exact reproducible report.',
				path: null,
				source: 'OPERATION' as const,
				stage: 'RESULT' as const
			},
			state: 'INVALID' as const
		});
	}
}
