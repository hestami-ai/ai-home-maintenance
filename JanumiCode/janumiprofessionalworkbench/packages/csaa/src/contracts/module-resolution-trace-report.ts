import {
	PROJECT_CONTEXT_GRAPH_NONCLAIMS,
	type ProjectContextGraphBudgets,
	type ProjectContextGraphSnapshot
} from './project-context-graph.js';
import {
	CONDITIONAL_EXPORT_RESOLUTION_NONCLAIMS,
	type ConditionalExportResolutionBudgets,
	type ConditionalExportResolutionSnapshot
} from './conditional-export-resolution.js';
import {
	MODULE_RESOLUTION_TRACE_NONCLAIMS,
	type ModuleResolutionTraceBudgets,
	type ModuleResolutionTraceSnapshot
} from './module-resolution-trace.js';
import type { SemanticBudgets, SemanticSnapshotId } from './semantic.js';
import type { SubjectBudgets, SubjectCompleteness, SubjectDescriptor } from './subject.js';

/**
 * Preliminary coding-agent report over the already implemented partial CAP-011 trace and its
 * CAP-010/CAP-012 predecessors. This is neither a registered JAN-CSAA-007 operation envelope nor
 * DWP-004/DWP-005/DWP-006 completion evidence.
 */
export const MODULE_RESOLUTION_TRACE_REPORT_REQUEST_SCHEMA_VERSION =
	'jan-csaa-module-resolution-trace-report-request/0.1.0' as const;
export const MODULE_RESOLUTION_TRACE_REPORT_SCHEMA_VERSION =
	'jan-csaa-module-resolution-trace-report/0.1.0' as const;
export const MODULE_RESOLUTION_TRACE_REPORT_RESULT_SCHEMA_VERSION =
	'jan-csaa-module-resolution-trace-report-result/0.1.0' as const;
export const MODULE_RESOLUTION_TRACE_REPORT_OPERATION_VERSION =
	'jan-csaa-report-module-resolution-trace/0.1.0' as const;

export const MODULE_RESOLUTION_TRACE_REPORT_SELECTION = Object.freeze({
	conditions: Object.freeze(['types'] as const),
	exportSubpath: '.' as const,
	moduleMode: 'IMPORT' as const,
	occurrenceKind: 'IMPORT' as const,
	packageSpecifier: 'BARE_WORKSPACE_PACKAGE_ROOT' as const,
	platform: 'NODE' as const,
	typeOnly: false as const,
	valueKind: 'VALUE_NON_TYPE_ONLY' as const
});

export interface ModuleResolutionTraceReportBudgets {
	readonly conditionalExport: ConditionalExportResolutionBudgets;
	/** Maximum admitted partial-result bytes, including the command's terminal LF; small refusals remain emit-able. */
	readonly maxResultBytes: number;
	readonly moduleResolutionTrace: ModuleResolutionTraceBudgets;
	readonly projectContext: ProjectContextGraphBudgets;
	readonly semantic: SemanticBudgets;
	readonly subject: SubjectBudgets;
}

/** Absolute request ceilings, never caller defaults, performance targets, or SLOs. */
export const MODULE_RESOLUTION_TRACE_REPORT_SAFETY_CEILINGS = Object.freeze({
	conditionalExport: Object.freeze({
		maxAstNodes: 5_000_000,
		maxBranches: 1_000_000,
		maxConditionChecks: 1_000_000,
		maxDiagnostics: 100_000,
		maxFrontiers: 1_000_000,
		maxInputRecords: 10_000_000,
		maxInputStringCharacters: 1_000_000_000,
		maxManifestBytes: 67_108_864,
		maxOutputRecords: 2_000_001,
		maxTraversalSteps: 5_000_000
	}),
	maxResultBytes: 128 * 1024 * 1024,
	moduleResolutionTrace: Object.freeze({
		maxAstNodes: 5_000_000,
		maxAttempts: 5_000_000,
		maxCandidates: 5_000_000,
		maxDiagnostics: 100_000,
		maxInputRecords: 10_000_000,
		maxInputStringCharacters: 1_000_000_000,
		maxOutputRecords: 10_000_001,
		maxReadBytes: 536_870_912,
		maxTraversalSteps: 10_000_000
	}),
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
} satisfies ModuleResolutionTraceReportBudgets);

/** Embedded-evidence nonclaims remain visible without being misapplied to the report facade. */
export const MODULE_RESOLUTION_TRACE_REPORT_PREDECESSOR_NONCLAIMS = Object.freeze({
	conditionalExportResolution: CONDITIONAL_EXPORT_RESOLUTION_NONCLAIMS,
	moduleResolutionTrace: MODULE_RESOLUTION_TRACE_NONCLAIMS,
	projectContextGraph: PROJECT_CONTEXT_GRAPH_NONCLAIMS
} as const);

const MODULE_RESOLUTION_TRACE_REPORT_APPLICABLE_TRACE_NONCLAIMS = Object.freeze(
	MODULE_RESOLUTION_TRACE_NONCLAIMS.filter((nonclaim) => nonclaim !== 'CURRENTNESS_OR_FRESHNESS')
);

/** Applicable CAP-011 nonclaims remain inherited; the facade can only add restrictions. */
export const MODULE_RESOLUTION_TRACE_REPORT_NONCLAIMS = Object.freeze([
	...MODULE_RESOLUTION_TRACE_REPORT_APPLICABLE_TRACE_NONCLAIMS,
	'FULL_JAN_CSAA_CAP_010_011_OR_012_CONFORMANCE',
	'FULL_JAN_CSAA_007_008_009_010_011_OR_012_CONFORMANCE',
	'IMPORTER_POPULATION_BEYOND_ONE_EXACT_REQUESTED_LITERAL_OCCURRENCE',
	'TYPE_ONLY_IMPORT_OCCURRENCE',
	'CONDITIONS_MODES_PLATFORMS_OR_EXPORT_SUBPATHS_BEYOND_FIXED_TYPES_IMPORT_NODE_ROOT_SLICE',
	'JAN_CSAA_CAP_009_GRAPH_COMPOSITION',
	'JAN_CSAA_CAP_013_DECLARATION_OR_MODULE_AUGMENTATION',
	'JAN_CSAA_CAP_014_SOURCE_MAP_OR_SOURCE_ORIGIN_CORRELATION',
	'GENERATED_SOURCE_LINEAGE_BEYOND_RETAINED_ORIGIN_FACTS',
	'JAN_CSAA_CAP_029_SEMANTIC_QUERY',
	'JAN_CSAA_CAP_030_CODE_SLICE',
	'JAN_CSAA_CAP_031_CHANGE_IMPACT',
	'JAN_CSAA_CAP_032_SEMANTIC_COMPARISON',
	'DWP_004_DWP_005_OR_DWP_006_COMPLETION',
	'JAN_CSAA_007_REGISTERED_OPERATION_OR_OPERATION_RESPONSE_ENVELOPE',
	'COMPILER_CONTEXT_OR_CONTEXT_ONLY_TARGET_FILESYSTEM_CURRENTNESS',
	'PERSISTENT_FRESHNESS_OR_CROSS_REVISION_CURRENTNESS',
	'WORKING_CHANGE_MERGE_BASE_TARGET_REVISION_OR_CANDIDATE_MERGE_BINDING',
	'RECOGNIZED_ARCHITECTURE_ARCHITECTURE_DISCOVERY_OR_ARCHITECTURE_VIOLATION',
	'ORPHAN_DEAD_CODE_IRRELEVANCE_NON_IMPACT_OR_SAFE_REMOVAL',
	'WHOLE_PROGRAM_BEHAVIORAL_FRAMEWORK_DYNAMIC_ENTRY_OR_RUNTIME_CLOSURE',
	'BEHAVIORAL_PRESERVATION_OR_TEST_SELECTION_PROOF',
	'RULE_FINDING_SEVERITY_GATE_DESIGN_MERGE_REMEDIATION_OR_DISPOSITION_AUTHORITY'
] as const);

export interface ModuleResolutionTraceReportImporterSelector {
	/** Canonical repository-relative source path containing one exact value, non-type-only IMPORT. */
	readonly logicalPath: string;
	/** Canonical repository-relative config path for the exact semantic Program. */
	readonly projectConfigPath: string;
	/** UTF-16 code-unit start of the exact semantic string-literal node, including its quote. */
	readonly specifierNodeStart: number;
}

export interface ModuleResolutionTraceReportRequest {
	readonly budgets: ModuleResolutionTraceReportBudgets;
	readonly importer: ModuleResolutionTraceReportImporterSelector;
	readonly operationVersion: typeof MODULE_RESOLUTION_TRACE_REPORT_OPERATION_VERSION;
	/** One bare frozen-workspace package name selected through one value, non-type-only literal root IMPORT. */
	readonly packageName: string;
	readonly schemaVersion: typeof MODULE_RESOLUTION_TRACE_REPORT_REQUEST_SCHEMA_VERSION;
	/** Explicit bounded semantic subject closure; no workspace project is inferred silently. */
	readonly subjectProjectConfigPaths: readonly string[];
}

export type ModuleResolutionTraceReportStage =
	| 'REQUEST'
	| 'SUBJECT'
	| 'SEMANTIC_SNAPSHOT'
	| 'PROJECT_CONTEXT'
	| 'CONDITIONAL_EXPORT'
	| 'MODULE_RESOLUTION_TRACE'
	| 'CURRENTNESS'
	| 'RESULT';

export interface ModuleResolutionTraceReportDiagnostic {
	readonly code: string;
	readonly message: string;
	readonly path: string | null;
	readonly phase: string | null;
	readonly severity: 'INFO' | 'WARNING' | 'ERROR' | null;
	readonly source:
		| 'REPORT'
		| 'SUBJECT'
		| 'SEMANTIC_SNAPSHOT'
		| 'PROJECT_CONTEXT'
		| 'CONDITIONAL_EXPORT'
		| 'MODULE_RESOLUTION_TRACE'
		| 'CURRENTNESS';
}

export interface ModuleResolutionTraceReportStageOutcomes {
	readonly conditionalExport: {
		readonly diagnosticCodes: readonly string[];
		readonly outcome: 'partial';
	};
	readonly currentness: {
		readonly diagnosticCodes: readonly string[];
		readonly state: 'CURRENT_FOR_CAPTURED_SUBJECT' | 'STALE' | 'UNAVAILABLE';
	};
	readonly moduleResolutionTrace: {
		readonly diagnosticCodes: readonly string[];
		readonly outcome: 'partial';
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

export interface ModuleResolutionTraceReportResult {
	readonly capability: {
		readonly architectureDiscovery: 'NOT_CLAIMED';
		readonly changeImpact: 'NOT_CLAIMED';
		readonly codeSlice: 'NOT_CLAIMED';
		readonly id: 'JAN-CSAA-CAP-011';
		readonly semanticComparison: 'NOT_CLAIMED';
		readonly semanticQuery: 'NOT_CLAIMED';
		readonly status: 'PARTIAL';
	};
	/** Facade currentness is separate from, and does not alter, embedded predecessor fields. */
	readonly currentness: {
		readonly changedPaths: readonly string[];
		readonly compilerCapture: 'NOT_ASSESSED';
		readonly contextOnlyTarget: 'NOT_ASSESSED';
		readonly diagnosticCodes: readonly string[];
		readonly scope: 'SELECTED_CAPTURED_SUBJECT_ONLY';
		readonly state: 'CURRENT_FOR_CAPTURED_SUBJECT' | 'STALE' | 'UNAVAILABLE';
	};
	readonly evidence: {
		readonly conditionalExportResolution: ConditionalExportResolutionSnapshot;
		readonly encoding: 'FULL_VALIDATED_PROJECT_CONTEXT_CONDITIONAL_EXPORT_DECISION_AND_MODULE_RESOLUTION_TRACE';
		readonly moduleResolutionTrace: ModuleResolutionTraceSnapshot;
		readonly projectContextGraph: ProjectContextGraphSnapshot;
	};
	readonly facadeNonclaims: typeof MODULE_RESOLUTION_TRACE_REPORT_NONCLAIMS;
	readonly importer: {
		readonly logicalPath: string;
		readonly projectConfigPath: string;
		readonly semanticModuleResolutionId: string;
		readonly specifier: string;
		readonly specifierNodeStart: number;
	};
	readonly interpretation: 'SELECTED_VALIDATED_CAPTURE_BOUND_MODULE_RESOLUTION_TRACE';
	readonly predecessorNonclaims: typeof MODULE_RESOLUTION_TRACE_REPORT_PREDECESSOR_NONCLAIMS;
	readonly resolvedTarget: {
		readonly contentSha256: string;
		readonly extension: '.d.ts' | '.d.mts' | '.d.cts';
		readonly logicalPath: string;
		readonly originalResolvedLogicalPath: string;
		readonly packageExportTarget: string;
	};
	readonly resolverEnvironment: ModuleResolutionTraceSnapshot['resolverEnvironment'];
	readonly schemaVersion: typeof MODULE_RESOLUTION_TRACE_REPORT_RESULT_SCHEMA_VERSION;
	readonly selection: typeof MODULE_RESOLUTION_TRACE_REPORT_SELECTION;
	readonly semanticSnapshotSummary: {
		readonly id: SemanticSnapshotId;
		readonly programs: number;
		readonly projects: number;
		readonly sources: number;
	};
}

export interface ModuleResolutionTraceReportPartialOutcome {
	readonly diagnostics: readonly ModuleResolutionTraceReportDiagnostic[];
	readonly operationVersion: typeof MODULE_RESOLUTION_TRACE_REPORT_OPERATION_VERSION;
	readonly outcome: 'partial';
	readonly request: ModuleResolutionTraceReportRequest;
	readonly result: ModuleResolutionTraceReportResult;
	readonly schemaVersion: typeof MODULE_RESOLUTION_TRACE_REPORT_SCHEMA_VERSION;
	readonly stageOutcomes: ModuleResolutionTraceReportStageOutcomes;
	readonly state: 'partial';
	readonly subject: SubjectDescriptor;
}

export type ModuleResolutionTraceReportFailureState =
	'failed' | 'incompatible' | 'resource-refused';

export interface ModuleResolutionTraceReportUnavailableOutcome {
	readonly code: string;
	readonly diagnostics: readonly ModuleResolutionTraceReportDiagnostic[];
	readonly facadeNonclaims: typeof MODULE_RESOLUTION_TRACE_REPORT_NONCLAIMS;
	readonly operationVersion: typeof MODULE_RESOLUTION_TRACE_REPORT_OPERATION_VERSION;
	readonly outcome: 'unavailable';
	readonly predecessorNonclaims: typeof MODULE_RESOLUTION_TRACE_REPORT_PREDECESSOR_NONCLAIMS;
	readonly request?: ModuleResolutionTraceReportRequest;
	readonly schemaVersion: typeof MODULE_RESOLUTION_TRACE_REPORT_SCHEMA_VERSION;
	readonly stage: ModuleResolutionTraceReportStage;
	readonly state: ModuleResolutionTraceReportFailureState;
	readonly subject?: SubjectDescriptor;
}

export type ModuleResolutionTraceReportOutcome =
	ModuleResolutionTraceReportPartialOutcome | ModuleResolutionTraceReportUnavailableOutcome;
