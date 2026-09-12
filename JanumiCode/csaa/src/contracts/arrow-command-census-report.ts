import {
	ARROW_COMMAND_CENSUS_ADAPTER_ID,
	ARROW_COMMAND_CENSUS_FULL_JAN_CSAA_007_CONFORMANCE,
	ARROW_COMMAND_CENSUS_FULL_JAN_CSAA_008_CONFORMANCE,
	ARROW_COMMAND_CENSUS_INTEGRATION_STRATEGY,
	ARROW_COMMAND_CENSUS_METHOD,
	ARROW_COMMAND_CENSUS_ORACLE_CHANGE,
	ARROW_COMMAND_CENSUS_REPLACEMENT_EQUIVALENCE,
	ARROW_COMMAND_CENSUS_VERIFIER_AUTHORITY,
	type ArrowCommandCensusArtifactSetBudgets,
	type ArrowCommandCensusBudgets,
	type ArrowCommandCensusCoverage,
	type ArrowCommandCensusObservation
} from './arrow-command-census.js';
import type { SubjectBudgets, SubjectCompleteness, SubjectDescriptor } from './subject.js';

/**
 * Preliminary coding-agent facade over the retained JPWB arrow-command census. It preserves the
 * retained verifier's authority and limitations and is not a registered JAN-CSAA-007 operation,
 * full graph analysis, or DWP-004/005/006 completion evidence.
 */
export const ARROW_COMMAND_CENSUS_REPORT_REQUEST_SCHEMA_VERSION =
	'jan-csaa-arrow-command-census-report-request/0.1.0' as const;
export const ARROW_COMMAND_CENSUS_REPORT_SCHEMA_VERSION =
	'jan-csaa-arrow-command-census-report/0.1.0' as const;
export const ARROW_COMMAND_CENSUS_REPORT_RESULT_SCHEMA_VERSION =
	'jan-csaa-arrow-command-census-report-result/0.1.0' as const;
export const ARROW_COMMAND_CENSUS_REPORT_OPERATION_VERSION =
	'jan-csaa-report-arrow-command-census/0.1.0' as const;
export const ARROW_COMMAND_CENSUS_REPORT_AUTHORITY = 'NONE' as const;
export const ARROW_COMMAND_CENSUS_REPORT_AUTHORITY_TRANSFER = 'NONE' as const;
export const ARROW_COMMAND_CENSUS_REPORT_GATE_EFFECT = 'NONE' as const;
export const ARROW_COMMAND_CENSUS_REPORT_EXECUTION_SELECTION =
	'RUN_RETAINED_VERIFIER_WITH_SUBJECT_MODULE_INITIALIZERS_IN_PROCESS_ISOLATION_NOT_SECURITY_SANDBOX' as const;
export const ARROW_COMMAND_CENSUS_REPORT_CAPABILITY_ID = 'arrow-command-census' as const;
export const ARROW_COMMAND_CENSUS_REPORT_CAPABILITY_STATUS = 'PARTIAL' as const;
export const ARROW_COMMAND_CENSUS_REPORT_REGISTRY_STATUS =
	'IMPLEMENTATION_LOCAL_UNREGISTERED' as const;
export const ARROW_COMMAND_CENSUS_REPORT_SCOPE =
	'EXACT_SELECTED_FROZEN_SUBJECT_AND_EXECUTOR_BOUND_RETAINED_CENSUS' as const;

export const ARROW_COMMAND_CENSUS_REPORT_SELECTION = Object.freeze({
	adapter: ARROW_COMMAND_CENSUS_ADAPTER_ID,
	artifactPopulation:
		'ALL_RETAINED_VERIFIER_AND_REQUIRED_SOURCE_MODE_ARTIFACTS_SELECTED_FROM_ONE_EXACT_FROZEN_SUBJECT',
	execution: ARROW_COMMAND_CENSUS_REPORT_EXECUTION_SELECTION,
	retainedEvidencePopulation:
		'ALL_ACCEPTED_RETAINED_DECLARED_ARROW_SITE_OCCUPIABILITY_BIRTH_DEAD_COVERED_ORPHAN_UNANALYSED_AND_UNCOVERED_EVIDENCE',
	method: ARROW_COMMAND_CENSUS_METHOD,
	subjectPopulation:
		'EXPLICIT_PROJECT_CLOSURE_PLUS_FIXED_ADDITIONAL_ARTIFACTS_CAPTURED_IN_THE_SAME_FROZEN_SUBJECT'
} as const);

/** Fixed request-shape and diagnostic-sanitization ceilings, not caller budgets or SLOs. */
export const ARROW_COMMAND_CENSUS_REPORT_ADMISSION_LIMITS = Object.freeze({
	maxDiagnosticPathCharacters: 10_000,
	maxProjectPathCharacters: 4_096
});

export interface ArrowCommandCensusReportBudgets {
	readonly artifactSet: ArrowCommandCensusArtifactSetBudgets;
	/** Maximum admitted partial-result bytes, including the command terminal LF. */
	readonly maxResultBytes: number;
	readonly observation: ArrowCommandCensusBudgets;
	readonly subject: SubjectBudgets;
}

/** Absolute caller-budget admission ceilings, never caller defaults, performance targets, or SLOs. */
export const ARROW_COMMAND_CENSUS_REPORT_SAFETY_CEILINGS = Object.freeze({
	artifactSet: Object.freeze({
		maxArtifacts: 1_000,
		maxDiagnostics: 100,
		maxTotalBytes: 64 * 1024 * 1024
	}),
	maxResultBytes: 64 * 1024 * 1024,
	observation: Object.freeze({
		maxArtifacts: 1_000,
		maxBirthStates: 10_000,
		maxDeclaredArrowOccurrences: 10_000,
		maxDeclaredSites: 10_000,
		maxDiagnostics: 100,
		maxExecutorDurationMs: 120_000,
		maxExternalModuleBytes: 64 * 1024 * 1024,
		maxExternalModuleFiles: 5_000,
		maxMachines: 1_000,
		maxMapStates: 100_000,
		maxMaterializedBytes: 64 * 1024 * 1024,
		maxOutputStringCharacters: 10_000_000,
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
} satisfies ArrowCommandCensusReportBudgets);

/** The embedded observation limitations remain authoritative; this facade only narrows claims. */
export const ARROW_COMMAND_CENSUS_REPORT_NONCLAIMS = Object.freeze([
	'FACADE_OWNERSHIP_TRANSFER_REPLACEMENT_OR_CHANGE_OF_RETAINED_VERIFIER_OR_ORACLE_AUTHORITY',
	'RETAINED_TEST_GATE_EXECUTION_OR_GATE_RESULT',
	'BASELINE_MATCH_AS_CORRECTNESS_PROOF',
	'REPLACEMENT_EQUIVALENCE',
	'PROVIDER_QUALIFICATION',
	'HOSTILE_CODE_SECURITY_SANDBOX',
	'NETWORK_FILESYSTEM_PROCESS_ENVIRONMENT_OR_SECRET_CONFINEMENT',
	'SUBJECT_MODULE_INITIALIZER_SAFETY_OR_SIDE_EFFECT_FREEDOM',
	'CONFINEMENT_OF_INTENTIONALLY_DETACHED_DESCENDANT_PROCESSES',
	'PRE_EXECUTION_POPULATION_MEMORY_CONFINEMENT',
	'BUILT_OUTPUT_OR_DEPLOYED_RUNTIME_EQUIVALENCE',
	'RUNTIME_COMMAND_PERFORMABILITY',
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

export interface ArrowCommandCensusReportRequest {
	readonly budgets: ArrowCommandCensusReportBudgets;
	/** Explicit acknowledgement of the retained provider's subprocess and initializer behavior. */
	readonly executionSelection: typeof ARROW_COMMAND_CENSUS_REPORT_EXECUTION_SELECTION;
	readonly operationVersion: typeof ARROW_COMMAND_CENSUS_REPORT_OPERATION_VERSION;
	readonly schemaVersion: typeof ARROW_COMMAND_CENSUS_REPORT_REQUEST_SCHEMA_VERSION;
	/** Explicit bounded project closure; fixed verifier artifacts are implementation-owned. */
	readonly subjectProjectConfigPaths: readonly string[];
}

export type ArrowCommandCensusReportStage =
	'REQUEST' | 'SUBJECT' | 'ARTIFACT_SET' | 'RETAINED_CENSUS' | 'CURRENTNESS' | 'RESULT';

export interface ArrowCommandCensusReportDiagnostic {
	readonly code: string;
	readonly message: string;
	readonly path: string | null;
	readonly phase: string | null;
	readonly severity: 'INFO' | 'WARNING' | 'ERROR' | null;
	readonly source: 'REPORT' | 'SUBJECT' | 'ARTIFACT_SET' | 'RETAINED_CENSUS' | 'CURRENTNESS';
}

export interface ArrowCommandCensusReportStageOutcomes {
	readonly artifactSet: {
		readonly diagnosticCodes: readonly string[];
		readonly outcome: 'complete';
	};
	readonly currentness: {
		readonly diagnosticCodes: readonly string[];
		readonly state: 'CURRENT_FOR_CAPTURED_SUBJECT' | 'STALE' | 'UNAVAILABLE';
	};
	readonly retainedCensus: {
		readonly diagnosticCodes: readonly string[];
		readonly outcome: 'complete' | 'partial';
	};
	readonly subject: {
		readonly completeness: SubjectCompleteness;
		readonly diagnosticCodes: readonly string[];
		readonly outcome: 'resolved';
	};
}

export interface ArrowCommandCensusReportResult {
	readonly capability: {
		readonly adapterId: typeof ARROW_COMMAND_CENSUS_ADAPTER_ID;
		readonly fullJanCsaa007Conformance: typeof ARROW_COMMAND_CENSUS_FULL_JAN_CSAA_007_CONFORMANCE;
		readonly fullJanCsaa008Conformance: typeof ARROW_COMMAND_CENSUS_FULL_JAN_CSAA_008_CONFORMANCE;
		readonly integrationStrategy: typeof ARROW_COMMAND_CENSUS_INTEGRATION_STRATEGY;
		readonly id: typeof ARROW_COMMAND_CENSUS_REPORT_CAPABILITY_ID;
		readonly oracleChange: typeof ARROW_COMMAND_CENSUS_ORACLE_CHANGE;
		readonly registryStatus: typeof ARROW_COMMAND_CENSUS_REPORT_REGISTRY_STATUS;
		readonly replacementEquivalence: typeof ARROW_COMMAND_CENSUS_REPLACEMENT_EQUIVALENCE;
		readonly scope: typeof ARROW_COMMAND_CENSUS_REPORT_SCOPE;
		readonly status: typeof ARROW_COMMAND_CENSUS_REPORT_CAPABILITY_STATUS;
		readonly verifierAuthority: typeof ARROW_COMMAND_CENSUS_VERIFIER_AUTHORITY;
	};
	readonly coverage: ArrowCommandCensusCoverage & {
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
		readonly encoding: 'FULL_VALIDATED_RETAINED_ARROW_COMMAND_CENSUS_OBSERVATION';
		readonly observation: ArrowCommandCensusObservation;
	};
	readonly facadeNonclaims: typeof ARROW_COMMAND_CENSUS_REPORT_NONCLAIMS;
	readonly interpretation: 'VALIDATED_CAPTURE_AND_EXECUTOR_BOUND_RETAINED_CENSUS_EVIDENCE';
	readonly schemaVersion: typeof ARROW_COMMAND_CENSUS_REPORT_RESULT_SCHEMA_VERSION;
	readonly selection: typeof ARROW_COMMAND_CENSUS_REPORT_SELECTION;
	readonly subjectSummary: {
		readonly artifactBytes: number;
		readonly artifacts: number;
		readonly completeness: SubjectCompleteness;
		readonly projects: number;
	};
}

export interface ArrowCommandCensusReportPartialOutcome {
	readonly analysisAuthority: typeof ARROW_COMMAND_CENSUS_REPORT_AUTHORITY;
	readonly authorityTransfer: typeof ARROW_COMMAND_CENSUS_REPORT_AUTHORITY_TRANSFER;
	readonly diagnostics: readonly ArrowCommandCensusReportDiagnostic[];
	readonly gateEffect: typeof ARROW_COMMAND_CENSUS_REPORT_GATE_EFFECT;
	readonly operationVersion: typeof ARROW_COMMAND_CENSUS_REPORT_OPERATION_VERSION;
	readonly outcome: 'partial';
	readonly request: ArrowCommandCensusReportRequest;
	readonly result: ArrowCommandCensusReportResult;
	readonly schemaVersion: typeof ARROW_COMMAND_CENSUS_REPORT_SCHEMA_VERSION;
	readonly stageOutcomes: ArrowCommandCensusReportStageOutcomes;
	readonly state: 'partial';
	readonly subject: SubjectDescriptor;
}

export type ArrowCommandCensusReportFailureState = 'failed' | 'incompatible' | 'resource-refused';

export interface ArrowCommandCensusReportUnavailableOutcome {
	readonly analysisAuthority: typeof ARROW_COMMAND_CENSUS_REPORT_AUTHORITY;
	readonly authorityTransfer: typeof ARROW_COMMAND_CENSUS_REPORT_AUTHORITY_TRANSFER;
	readonly code: string;
	readonly diagnostics: readonly ArrowCommandCensusReportDiagnostic[];
	readonly facadeNonclaims: typeof ARROW_COMMAND_CENSUS_REPORT_NONCLAIMS;
	readonly gateEffect: typeof ARROW_COMMAND_CENSUS_REPORT_GATE_EFFECT;
	readonly operationVersion: typeof ARROW_COMMAND_CENSUS_REPORT_OPERATION_VERSION;
	readonly outcome: 'unavailable';
	readonly request?: ArrowCommandCensusReportRequest;
	readonly schemaVersion: typeof ARROW_COMMAND_CENSUS_REPORT_SCHEMA_VERSION;
	readonly stage: ArrowCommandCensusReportStage;
	readonly state: ArrowCommandCensusReportFailureState;
	readonly subject?: SubjectDescriptor;
}

export type ArrowCommandCensusReportOutcome =
	ArrowCommandCensusReportPartialOutcome | ArrowCommandCensusReportUnavailableOutcome;
