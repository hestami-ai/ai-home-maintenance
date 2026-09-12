import {
	GUARD_ENFORCEMENT_LEDGER_ADAPTER_ID,
	GUARD_ENFORCEMENT_LEDGER_INTEGRATION_STRATEGY,
	GUARD_ENFORCEMENT_LEDGER_METHOD,
	GUARD_ENFORCEMENT_LEDGER_ORACLE_CHANGE,
	GUARD_ENFORCEMENT_LEDGER_REPLACEMENT_EQUIVALENCE,
	GUARD_ENFORCEMENT_LEDGER_RETAINED_VERIFIER_PATHS,
	GUARD_ENFORCEMENT_LEDGER_RETAINED_TEST_EXECUTION,
	GUARD_ENFORCEMENT_LEDGER_RUNTIME_ENFORCEMENT,
	GUARD_ENFORCEMENT_LEDGER_VERIFIER_AUTHORITY,
	type GuardEnforcementLedgerArtifactSetBudgets,
	type GuardEnforcementLedgerBudgets,
	type GuardEnforcementLedgerCoverage,
	type GuardEnforcementLedgerObservation
} from './guard-enforcement-ledger.js';
import type { SubjectBudgets, SubjectCompleteness, SubjectDescriptor } from './subject.js';

/**
 * Preliminary coding-agent facade over the retained JPWB guard-enforcement ledger. It preserves the
 * retained verifier's authority and limitations and is not a registered JAN-CSAA-007 operation,
 * full graph analysis, or DWP-004/005/006 completion evidence.
 */
export const GUARD_ENFORCEMENT_LEDGER_REPORT_REQUEST_SCHEMA_VERSION =
	'jan-csaa-guard-enforcement-ledger-report-request/0.1.0' as const;
export const GUARD_ENFORCEMENT_LEDGER_REPORT_SCHEMA_VERSION =
	'jan-csaa-guard-enforcement-ledger-report/0.1.0' as const;
export const GUARD_ENFORCEMENT_LEDGER_REPORT_RESULT_SCHEMA_VERSION =
	'jan-csaa-guard-enforcement-ledger-report-result/0.1.0' as const;
export const GUARD_ENFORCEMENT_LEDGER_REPORT_OPERATION_VERSION =
	'jan-csaa-report-guard-enforcement-ledger/0.1.0' as const;
export const GUARD_ENFORCEMENT_LEDGER_REPORT_AUTHORITY = 'NONE' as const;
export const GUARD_ENFORCEMENT_LEDGER_REPORT_AUTHORITY_TRANSFER = 'NONE' as const;
export const GUARD_ENFORCEMENT_LEDGER_REPORT_GATE_EFFECT = 'NONE' as const;
export const GUARD_ENFORCEMENT_LEDGER_REPORT_FULL_JAN_CSAA_007_CONFORMANCE = 'NOT_CLAIMED' as const;
export const GUARD_ENFORCEMENT_LEDGER_REPORT_FULL_JAN_CSAA_008_CONFORMANCE = 'NOT_CLAIMED' as const;
export const GUARD_ENFORCEMENT_LEDGER_REPORT_EXECUTION_SELECTION =
	'RUN_RETAINED_VERIFIER_WITH_SUBJECT_MODULE_INITIALIZERS_IN_PROCESS_ISOLATION_NOT_SECURITY_SANDBOX' as const;
export const GUARD_ENFORCEMENT_LEDGER_REPORT_CAPABILITY_ID = 'guard-enforcement-ledger' as const;
export const GUARD_ENFORCEMENT_LEDGER_REPORT_CAPABILITY_STATUS = 'PARTIAL' as const;
export const GUARD_ENFORCEMENT_LEDGER_REPORT_REGISTRY_STATUS =
	'IMPLEMENTATION_LOCAL_UNREGISTERED' as const;
export const GUARD_ENFORCEMENT_LEDGER_REPORT_SCOPE =
	'EXACT_SELECTED_FROZEN_SUBJECT_AND_EXECUTOR_BOUND_RETAINED_LEDGER' as const;
export const GUARD_ENFORCEMENT_LEDGER_REPORT_ANALYZER_DEPENDENCY_PATH =
	'verif/arrow-command-census.ts' as const;
export const GUARD_ENFORCEMENT_LEDGER_REPORT_ADDITIONAL_ARTIFACT_PATHS = Object.freeze([
	...GUARD_ENFORCEMENT_LEDGER_RETAINED_VERIFIER_PATHS,
	GUARD_ENFORCEMENT_LEDGER_REPORT_ANALYZER_DEPENDENCY_PATH
] as const);

export const GUARD_ENFORCEMENT_LEDGER_REPORT_SELECTION = Object.freeze({
	adapter: GUARD_ENFORCEMENT_LEDGER_ADAPTER_ID,
	artifactPopulation:
		'ALL_RETAINED_VERIFIER_ANALYZER_DEPENDENCY_AND_REQUIRED_SOURCE_MODE_ARTIFACTS_SELECTED_FROM_ONE_EXACT_FROZEN_SUBJECT',
	execution: GUARD_ENFORCEMENT_LEDGER_REPORT_EXECUTION_SELECTION,
	retainedEvidencePopulation:
		'ALL_ACCEPTED_RETAINED_GUARDED_ARROW_GUARD_TEXT_LEDGER_ROW_AUDIT_CLASSIFICATION_AND_ANCHOR_EVIDENCE',
	method: GUARD_ENFORCEMENT_LEDGER_METHOD,
	subjectPopulation:
		'EXPLICIT_PROJECT_CLOSURE_PLUS_FIXED_ADDITIONAL_ARTIFACTS_CAPTURED_IN_THE_SAME_FROZEN_SUBJECT'
} as const);

/** Fixed request-shape and diagnostic-sanitization ceilings, not caller budgets or SLOs. */
export const GUARD_ENFORCEMENT_LEDGER_REPORT_ADMISSION_LIMITS = Object.freeze({
	maxDiagnosticPathCharacters: 10_000,
	maxProjectPathCharacters: 4_096
});

export interface GuardEnforcementLedgerReportBudgets {
	readonly artifactSet: GuardEnforcementLedgerArtifactSetBudgets;
	/** Maximum admitted partial-result bytes, including the command terminal LF. */
	readonly maxResultBytes: number;
	readonly observation: GuardEnforcementLedgerBudgets;
	readonly subject: SubjectBudgets;
}

/** Absolute caller-budget admission ceilings, never caller defaults, performance targets, or SLOs. */
export const GUARD_ENFORCEMENT_LEDGER_REPORT_SAFETY_CEILINGS = Object.freeze({
	artifactSet: Object.freeze({
		maxArtifacts: 1_000,
		maxDiagnostics: 100,
		maxTotalBytes: 64 * 1024 * 1024
	}),
	maxResultBytes: 64 * 1024 * 1024,
	observation: Object.freeze({
		maxArtifacts: 1_000,
		maxAuditEntries: 10_000,
		maxDiagnostics: 100,
		maxExecutorDurationMs: 120_000,
		maxExternalModuleBytes: 128 * 1024 * 1024,
		maxExternalModuleFiles: 5_000,
		maxGuardedArrows: 10_000,
		maxGuardTexts: 10_000,
		maxLedgerRows: 10_000,
		maxMaterializedBytes: 128 * 1024 * 1024,
		maxOutputStringCharacters: 20_000_000,
		maxRawArrayEntries: 100_000,
		maxRawJsonDepth: 20,
		maxStderrBytes: 1024 * 1024,
		maxStdoutBytes: 64 * 1024 * 1024
	}),
	subject: Object.freeze({
		maxBytes: 256 * 1024 * 1024,
		maxConfigDepth: 64,
		maxDiagnostics: 100_000,
		maxDurationMs: 180_000,
		maxFiles: 100_000,
		maxProjects: 200
	})
} satisfies GuardEnforcementLedgerReportBudgets);

/** The embedded observation limitations remain authoritative; this facade only narrows claims. */
export const GUARD_ENFORCEMENT_LEDGER_REPORT_NONCLAIMS = Object.freeze([
	'FACADE_OWNERSHIP_TRANSFER_REPLACEMENT_OR_CHANGE_OF_RETAINED_VERIFIER_OR_ORACLE_AUTHORITY',
	'RETAINED_TEST_GATE_EXECUTION_OR_GATE_RESULT',
	'INDEPENDENT_CORRECTNESS_OF_RETAINED_CLASSIFICATION_JUDGMENT',
	'REPLACEMENT_EQUIVALENCE',
	'PROVIDER_QUALIFICATION',
	'HOSTILE_CODE_SECURITY_SANDBOX',
	'NETWORK_FILESYSTEM_PROCESS_ENVIRONMENT_OR_SECRET_CONFINEMENT',
	'SUBJECT_MODULE_INITIALIZER_SAFETY_OR_SIDE_EFFECT_FREEDOM',
	'CONFINEMENT_OF_INTENTIONALLY_DETACHED_DESCENDANT_PROCESSES',
	'PRE_EXECUTION_POPULATION_MEMORY_CONFINEMENT',
	'BUILT_OUTPUT_OR_DEPLOYED_RUNTIME_EQUIVALENCE',
	'RUNTIME_GUARD_EXECUTION_COMMAND_PERFORMABILITY_OR_COMMAND_REFUSAL',
	'GUARD_DOMINANCE_PATH_FEASIBILITY_OR_REACHABILITY',
	'HANDLER_REGISTRY_JOIN_OR_HANDLER_OWNERSHIP',
	'COMMAND_DISPATCH_CLOSURE',
	'WHOLE_REPOSITORY_WHOLE_PROGRAM_OR_RUNTIME_CLOSURE',
	'GUARD_EFFECT_EVENT_OR_PERSISTENCE_COVERAGE',
	'FULL_GRAPH_RELATION_CONFORMANCE',
	'FULL_JAN_CSAA_007_OR_008_CONFORMANCE',
	'JAN_CSAA_CAP_029_SEMANTIC_QUERY',
	'JAN_CSAA_CAP_030_CODE_SLICE',
	'JAN_CSAA_CAP_031_CHANGE_IMPACT',
	'JAN_CSAA_CAP_032_SEMANTIC_COMPARISON',
	'DWP_004_DWP_005_OR_DWP_006_COMPLETION',
	'JAN_CSAA_007_REGISTERED_OPERATION_OR_OPERATION_RESPONSE_ENVELOPE',
	'PERSISTED_OR_DESERIALIZED_CAPTURE_REPLAY',
	'PERSISTENT_FRESHNESS_OR_CROSS_REVISION_CURRENTNESS',
	'PERSISTENT_EXECUTOR_FRESHNESS_OR_CROSS_INVOCATION_CURRENTNESS',
	'WORKING_CHANGE_MERGE_BASE_TARGET_REVISION_OR_CANDIDATE_MERGE_BINDING',
	'FORMAL_JAN_CSAA_RULE_FINDING_OR_CODE_DEAD_OR_ORPHAN_CLASSIFICATION',
	'ARCHITECTURE_DEAD_CODE_NON_IMPACT_SAFE_REMOVAL_FINDING_REMEDIATION_OR_DISPOSITION_AUTHORITY'
] as const);

export interface GuardEnforcementLedgerReportRequest {
	readonly budgets: GuardEnforcementLedgerReportBudgets;
	/** Explicit acknowledgement of the retained provider's subprocess and initializer behavior. */
	readonly executionSelection: typeof GUARD_ENFORCEMENT_LEDGER_REPORT_EXECUTION_SELECTION;
	readonly operationVersion: typeof GUARD_ENFORCEMENT_LEDGER_REPORT_OPERATION_VERSION;
	readonly schemaVersion: typeof GUARD_ENFORCEMENT_LEDGER_REPORT_REQUEST_SCHEMA_VERSION;
	/** Explicit bounded project closure; fixed verifier artifacts are implementation-owned. */
	readonly subjectProjectConfigPaths: readonly string[];
}

export type GuardEnforcementLedgerReportStage =
	'REQUEST' | 'SUBJECT' | 'ARTIFACT_SET' | 'RETAINED_LEDGER' | 'CURRENTNESS' | 'RESULT';

export interface GuardEnforcementLedgerReportDiagnostic {
	readonly code: string;
	readonly message: string;
	readonly path: string | null;
	readonly phase: string | null;
	readonly severity: 'INFO' | 'WARNING' | 'ERROR' | null;
	readonly source: 'REPORT' | 'SUBJECT' | 'ARTIFACT_SET' | 'RETAINED_LEDGER' | 'CURRENTNESS';
}

export interface GuardEnforcementLedgerReportStageOutcomes {
	readonly artifactSet: {
		readonly diagnosticCodes: readonly string[];
		readonly outcome: 'complete';
	};
	readonly currentness: {
		readonly diagnosticCodes: readonly string[];
		readonly state: 'CURRENT_FOR_CAPTURED_SUBJECT' | 'STALE' | 'UNAVAILABLE';
	};
	readonly retainedLedger: {
		readonly diagnosticCodes: readonly string[];
		readonly outcome: 'complete' | 'partial';
	};
	readonly subject: {
		readonly completeness: SubjectCompleteness;
		readonly diagnosticCodes: readonly string[];
		readonly outcome: 'resolved';
	};
}

export interface GuardEnforcementLedgerReportResult {
	readonly capability: {
		readonly adapterId: typeof GUARD_ENFORCEMENT_LEDGER_ADAPTER_ID;
		readonly fullJanCsaa007Conformance: typeof GUARD_ENFORCEMENT_LEDGER_REPORT_FULL_JAN_CSAA_007_CONFORMANCE;
		readonly fullJanCsaa008Conformance: typeof GUARD_ENFORCEMENT_LEDGER_REPORT_FULL_JAN_CSAA_008_CONFORMANCE;
		readonly integrationStrategy: typeof GUARD_ENFORCEMENT_LEDGER_INTEGRATION_STRATEGY;
		readonly id: typeof GUARD_ENFORCEMENT_LEDGER_REPORT_CAPABILITY_ID;
		readonly oracleChange: typeof GUARD_ENFORCEMENT_LEDGER_ORACLE_CHANGE;
		readonly registryStatus: typeof GUARD_ENFORCEMENT_LEDGER_REPORT_REGISTRY_STATUS;
		readonly replacementEquivalence: typeof GUARD_ENFORCEMENT_LEDGER_REPLACEMENT_EQUIVALENCE;
		readonly retainedTestExecution: typeof GUARD_ENFORCEMENT_LEDGER_RETAINED_TEST_EXECUTION;
		readonly runtimeEnforcement: typeof GUARD_ENFORCEMENT_LEDGER_RUNTIME_ENFORCEMENT;
		readonly scope: typeof GUARD_ENFORCEMENT_LEDGER_REPORT_SCOPE;
		readonly status: typeof GUARD_ENFORCEMENT_LEDGER_REPORT_CAPABILITY_STATUS;
		readonly verifierAuthority: typeof GUARD_ENFORCEMENT_LEDGER_VERIFIER_AUTHORITY;
	};
	readonly coverage: GuardEnforcementLedgerCoverage & {
		readonly artifactBytes: number;
		readonly artifacts: number;
		readonly health: 'PARTIAL';
		readonly limitations: number;
		readonly rawOutputBytes: number;
	};
	readonly currentness: {
		readonly changedPaths: readonly string[];
		readonly diagnosticCodes: readonly string[];
		readonly scope: 'SELECTED_CAPTURED_SUBJECT_ONLY';
		readonly state: 'CURRENT_FOR_CAPTURED_SUBJECT' | 'STALE' | 'UNAVAILABLE';
	};
	readonly evidence: {
		readonly encoding: 'FULL_VALIDATED_RETAINED_GUARD_ENFORCEMENT_LEDGER_OBSERVATION';
		readonly observation: GuardEnforcementLedgerObservation;
	};
	readonly facadeNonclaims: typeof GUARD_ENFORCEMENT_LEDGER_REPORT_NONCLAIMS;
	readonly interpretation: 'VALIDATED_CAPTURE_AND_EXECUTOR_BOUND_RETAINED_LEDGER_EVIDENCE';
	readonly schemaVersion: typeof GUARD_ENFORCEMENT_LEDGER_REPORT_RESULT_SCHEMA_VERSION;
	readonly selection: typeof GUARD_ENFORCEMENT_LEDGER_REPORT_SELECTION;
	readonly subjectSummary: {
		readonly artifactBytes: number;
		readonly artifacts: number;
		readonly completeness: SubjectCompleteness;
		readonly projects: number;
	};
}

export interface GuardEnforcementLedgerReportPartialOutcome {
	readonly analysisAuthority: typeof GUARD_ENFORCEMENT_LEDGER_REPORT_AUTHORITY;
	readonly authorityTransfer: typeof GUARD_ENFORCEMENT_LEDGER_REPORT_AUTHORITY_TRANSFER;
	readonly diagnostics: readonly GuardEnforcementLedgerReportDiagnostic[];
	readonly gateEffect: typeof GUARD_ENFORCEMENT_LEDGER_REPORT_GATE_EFFECT;
	readonly operationVersion: typeof GUARD_ENFORCEMENT_LEDGER_REPORT_OPERATION_VERSION;
	readonly outcome: 'partial';
	readonly request: GuardEnforcementLedgerReportRequest;
	readonly result: GuardEnforcementLedgerReportResult;
	readonly schemaVersion: typeof GUARD_ENFORCEMENT_LEDGER_REPORT_SCHEMA_VERSION;
	readonly stageOutcomes: GuardEnforcementLedgerReportStageOutcomes;
	readonly state: 'partial';
	readonly subject: SubjectDescriptor;
}

export type GuardEnforcementLedgerReportFailureState =
	'failed' | 'incompatible' | 'resource-refused';

export interface GuardEnforcementLedgerReportUnavailableOutcome {
	readonly analysisAuthority: typeof GUARD_ENFORCEMENT_LEDGER_REPORT_AUTHORITY;
	readonly authorityTransfer: typeof GUARD_ENFORCEMENT_LEDGER_REPORT_AUTHORITY_TRANSFER;
	readonly code: string;
	readonly diagnostics: readonly GuardEnforcementLedgerReportDiagnostic[];
	readonly facadeNonclaims: typeof GUARD_ENFORCEMENT_LEDGER_REPORT_NONCLAIMS;
	readonly gateEffect: typeof GUARD_ENFORCEMENT_LEDGER_REPORT_GATE_EFFECT;
	readonly operationVersion: typeof GUARD_ENFORCEMENT_LEDGER_REPORT_OPERATION_VERSION;
	readonly outcome: 'unavailable';
	readonly request?: GuardEnforcementLedgerReportRequest;
	readonly schemaVersion: typeof GUARD_ENFORCEMENT_LEDGER_REPORT_SCHEMA_VERSION;
	readonly stage: GuardEnforcementLedgerReportStage;
	readonly state: GuardEnforcementLedgerReportFailureState;
	readonly subject?: SubjectDescriptor;
}

export type GuardEnforcementLedgerReportOutcome =
	GuardEnforcementLedgerReportPartialOutcome | GuardEnforcementLedgerReportUnavailableOutcome;
