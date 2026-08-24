import type {
	SemanticCapabilityCoverage,
	SemanticConflict,
	SemanticEpistemicState,
	SemanticExecutionHealth,
	SemanticFreshness,
	SemanticInference,
	SemanticSourceRecord,
	SemanticSupportBasis
} from './semantic.js';

export const SEMANTIC_SOURCE_QUERY_OPERATION_VERSION =
	'jan-csaa-semantic-source-query-core/0.1.0' as const;
export const SEMANTIC_SOURCE_QUERY_ALGEBRA_VERSION =
	'jan-csaa-four-valued-evidence-pair/0.1.0' as const;
export const SEMANTIC_SOURCE_QUERY_CAPABILITY_STATUS = 'IMPLEMENTATION_LOCAL_UNREGISTERED' as const;
export const SEMANTIC_SOURCE_QUERY_EXECUTION_MODE = 'COMPLETE' as const;
export const SEMANTIC_SOURCE_QUERY_POPULATION = 'SEMANTIC_SOURCE' as const;

export const SEMANTIC_SOURCE_QUERY_NONCLAIMS = Object.freeze([
	'This implementation-local core is not registered JAN-CSAA-CAP-029.',
	'This core does not complete DWP-005 or expose the DWP-006 coding-agent interface.',
	'This core does not claim JAN-CSAA-007 or JAN-CSAA-008 conformance and does not activate an assurance gate.',
	'This core does not provide short-circuit evaluation, traversal, quantifiers, joins, aggregation, ordering, paging, dynamic evidence, or negative population closure.',
	'Query identities, snapshot binding, access control, currentness, cancellation, time limits, result persistence, and output-byte accounting remain facade responsibilities.'
] as const);

export const SEMANTIC_SOURCE_QUERY_FIELDS = Object.freeze([
	'analysisDisposition',
	'artifactClass',
	'declarationFile',
	'id',
	'languageVariant',
	'logicalPath',
	'moduleKind',
	'origin',
	'programId',
	'projectId',
	'provenanceId',
	'rootFile',
	'scriptKindName'
] as const);

export type SemanticSourceQueryField = (typeof SEMANTIC_SOURCE_QUERY_FIELDS)[number];
export type SemanticSourceQueryScalarValues = Pick<SemanticSourceRecord, SemanticSourceQueryField>;

export type SemanticSourceQueryEqualityExpression = {
	readonly [Field in SemanticSourceQueryField]: {
		readonly field: Field;
		readonly kind: 'EQUALS';
		readonly nodeId: string;
		readonly value: SemanticSourceQueryScalarValues[Field];
	};
}[SemanticSourceQueryField];

export interface SemanticSourceQueryNotExpression {
	readonly kind: 'NOT';
	readonly nodeId: string;
	readonly operand: SemanticSourceQueryExpression;
}

export interface SemanticSourceQueryAndExpression {
	readonly kind: 'AND';
	readonly nodeId: string;
	readonly operands: readonly [SemanticSourceQueryExpression, ...SemanticSourceQueryExpression[]];
}

export interface SemanticSourceQueryOrExpression {
	readonly kind: 'OR';
	readonly nodeId: string;
	readonly operands: readonly [SemanticSourceQueryExpression, ...SemanticSourceQueryExpression[]];
}

export type SemanticSourceQueryExpression =
	| SemanticSourceQueryEqualityExpression
	| SemanticSourceQueryNotExpression
	| SemanticSourceQueryAndExpression
	| SemanticSourceQueryOrExpression;

export type SemanticQueryTruth = 'T' | 'F' | 'U' | 'C';
export type SemanticQuerySupportBit = 0 | 1;

export interface SemanticQueryEvidencePair {
	readonly falseSupport: SemanticQuerySupportBit;
	readonly trueSupport: SemanticQuerySupportBit;
}

export interface SemanticQueryApplicability {
	readonly applicabilityBasis: readonly string[];
	readonly rationale: string;
	readonly reasonCode: string;
	readonly semanticOwnerRef: string;
}

export interface SemanticQueryApplicableProjection {
	readonly disposition: 'applicable-result';
	readonly evidencePair: SemanticQueryEvidencePair;
	readonly truth: SemanticQueryTruth;
}

export interface SemanticQueryNotApplicableProjection {
	readonly applicability: SemanticQueryApplicability;
	readonly disposition: 'not-applicable';
}

export type SemanticQueryProjection =
	SemanticQueryApplicableProjection | SemanticQueryNotApplicableProjection;

export const SEMANTIC_SOURCE_QUERY_SAFETY_CEILINGS = Object.freeze({
	maxDepth: 8,
	maxEvaluations: 1_000_000,
	maxFanout: 16,
	maxNodes: 64,
	maxPopulation: 100_000,
	maxTraceNodes: 1_000_000
} as const);

export interface SemanticSourceQueryBudgets {
	readonly maxDepth: number;
	readonly maxEvaluations: number;
	readonly maxFanout: number;
	readonly maxNodes: number;
	readonly maxPopulation: number;
	readonly maxTraceNodes: number;
}

export type SemanticSourceQueryRecord = Readonly<
	Pick<SemanticSourceRecord, SemanticSourceQueryField>
>;

interface SemanticSourceQueryNormalizedNodeBase {
	readonly childNodeIds: readonly string[];
	readonly depth: number;
	readonly nodeId: string;
	readonly ordinal: number;
}

export type SemanticSourceQueryNormalizedEqualityNode = {
	readonly [Field in SemanticSourceQueryField]: SemanticSourceQueryNormalizedNodeBase & {
		readonly childNodeIds: readonly [];
		readonly field: Field;
		readonly kind: 'EQUALS';
		readonly value: SemanticSourceQueryScalarValues[Field];
	};
}[SemanticSourceQueryField];

export interface SemanticSourceQueryNormalizedNotNode extends SemanticSourceQueryNormalizedNodeBase {
	readonly childNodeIds: readonly [string];
	readonly kind: 'NOT';
}

export interface SemanticSourceQueryNormalizedAndNode extends SemanticSourceQueryNormalizedNodeBase {
	readonly childNodeIds: readonly [string, ...string[]];
	readonly kind: 'AND';
}

export interface SemanticSourceQueryNormalizedOrNode extends SemanticSourceQueryNormalizedNodeBase {
	readonly childNodeIds: readonly [string, ...string[]];
	readonly kind: 'OR';
}

export type SemanticSourceQueryNormalizedNode =
	| SemanticSourceQueryNormalizedEqualityNode
	| SemanticSourceQueryNormalizedNotNode
	| SemanticSourceQueryNormalizedAndNode
	| SemanticSourceQueryNormalizedOrNode;

export interface SemanticSourceQueryNormalizedExpression {
	readonly maxObservedDepth: number;
	readonly maxObservedFanout: number;
	readonly nodeCount: number;
	readonly nodes: readonly SemanticSourceQueryNormalizedNode[];
	readonly rootNodeId: string;
}

export interface SemanticSourceQueryEpistemicDimensionContributions {
	readonly capabilityCoverage: readonly SemanticCapabilityCoverage[];
	readonly conflict: readonly SemanticConflict[];
	readonly executionHealth: readonly SemanticExecutionHealth[];
	readonly freshness: readonly SemanticFreshness[];
	readonly inference: readonly SemanticInference[];
	readonly supportBasis: readonly SemanticSupportBasis[];
}

export interface SemanticSourceQueryEpistemicTrace {
	readonly contributions: SemanticSourceQueryEpistemicDimensionContributions;
	readonly effective: SemanticEpistemicState;
}

export interface SemanticSourceQueryApplicableLeafEvaluation {
	readonly disposition: 'applicable-result';
	readonly epistemic: SemanticEpistemicState;
	readonly evidencePair: SemanticQueryEvidencePair;
	readonly evidenceRefs: readonly string[];
}

export interface SemanticSourceQueryNotApplicableLeafEvaluation {
	readonly applicability: SemanticQueryApplicability;
	readonly disposition: 'not-applicable';
}

export type SemanticSourceQueryLeafEvaluation =
	SemanticSourceQueryApplicableLeafEvaluation | SemanticSourceQueryNotApplicableLeafEvaluation;

export interface SemanticSourceQueryLeafContext {
	readonly expression: SemanticSourceQueryNormalizedEqualityNode;
	readonly record: SemanticSourceQueryRecord;
}

export type SemanticSourceQueryLeafEvaluator = (
	context: SemanticSourceQueryLeafContext
) => SemanticSourceQueryLeafEvaluation;

export interface SemanticSourceQueryApplicableChildContribution {
	readonly disposition: 'applicable-result';
	readonly epistemic: SemanticEpistemicState;
	readonly evidencePair: SemanticQueryEvidencePair;
	readonly evidenceRefs: readonly string[];
	readonly nodeId: string;
	readonly truth: SemanticQueryTruth;
}

export interface SemanticSourceQueryNotApplicableChildContribution {
	readonly applicability: SemanticQueryApplicability;
	readonly disposition: 'not-applicable';
	readonly nodeId: string;
}

export type SemanticSourceQueryChildContribution =
	| SemanticSourceQueryApplicableChildContribution
	| SemanticSourceQueryNotApplicableChildContribution;

interface SemanticSourceQueryTraceNodeBase {
	readonly childContributions: readonly SemanticSourceQueryChildContribution[];
	readonly childNodeIds: readonly string[];
	readonly compositionRuleVersion: typeof SEMANTIC_SOURCE_QUERY_ALGEBRA_VERSION;
	readonly kind: SemanticSourceQueryNormalizedNode['kind'];
	readonly nodeId: string;
	readonly ordinal: number;
}

export interface SemanticSourceQueryApplicableTraceNode extends SemanticSourceQueryTraceNodeBase {
	readonly disposition: 'applicable-result';
	readonly epistemic: SemanticSourceQueryEpistemicTrace;
	readonly evidencePair: SemanticQueryEvidencePair;
	readonly evidenceRefs: readonly string[];
	readonly truth: SemanticQueryTruth;
}

export interface SemanticSourceQueryNotApplicableTraceNode extends SemanticSourceQueryTraceNodeBase {
	readonly applicability: SemanticQueryApplicability;
	readonly disposition: 'not-applicable';
}

export type SemanticSourceQueryTraceNode =
	SemanticSourceQueryApplicableTraceNode | SemanticSourceQueryNotApplicableTraceNode;

export interface SemanticSourceQueryApplicableRecordResult {
	readonly disposition: 'applicable-result';
	readonly epistemic: SemanticSourceQueryEpistemicTrace;
	readonly evidencePair: SemanticQueryEvidencePair;
	readonly evidenceRefs: readonly string[];
	readonly sourceId: SemanticSourceRecord['id'];
	readonly trace: readonly SemanticSourceQueryTraceNode[];
	readonly truth: SemanticQueryTruth;
}

export interface SemanticSourceQueryNotApplicableRecordResult {
	readonly applicability: SemanticQueryApplicability;
	readonly disposition: 'not-applicable';
	readonly sourceId: SemanticSourceRecord['id'];
	readonly trace: readonly SemanticSourceQueryTraceNode[];
}

export type SemanticSourceQueryRecordResult =
	SemanticSourceQueryApplicableRecordResult | SemanticSourceQueryNotApplicableRecordResult;

export interface SemanticSourceQueryEvaluationCounts {
	readonly conflicting: number;
	readonly notApplicable: number;
	readonly supportedFalse: number;
	readonly supportedTrue: number;
	readonly unknown: number;
}

export interface SemanticSourceQueryEvaluationCoverage {
	readonly chargedEvaluations: number;
	readonly counts: SemanticSourceQueryEvaluationCounts;
	readonly partitionsReconcile: boolean;
	readonly populationRecords: number;
	readonly traceNodes: number;
}

export interface SemanticSourceQueryEvaluation {
	readonly capabilityStatus: typeof SEMANTIC_SOURCE_QUERY_CAPABILITY_STATUS;
	readonly coverage: SemanticSourceQueryEvaluationCoverage;
	readonly expression: SemanticSourceQueryNormalizedExpression;
	readonly mode: typeof SEMANTIC_SOURCE_QUERY_EXECUTION_MODE;
	readonly nonclaims: typeof SEMANTIC_SOURCE_QUERY_NONCLAIMS;
	readonly operationVersion: typeof SEMANTIC_SOURCE_QUERY_OPERATION_VERSION;
	readonly population: typeof SEMANTIC_SOURCE_QUERY_POPULATION;
	readonly recordResults: readonly SemanticSourceQueryRecordResult[];
}

export type SemanticSourceQueryDiagnosticCode =
	| 'AST_BUDGET_EXCEEDED'
	| 'AST_INVALID'
	| 'EVALUATION_BUDGET_EXCEEDED'
	| 'INPUT_INVALID'
	| 'LEAF_EVALUATION_FAILED'
	| 'POPULATION_BUDGET_EXCEEDED'
	| 'POPULATION_INVALID';

export interface SemanticSourceQueryDiagnostic {
	readonly code: SemanticSourceQueryDiagnosticCode;
	readonly message: string;
	readonly phase: 'REQUEST' | 'VALIDATE_AST' | 'VALIDATE_POPULATION' | 'EVALUATE';
}

export type SemanticSourceQueryEvaluationOutcome =
	| {
			readonly evaluation: SemanticSourceQueryEvaluation;
			readonly state: 'EVALUATED';
	  }
	| {
			readonly diagnostic: SemanticSourceQueryDiagnostic;
			readonly state: 'REFUSED';
	  };

export interface EvaluateSemanticSourceQueryInput {
	readonly budgets: SemanticSourceQueryBudgets;
	readonly evaluateLeaf?: SemanticSourceQueryLeafEvaluator;
	readonly expression: SemanticSourceQueryExpression;
	readonly mode: typeof SEMANTIC_SOURCE_QUERY_EXECUTION_MODE;
	readonly records: readonly SemanticSourceRecord[];
}
