import type {
	ProjectContextGraphBudgets,
	ProjectContextGraphSnapshot
} from './project-context-graph.js';
import type { SemanticBudgets, SemanticSnapshotId } from './semantic.js';
import type { SubjectBudgets, SubjectCompleteness, SubjectDescriptor } from './subject.js';

/**
 * Preliminary coding-agent report over the already implemented partial CAP-010 project-context
 * graph. This is neither a registered JAN-CSAA-007 operation envelope nor DWP-005/DWP-006
 * completion evidence.
 */
export const PROJECT_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION =
	'jan-csaa-project-context-report-request/0.1.0' as const;
export const PROJECT_CONTEXT_REPORT_SCHEMA_VERSION =
	'jan-csaa-project-context-report/0.1.0' as const;
export const PROJECT_CONTEXT_REPORT_RESULT_SCHEMA_VERSION =
	'jan-csaa-project-context-report-result/0.1.0' as const;
export const PROJECT_CONTEXT_REPORT_OPERATION_VERSION =
	'jan-csaa-report-project-context/0.1.0' as const;

export interface ProjectContextReportBudgets {
	/** Maximum admitted partial-result bytes, including the command's terminal LF; small refusals remain emit-able. */
	readonly maxResultBytes: number;
	readonly projectContext: ProjectContextGraphBudgets;
	readonly semantic: SemanticBudgets;
	readonly subject: SubjectBudgets;
}

/** Absolute request ceilings, never caller defaults, performance targets, or SLOs. */
export const PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS = Object.freeze({
	maxResultBytes: 64 * 1024 * 1024,
	projectContext: Object.freeze({
		maxConfigurationClosureRecords: 1_000_000,
		maxDiagnostics: 100_000,
		maxInputRecords: 10_000_000,
		maxInputStringCharacters: 1_000_000_000,
		maxMemberships: 2_000_000,
		maxOutputRecords: 3_000_000,
		maxPrograms: 1_000_000,
		maxProjectReferences: 1_000_000,
		maxProjects: 1_000_000,
		maxSources: 1_000_000,
		maxTraversalSteps: 5_000_000
	}),
	semantic: Object.freeze({
		maxAstDepth: 2_048,
		maxAstNodes: 5_000_000,
		maxCompilerInputMetadataBytes: 536_870_912,
		maxCompilerQueries: 5_000_000,
		maxCompilerFacts: 5_000_000,
		maxCompilerQueryInvocations: 50_000_000,
		maxContextBytes: 536_870_912,
		maxContextFileBytes: 67_108_864,
		maxContextFiles: 100_000,
		maxDiagnosticCharacters: 50_000_000,
		maxDiagnostics: 500_000,
		maxDirectoryEntries: 5_000_000,
		maxDurationMs: 3_600_000,
		maxLiteralCharacters: 10_000,
		maxPathCharacters: 4_096,
		maxProjects: 200,
		maxScopes: 1_000_000,
		maxSnapshotBytes: 1_000_000_000,
		maxSources: 100_000
	}),
	subject: Object.freeze({
		maxBytes: 1_000_000_000,
		maxConfigDepth: 64,
		maxDiagnostics: 100_000,
		maxDurationMs: 180_000,
		maxFiles: 100_000,
		maxProjects: 200
	})
} satisfies ProjectContextReportBudgets);

export const PROJECT_CONTEXT_REPORT_NONCLAIMS = Object.freeze([
	'FULL_JAN_CSAA_CAP_010_PROJECT_REFERENCE_AND_VARIANT_RESOLUTION',
	'FULL_JAN_CSAA_007_008_009_010_OR_011_CONFORMANCE',
	'INFERRED_NORMAL_BUILD_TEST_GENERATED_OR_CONSUMER_VARIANTS',
	'CONFIGURATION_INHERITANCE_BEYOND_FROZEN_PROGRAM_RECIPE',
	'WORKSPACE_PACKAGE_OR_PACKAGE_DEPENDENCY_CLOSURE',
	'CUSTOM_BUILD_SYSTEM_OR_RUNTIME_PROJECT_MEMBERSHIP',
	'PROJECT_OR_PROGRAM_SEMANTIC_EQUIVALENCE',
	'JAN_CSAA_CAP_009_GRAPH_COMPOSITION',
	'JAN_CSAA_CAP_011_PATH_ALIAS_OR_MODULE_RESOLUTION',
	'JAN_CSAA_CAP_012_CONDITIONAL_EXPORT_RESOLUTION',
	'JAN_CSAA_CAP_013_DECLARATION_OR_MODULE_AUGMENTATION',
	'JAN_CSAA_CAP_014_SOURCE_MAP_OR_SOURCE_ORIGIN_CORRELATION',
	'GENERATED_SOURCE_LINEAGE_BEYOND_RETAINED_ORIGIN_FACTS',
	'JAN_CSAA_CAP_029_SEMANTIC_QUERY',
	'JAN_CSAA_CAP_030_CODE_SLICE',
	'JAN_CSAA_CAP_031_CHANGE_IMPACT',
	'JAN_CSAA_CAP_032_SEMANTIC_COMPARISON',
	'DWP_004_DWP_005_OR_DWP_006_COMPLETION',
	'JAN_CSAA_007_REGISTERED_OPERATION_OR_OPERATION_RESPONSE_ENVELOPE',
	'PROVIDER_QUALIFICATION_OR_ORACLE_CONFERRAL',
	'BUILD_SUCCESS_OR_RUNTIME_LOADABILITY',
	'PERSISTENT_FRESHNESS_OR_CROSS_REVISION_CURRENTNESS',
	'WORKING_CHANGE_MERGE_BASE_TARGET_REVISION_OR_CANDIDATE_MERGE_BINDING',
	'RECOGNIZED_ARCHITECTURE_ARCHITECTURE_DISCOVERY_OR_ARCHITECTURE_VIOLATION',
	'ORPHAN_DEAD_CODE_IRRELEVANCE_NON_IMPACT_OR_SAFE_REMOVAL',
	'WHOLE_PROGRAM_BEHAVIORAL_FRAMEWORK_DYNAMIC_ENTRY_OR_RUNTIME_CLOSURE',
	'BEHAVIORAL_PRESERVATION_OR_TEST_SELECTION_PROOF',
	'RULE_FINDING_SEVERITY_GATE_DESIGN_MERGE_REMEDIATION_OR_DISPOSITION_AUTHORITY'
] as const);

export interface ProjectContextReportRequest {
	readonly budgets: ProjectContextReportBudgets;
	readonly operationVersion: typeof PROJECT_CONTEXT_REPORT_OPERATION_VERSION;
	readonly schemaVersion: typeof PROJECT_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION;
	/** Explicit bounded semantic subject closure; no workspace project is inferred silently. */
	readonly subjectProjectConfigPaths: readonly string[];
}

export type ProjectContextReportStage =
	'REQUEST' | 'SUBJECT' | 'SEMANTIC_SNAPSHOT' | 'PROJECT_CONTEXT' | 'CURRENTNESS' | 'RESULT';

export interface ProjectContextReportDiagnostic {
	readonly code: string;
	readonly message: string;
	readonly path: string | null;
	readonly phase: string | null;
	readonly severity: 'INFO' | 'WARNING' | 'ERROR' | null;
	readonly source: 'REPORT' | 'SUBJECT' | 'SEMANTIC_SNAPSHOT' | 'PROJECT_CONTEXT' | 'CURRENTNESS';
}

export interface ProjectContextReportStageOutcomes {
	readonly currentness: {
		readonly diagnosticCodes: readonly string[];
		readonly state: 'CURRENT_FOR_CAPTURED_SUBJECT' | 'STALE' | 'UNAVAILABLE';
	};
	readonly projectContext: {
		readonly diagnosticCodes: readonly string[];
		readonly outcome: 'partial';
	};
	readonly semanticSnapshot: {
		readonly diagnosticCodes: readonly string[];
		readonly outcome: 'complete' | 'partial';
	};
	readonly subject: {
		readonly completeness: SubjectCompleteness;
		readonly diagnosticCodes: readonly string[];
		readonly outcome: 'resolved';
	};
}

export interface ProjectContextReportResult {
	readonly capability: {
		readonly architectureDiscovery: 'NOT_CLAIMED';
		readonly changeImpact: 'NOT_CLAIMED';
		readonly codeSlice: 'NOT_CLAIMED';
		readonly id: 'JAN-CSAA-CAP-010';
		readonly semanticComparison: 'NOT_CLAIMED';
		readonly semanticQuery: 'NOT_CLAIMED';
		readonly status: 'PARTIAL';
	};
	/** Facade currentness is separate from, and does not alter, the embedded graph's fields. */
	readonly currentness: {
		readonly changedPaths: readonly string[];
		readonly diagnosticCodes: readonly string[];
		readonly scope: 'SELECTED_CAPTURED_SUBJECT_ONLY';
		readonly state: 'CURRENT_FOR_CAPTURED_SUBJECT' | 'STALE' | 'UNAVAILABLE';
	};
	readonly evidence: {
		readonly encoding: 'ALL_VALIDATED_PROJECTS_PROGRAMS_SOURCES_MEMBERSHIPS_AND_PROJECT_REFERENCES';
		readonly projectContextGraph: ProjectContextGraphSnapshot;
	};
	readonly facadeNonclaims: typeof PROJECT_CONTEXT_REPORT_NONCLAIMS;
	readonly interpretation: 'SELECTED_VALIDATED_FROZEN_PROJECT_CONTEXT';
	readonly schemaVersion: typeof PROJECT_CONTEXT_REPORT_RESULT_SCHEMA_VERSION;
	readonly semanticSnapshotSummary: {
		readonly id: SemanticSnapshotId;
		readonly programs: number;
		readonly projects: number;
		readonly sources: number;
	};
}

export interface ProjectContextReportPartialOutcome {
	readonly diagnostics: readonly ProjectContextReportDiagnostic[];
	readonly operationVersion: typeof PROJECT_CONTEXT_REPORT_OPERATION_VERSION;
	readonly outcome: 'partial';
	readonly request: ProjectContextReportRequest;
	readonly result: ProjectContextReportResult;
	readonly schemaVersion: typeof PROJECT_CONTEXT_REPORT_SCHEMA_VERSION;
	readonly stageOutcomes: ProjectContextReportStageOutcomes;
	readonly state: 'partial';
	readonly subject: SubjectDescriptor;
}

export type ProjectContextReportFailureState = 'failed' | 'incompatible' | 'resource-refused';

export interface ProjectContextReportUnavailableOutcome {
	readonly code: string;
	readonly diagnostics: readonly ProjectContextReportDiagnostic[];
	readonly facadeNonclaims: typeof PROJECT_CONTEXT_REPORT_NONCLAIMS;
	readonly operationVersion: typeof PROJECT_CONTEXT_REPORT_OPERATION_VERSION;
	readonly outcome: 'unavailable';
	readonly request?: ProjectContextReportRequest;
	readonly schemaVersion: typeof PROJECT_CONTEXT_REPORT_SCHEMA_VERSION;
	readonly stage: ProjectContextReportStage;
	readonly state: ProjectContextReportFailureState;
	readonly subject?: SubjectDescriptor;
}

export type ProjectContextReportOutcome =
	ProjectContextReportPartialOutcome | ProjectContextReportUnavailableOutcome;
