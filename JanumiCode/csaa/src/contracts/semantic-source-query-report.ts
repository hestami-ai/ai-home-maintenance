import type {
	SemanticEpistemicState,
	SemanticLimitation,
	SemanticSnapshotId,
	SemanticSourceId,
	SemanticSourceRecord
} from './semantic.js';
import {
	SEMANTIC_SOURCE_QUERY_CAPABILITY_STATUS,
	SEMANTIC_SOURCE_QUERY_NONCLAIMS,
	SEMANTIC_SOURCE_QUERY_OPERATION_VERSION,
	SEMANTIC_SOURCE_QUERY_OPERATORS,
	SEMANTIC_SOURCE_QUERY_SAFETY_CEILINGS,
	type SemanticSourceQueryBudgets,
	type SemanticSourceQueryExpression,
	type SemanticSourceQueryField,
	type SemanticSourceQueryNormalizedExpression,
	type SemanticSourceQueryRecordResult
} from './semantic-source-query.js';
import type { SubjectBudgets, SubjectCompleteness, SubjectDescriptor } from './subject.js';
import type { SemanticBudgets } from './semantic.js';
import { PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS } from './project-context-report.js';

/**
 * Preliminary implementation-local facade over one fixed SEMANTIC_SOURCE population and exact
 * four-valued equality/logical-path-prefix expression core. It is deliberately not a registered query operation or
 * evidence that CAP-029, DWP-005, DWP-006, or G5 is complete.
 */
export const SEMANTIC_SOURCE_QUERY_REPORT_REQUEST_SCHEMA_VERSION =
	'jan-csaa-semantic-source-query-report-request/0.2.0' as const;
export const SEMANTIC_SOURCE_QUERY_REPORT_SCHEMA_VERSION =
	'jan-csaa-semantic-source-query-report/0.2.0' as const;
export const SEMANTIC_SOURCE_QUERY_REPORT_RESULT_SCHEMA_VERSION =
	'jan-csaa-semantic-source-query-report-result/0.2.0' as const;
export const SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION =
	'jan-csaa-report-semantic-source-query/0.2.0' as const;
export const SEMANTIC_SOURCE_QUERY_REPORT_AUTHORITY = 'NONE' as const;
export const SEMANTIC_SOURCE_QUERY_REPORT_AUTHORITY_TRANSFER = 'NONE' as const;
export const SEMANTIC_SOURCE_QUERY_REPORT_GATE_EFFECT = 'NONE' as const;
export const SEMANTIC_SOURCE_QUERY_REPORT_CAPABILITY =
	'IMPLEMENTATION_LOCAL_SEMANTIC_SOURCE_QUERY' as const;
export const SEMANTIC_SOURCE_QUERY_REPORT_CAPABILITY_STATUS =
	SEMANTIC_SOURCE_QUERY_CAPABILITY_STATUS;
export const SEMANTIC_SOURCE_QUERY_REPORT_MAX_EXECUTION_ID_CHARACTERS = 256 as const;

export const SEMANTIC_SOURCE_QUERY_REPORT_NONCLAIMS = Object.freeze([
	'FULL_JAN_CSAA_CAP_029_SEMANTIC_QUERY',
	'DWP_005_OR_DWP_006_COMPLETION',
	'G5_OR_ANY_OTHER_GATE_PASS_OR_ACTIVATION',
	'JAN_CSAA_007_REGISTERED_OPERATION_OR_OPERATION_RESPONSE_ENVELOPE',
	'FULL_JAN_CSAA_007_008_009_010_OR_011_CONFORMANCE',
	'RULE_FINDING_SEVERITY_GATE_REMEDIATION_OR_DISPOSITION_AUTHORITY',
	'QUERY_FORMS_BEYOND_FIXED_SEMANTIC_SOURCE_EQUALITY_LOGICAL_PATH_PREFIX_NOT_AND_OR',
	'PATH_NORMALIZATION_GLOB_REGULAR_EXPRESSION_OR_PATH_SEGMENT_INFERENCE',
	'SHORT_CIRCUIT_EVALUATION',
	'QUANTIFICATION_TRAVERSAL_JOIN_AGGREGATION_ORDERING_OR_PAGING',
	'GRAPH_SLICE_CHANGE_IMPACT_OR_SEMANTIC_COMPARISON',
	'DYNAMIC_RUNTIME_TEST_TRACE_OR_COVERAGE_EVIDENCE',
	'WHOLE_REPOSITORY_WHOLE_PROGRAM_OR_RUNTIME_POPULATION_CLOSURE',
	'NEGATIVE_POPULATION_CLOSURE_OR_GLOBAL_ABSENCE',
	'ACCESS_CONTROL_PERSISTENCE_CANCELLATION_OR_CROSS_REVISION_CURRENTNESS',
	'PROVIDER_QUALIFICATION_OR_ORACLE_CONFERRAL'
] as const);

export interface SemanticSourceQueryReportBudgets {
	/** Maximum diagnostics retained in a successful result; overflow is refused, never truncated. */
	readonly maxDiagnostics: number;
	/** Maximum report records after accounting for evaluations, traces, partitions, and limitations. */
	readonly maxResultRecords: number;
	/** Maximum canonical report bytes including the command terminal LF. */
	readonly maxResultBytes: number;
	readonly query: SemanticSourceQueryBudgets;
	readonly semantic: SemanticBudgets;
	readonly subject: SubjectBudgets;
}

/** Absolute admission ceilings, never caller defaults, completeness promises, or SLOs. */
export const SEMANTIC_SOURCE_QUERY_REPORT_SAFETY_CEILINGS = Object.freeze({
	maxDiagnostics: 100_000,
	maxResultBytes: 128 * 1024 * 1024,
	maxResultRecords: 3_000_000,
	query: Object.freeze({ ...SEMANTIC_SOURCE_QUERY_SAFETY_CEILINGS }),
	semantic: Object.freeze({ ...PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS.semantic }),
	subject: Object.freeze({ ...PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS.subject })
} satisfies SemanticSourceQueryReportBudgets);

export interface SemanticSourceQueryReportRequest {
	readonly budgets: SemanticSourceQueryReportBudgets;
	/** Caller-owned occurrence discriminator; a distinct execution requires a distinct value. */
	readonly executionId: string;
	readonly expression: SemanticSourceQueryExpression;
	readonly operationVersion: typeof SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION;
	readonly schemaVersion: typeof SEMANTIC_SOURCE_QUERY_REPORT_REQUEST_SCHEMA_VERSION;
	/** Explicit bounded semantic closure; no workspace project is inferred silently. */
	readonly subjectProjectConfigPaths: readonly string[];
}

export type SemanticSourceQueryReportStage =
	'REQUEST' | 'QUERY_VALIDATE' | 'SEMANTIC_CAPTURE' | 'QUERY_EVALUATE' | 'CURRENTNESS' | 'RESULT';

export interface SemanticSourceQueryReportDiagnostic {
	readonly code: string;
	readonly message: string;
	readonly path: string | null;
	readonly phase: string | null;
	readonly severity: 'INFO' | 'WARNING' | 'ERROR' | null;
	readonly source: 'REPORT' | 'SEMANTIC_CAPTURE' | 'QUERY_ENGINE' | 'CURRENTNESS';
}

export interface SemanticSourceQueryReportStageOutcomes {
	readonly currentness: {
		readonly diagnosticCodes: readonly string[];
		readonly state: 'CURRENT_FOR_CAPTURED_SUBJECT' | 'STALE' | 'UNAVAILABLE';
	};
	readonly queryEvaluation: {
		readonly diagnosticCodes: readonly string[];
		readonly mode: 'COMPLETE';
		readonly outcome: 'evaluated';
	};
	readonly queryValidation: {
		readonly diagnosticCodes: readonly string[];
		readonly outcome: 'validated';
	};
	readonly semanticCapture: {
		readonly diagnosticCodes: readonly string[];
		readonly semanticHealth: 'COMPLETE' | 'PARTIAL';
		readonly subjectCompleteness: SubjectCompleteness;
		readonly outcome: 'captured';
	};
}

/** Compact safe source witness; source text, absolute locators, and compiler-native objects are omitted. */
export interface SemanticSourceQueryReportSourceReference {
	readonly analysisDisposition: SemanticSourceRecord['analysisDisposition'];
	readonly artifactClass: SemanticSourceRecord['artifactClass'];
	readonly declarationFile: SemanticSourceRecord['declarationFile'];
	readonly id: SemanticSourceRecord['id'];
	readonly languageVariant: SemanticSourceRecord['languageVariant'];
	readonly logicalPath: SemanticSourceRecord['logicalPath'];
	readonly moduleKind: SemanticSourceRecord['moduleKind'];
	readonly origin: SemanticSourceRecord['origin'];
	readonly programId: SemanticSourceRecord['programId'];
	readonly projectConfigPath: string;
	readonly projectId: SemanticSourceRecord['projectId'];
	readonly provenanceId: SemanticSourceRecord['provenanceId'];
	readonly rootFile: SemanticSourceRecord['rootFile'];
	readonly scriptKindName: SemanticSourceRecord['scriptKindName'];
}

export interface SemanticSourceQueryReportRecordEvaluation {
	readonly query: SemanticSourceQueryRecordResult;
	readonly source: SemanticSourceQueryReportSourceReference;
}

export interface SemanticSourceQueryReportPartitions {
	readonly conflict: readonly SemanticSourceId[];
	readonly notApplicable: readonly SemanticSourceId[];
	readonly supportedMatches: readonly SemanticSourceId[];
	readonly supportedNonmatches: readonly SemanticSourceId[];
	readonly unevaluated: readonly SemanticSourceId[];
	readonly unknown: readonly SemanticSourceId[];
}

export interface SemanticSourceQueryReportDefinition {
	readonly access: 'CAPTURED_STATIC_SEMANTIC_SOURCE_METADATA_ONLY';
	readonly budgets: SemanticSourceQueryBudgets;
	readonly evaluationMode: 'COMPLETE';
	readonly explanationPolicy: 'NODE_TOTAL_PREORDER_TRACE_PER_RETAINED_SOURCE';
	readonly expression: SemanticSourceQueryNormalizedExpression;
	readonly id: string;
	readonly operationVersion: typeof SEMANTIC_SOURCE_QUERY_OPERATION_VERSION;
	readonly ordering: 'STATIC_SEMANTIC_SNAPSHOT_SOURCE_ORDER';
	readonly population: 'SEMANTIC_SOURCE';
	readonly prerequisiteCapabilities: readonly ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'];
	readonly purpose: 'BOUNDED_STATIC_SOURCE_METADATA_SCALAR_FILTER';
	readonly registeredFields: readonly SemanticSourceQueryField[];
	readonly registeredOperators: typeof SEMANTIC_SOURCE_QUERY_OPERATORS;
	readonly version: '0.2.0';
}

export interface SemanticSourceQueryReportReference {
	readonly captureBudgets: {
		readonly semantic: SemanticBudgets;
		readonly subject: SubjectBudgets;
	};
	readonly definitionId: string;
	readonly id: string;
	readonly subjectProjectConfigPaths: readonly string[];
}

export interface SemanticSourceQueryReportBinding {
	readonly definitionId: string;
	readonly id: string;
	readonly referenceId: string;
	readonly retainedSourceRecords: number;
	readonly semanticHealth: 'COMPLETE' | 'PARTIAL';
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
}

export interface SemanticSourceQueryReportResultOccurrence {
	readonly bindingId: string;
	readonly executionId: string;
	readonly id: string;
	readonly partitionCounts: {
		readonly conflict: number;
		readonly notApplicable: number;
		readonly supportedMatches: number;
		readonly supportedNonmatches: number;
		readonly unevaluated: number;
		readonly unknown: number;
	};
}

export interface SemanticSourceQueryReportExplanation {
	readonly evaluatedRecords: number;
	readonly id: string;
	readonly nodeTotal: true;
	readonly policy: 'NODE_TOTAL_PREORDER_TRACE_PER_RETAINED_SOURCE';
	readonly resultId: string;
	readonly traceNodes: number;
}

export interface SemanticSourceQueryReportResult {
	readonly capability: {
		readonly fullJanCsaaCapability029SemanticQuery: 'NOT_CLAIMED';
		readonly id: typeof SEMANTIC_SOURCE_QUERY_REPORT_CAPABILITY;
		readonly registeredJanCsaa007Operation: 'NOT_CLAIMED';
		readonly status: typeof SEMANTIC_SOURCE_QUERY_REPORT_CAPABILITY_STATUS;
	};
	readonly currentness: {
		readonly changedPaths: readonly string[];
		readonly diagnosticCodes: readonly string[];
		readonly scope: 'SELECTED_CAPTURED_SUBJECT_ONLY';
		readonly state: 'CURRENT_FOR_CAPTURED_SUBJECT' | 'STALE' | 'UNAVAILABLE';
	};
	readonly dynamicEvidence: {
		readonly applicability: 'NOT_APPLICABLE';
		readonly epistemic: SemanticEpistemicState;
		readonly rationale: string;
	};
	readonly evaluations: readonly SemanticSourceQueryReportRecordEvaluation[];
	readonly executionMode: 'COMPLETE';
	readonly facadeNonclaims: typeof SEMANTIC_SOURCE_QUERY_REPORT_NONCLAIMS;
	readonly identities: {
		readonly queryBindingId: string;
		readonly queryDefinitionId: string;
		readonly queryExplanationId: string;
		readonly queryReferenceId: string;
		readonly queryResultId: string;
	};
	readonly interpretation: 'BOUNDED_STATIC_SEMANTIC_SOURCE_SCALAR_QUERY';
	readonly limitations: {
		readonly semanticSnapshot: readonly SemanticLimitation[];
		readonly zeroSupportedMatchesGlobalAbsence: 'NOT_SUPPORTED';
	};
	readonly partitions: SemanticSourceQueryReportPartitions;
	readonly population: {
		readonly evaluatedRecords: number;
		readonly evaluationClosure: 'CLOSED_FOR_RETAINED_VALIDATED_SEMANTIC_SOURCES';
		readonly globalClosure: 'OPEN';
		readonly retainedRecords: number;
		readonly semanticHealth: 'COMPLETE' | 'PARTIAL';
		readonly semanticSnapshotId: SemanticSnapshotId;
		readonly zeroSupportedMatchesMeaning: 'NO_SUPPORTED_MATCH_IN_RETAINED_POPULATION_ONLY';
	};
	readonly queryCoreNonclaims: typeof SEMANTIC_SOURCE_QUERY_NONCLAIMS;
	readonly queryBinding: SemanticSourceQueryReportBinding;
	readonly queryDefinition: SemanticSourceQueryReportDefinition;
	readonly queryExplanation: SemanticSourceQueryReportExplanation;
	readonly queryReference: SemanticSourceQueryReportReference;
	readonly queryResult: SemanticSourceQueryReportResultOccurrence;
	readonly queryCoverage: {
		readonly chargedEvaluations: number;
		readonly partitionsReconcile: boolean;
		readonly traceNodes: number;
	};
	readonly schemaVersion: typeof SEMANTIC_SOURCE_QUERY_REPORT_RESULT_SCHEMA_VERSION;
}

export interface SemanticSourceQueryReportPartialOutcome {
	readonly analysisAuthority: typeof SEMANTIC_SOURCE_QUERY_REPORT_AUTHORITY;
	readonly authorityTransfer: typeof SEMANTIC_SOURCE_QUERY_REPORT_AUTHORITY_TRANSFER;
	readonly diagnostics: readonly SemanticSourceQueryReportDiagnostic[];
	readonly gateEffect: typeof SEMANTIC_SOURCE_QUERY_REPORT_GATE_EFFECT;
	readonly operationVersion: typeof SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION;
	readonly outcome: 'partial';
	readonly request: SemanticSourceQueryReportRequest;
	readonly result: SemanticSourceQueryReportResult;
	readonly schemaVersion: typeof SEMANTIC_SOURCE_QUERY_REPORT_SCHEMA_VERSION;
	readonly stageOutcomes: SemanticSourceQueryReportStageOutcomes;
	readonly state: 'partial';
	readonly subject: SubjectDescriptor;
}

export type SemanticSourceQueryReportFailureState = 'failed' | 'incompatible' | 'resource-refused';

export interface SemanticSourceQueryReportUnavailableOutcome {
	readonly analysisAuthority: typeof SEMANTIC_SOURCE_QUERY_REPORT_AUTHORITY;
	readonly authorityTransfer: typeof SEMANTIC_SOURCE_QUERY_REPORT_AUTHORITY_TRANSFER;
	readonly code: string;
	readonly diagnostics: readonly SemanticSourceQueryReportDiagnostic[];
	readonly facadeNonclaims: typeof SEMANTIC_SOURCE_QUERY_REPORT_NONCLAIMS;
	readonly gateEffect: typeof SEMANTIC_SOURCE_QUERY_REPORT_GATE_EFFECT;
	readonly operationVersion: typeof SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION;
	readonly outcome: 'unavailable';
	readonly request?: SemanticSourceQueryReportRequest;
	readonly schemaVersion: typeof SEMANTIC_SOURCE_QUERY_REPORT_SCHEMA_VERSION;
	readonly stage: SemanticSourceQueryReportStage;
	readonly state: SemanticSourceQueryReportFailureState;
	readonly subject?: SubjectDescriptor;
}

export type SemanticSourceQueryReportOutcome =
	SemanticSourceQueryReportPartialOutcome | SemanticSourceQueryReportUnavailableOutcome;
