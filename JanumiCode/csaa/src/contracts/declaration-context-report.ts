import {
	DECLARATION_CONTEXT_ANALYSIS_NONCLAIMS,
	DECLARATION_CONTEXT_ANALYSIS_SELECTION,
	type DeclarationContextAnalysisBudgets,
	type DeclarationContextAnalysisSnapshot
} from './declaration-context-analysis.js';
import type { ConditionalExportResolutionSnapshot } from './conditional-export-resolution.js';
import {
	MODULE_RESOLUTION_TRACE_REPORT_PREDECESSOR_NONCLAIMS,
	MODULE_RESOLUTION_TRACE_REPORT_SAFETY_CEILINGS,
	MODULE_RESOLUTION_TRACE_REPORT_SELECTION,
	type ModuleResolutionTraceReportBudgets,
	type ModuleResolutionTraceReportImporterSelector
} from './module-resolution-trace-report.js';
import type { ModuleResolutionTraceSnapshot } from './module-resolution-trace.js';
import type { ProjectContextGraphSnapshot } from './project-context-graph.js';
import type { SemanticSnapshotId } from './semantic.js';
import type { SubjectCompleteness, SubjectDescriptor } from './subject.js';

/**
 * Preliminary coding-agent report over the already implemented partial CAP-013 declaration slice
 * and its CAP-010/CAP-012/CAP-011 predecessors. This is neither a registered JAN-CSAA-007
 * operation envelope nor DWP-003/DWP-004/DWP-005/DWP-006 completion evidence.
 */
export const DECLARATION_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION =
	'jan-csaa-declaration-context-report-request/0.1.0' as const;
export const DECLARATION_CONTEXT_REPORT_SCHEMA_VERSION =
	'jan-csaa-declaration-context-report/0.1.0' as const;
export const DECLARATION_CONTEXT_REPORT_RESULT_SCHEMA_VERSION =
	'jan-csaa-declaration-context-report-result/0.1.0' as const;
export const DECLARATION_CONTEXT_REPORT_OPERATION_VERSION =
	'jan-csaa-report-declaration-context/0.1.0' as const;

export const DECLARATION_CONTEXT_REPORT_SELECTION = Object.freeze({
	declarationContext: DECLARATION_CONTEXT_ANALYSIS_SELECTION,
	moduleResolution: MODULE_RESOLUTION_TRACE_REPORT_SELECTION
} as const);

export interface DeclarationContextReportBudgets extends Omit<
	ModuleResolutionTraceReportBudgets,
	'maxResultBytes'
> {
	readonly declarationContext: DeclarationContextAnalysisBudgets;
	/** Maximum admitted partial-result bytes, including the command terminal LF. */
	readonly maxResultBytes: number;
}

/** Absolute admission ceilings, never caller defaults, performance targets, or SLOs. */
export const DECLARATION_CONTEXT_REPORT_SAFETY_CEILINGS = Object.freeze({
	...MODULE_RESOLUTION_TRACE_REPORT_SAFETY_CEILINGS,
	declarationContext: Object.freeze({
		maxAliasHops: 1_000_000,
		maxArtifacts: 1_000_000,
		maxCompilerInputAttempts: 9_000_000,
		maxDeclarations: 5_000_000,
		maxDiagnostics: 100_000,
		maxDurationMs: 3_600_000,
		maxExportSymbols: 5_000_000,
		maxInputRecords: 10_000_000,
		maxInputStringCharacters: 1_000_000_000,
		maxOutputRecords: 20_000_000,
		maxParsedArtifactAstNodes: 5_000_000,
		maxProgramAstNodes: 5_000_000,
		maxProgramReadBytes: 536_870_912,
		maxProgramSourceFiles: 100_000,
		maxReadBytes: 536_870_912,
		maxRelations: 20_000_000,
		maxTraversalSteps: 50_000_000
	})
} satisfies DeclarationContextReportBudgets);

export const DECLARATION_CONTEXT_REPORT_PREDECESSOR_NONCLAIMS = Object.freeze({
	...MODULE_RESOLUTION_TRACE_REPORT_PREDECESSOR_NONCLAIMS,
	declarationContextAnalysis: DECLARATION_CONTEXT_ANALYSIS_NONCLAIMS
} as const);

const DECLARATION_CONTEXT_REPORT_APPLICABLE_NONCLAIMS = Object.freeze(
	DECLARATION_CONTEXT_ANALYSIS_NONCLAIMS.filter(
		(nonclaim) => nonclaim !== 'CURRENTNESS_OR_FRESHNESS'
	)
);

/** CAP-013 nonclaims remain inherited; the facade can only add restrictions. */
export const DECLARATION_CONTEXT_REPORT_NONCLAIMS = Object.freeze([
	...DECLARATION_CONTEXT_REPORT_APPLICABLE_NONCLAIMS,
	'FULL_JAN_CSAA_CAP_010_011_012_OR_013_CONFORMANCE',
	'FULL_JAN_CSAA_007_008_009_010_011_012_OR_013_CONFORMANCE',
	'DWP_003_DWP_004_DWP_005_OR_DWP_006_COMPLETION',
	'JAN_CSAA_007_REGISTERED_OPERATION_OR_OPERATION_RESPONSE_ENVELOPE',
	'IMPORTER_POPULATION_BEYOND_ONE_EXACT_REQUESTED_VALUE_NON_TYPE_ONLY_LITERAL_IMPORT',
	'EXPORT_BINDING_POPULATION_BEYOND_ONE_EXACT_REQUESTED_NAME',
	'CONDITIONS_MODES_PLATFORMS_OR_EXPORT_SUBPATHS_BEYOND_FIXED_TYPES_IMPORT_NODE_ROOT_SLICE',
	'COMPILER_CONTEXT_OR_CONTEXT_ONLY_TARGET_FILESYSTEM_CURRENTNESS',
	'PERSISTENT_FRESHNESS_OR_CROSS_REVISION_CURRENTNESS',
	'WORKING_CHANGE_MERGE_BASE_TARGET_REVISION_OR_CANDIDATE_MERGE_BINDING',
	'JAN_CSAA_CAP_029_SEMANTIC_QUERY',
	'JAN_CSAA_CAP_030_CODE_SLICE',
	'JAN_CSAA_CAP_031_CHANGE_IMPACT',
	'JAN_CSAA_CAP_032_SEMANTIC_COMPARISON',
	'RECOGNIZED_ARCHITECTURE_ARCHITECTURE_DISCOVERY_OR_ARCHITECTURE_VIOLATION',
	'ORPHAN_DEAD_CODE_IRRELEVANCE_NON_IMPACT_OR_SAFE_REMOVAL',
	'WHOLE_PROGRAM_BEHAVIORAL_FRAMEWORK_DYNAMIC_ENTRY_OR_RUNTIME_CLOSURE',
	'BEHAVIORAL_PRESERVATION_OR_TEST_SELECTION_PROOF',
	'RULE_FINDING_SEVERITY_GATE_DESIGN_MERGE_REMEDIATION_OR_DISPOSITION_AUTHORITY'
] as const);

export interface DeclarationContextReportRequest {
	readonly budgets: DeclarationContextReportBudgets;
	/** Exact Unicode-scalar package-root export name selected by public TypeScript checker APIs. */
	readonly exportName: string;
	readonly importer: ModuleResolutionTraceReportImporterSelector;
	readonly operationVersion: typeof DECLARATION_CONTEXT_REPORT_OPERATION_VERSION;
	/** One bare frozen-workspace package root selected through the exact importer occurrence. */
	readonly packageName: string;
	readonly schemaVersion: typeof DECLARATION_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION;
	/** Explicit bounded semantic subject closure; no workspace project is inferred silently. */
	readonly subjectProjectConfigPaths: readonly string[];
}

export type DeclarationContextReportStage =
	'REQUEST' | 'PREDECESSOR_PIPELINE' | 'DECLARATION_CONTEXT' | 'CURRENTNESS' | 'RESULT';

export interface DeclarationContextReportDiagnostic {
	readonly code: string;
	readonly message: string;
	readonly path: string | null;
	readonly phase: string | null;
	readonly predecessorSource:
		| 'REPORT'
		| 'SUBJECT'
		| 'SEMANTIC_SNAPSHOT'
		| 'PROJECT_CONTEXT'
		| 'CONDITIONAL_EXPORT'
		| 'MODULE_RESOLUTION_TRACE'
		| 'CURRENTNESS'
		| null;
	readonly severity: 'INFO' | 'WARNING' | 'ERROR' | null;
	readonly source: 'REPORT' | 'PREDECESSOR_PIPELINE' | 'DECLARATION_CONTEXT' | 'CURRENTNESS';
}

export interface DeclarationContextReportStageOutcomes {
	readonly currentness: {
		readonly diagnosticCodes: readonly string[];
		readonly state: 'CURRENT_FOR_CAPTURED_SUBJECT' | 'STALE' | 'UNAVAILABLE';
	};
	readonly declarationContext: {
		readonly diagnosticCodes: readonly string[];
		readonly outcome: 'partial';
	};
	readonly predecessorPipeline: {
		readonly conditionalExport: {
			readonly diagnosticCodes: readonly string[];
			readonly outcome: 'partial';
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
	};
}

export interface DeclarationContextReportResult {
	readonly binding: {
		readonly aliasHops: number;
		readonly declarationArtifact: {
			readonly bytes: number;
			readonly contentSha256: string;
			readonly extension: '.d.cts' | '.d.mts' | '.d.ts';
			readonly logicalPath: string;
			readonly origin: 'WORKSPACE_BUILD_DECLARATION';
		};
		readonly declarationCount: number;
		readonly declarationKinds: readonly DeclarationContextAnalysisSnapshot['declarations'][number]['kind'][];
		readonly exportBindingId: string;
		readonly exportName: string;
		readonly mergeState: 'MERGED' | 'SINGLE';
		readonly resolutionKind: 'ALIASED_TO_TERMINAL_SYMBOL' | 'DIRECT_TERMINAL_SYMBOL';
		readonly terminalName: string;
		readonly terminalSymbolId: string;
	};
	readonly capability: {
		readonly architectureDiscovery: 'NOT_CLAIMED';
		readonly changeImpact: 'NOT_CLAIMED';
		readonly codeSlice: 'NOT_CLAIMED';
		readonly id: 'JAN-CSAA-CAP-013';
		readonly semanticComparison: 'NOT_CLAIMED';
		readonly semanticQuery: 'NOT_CLAIMED';
		readonly status: 'PARTIAL';
	};
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
		readonly declarationContextAnalysis: DeclarationContextAnalysisSnapshot;
		readonly encoding: 'FULL_VALIDATED_PROJECT_CONTEXT_CONDITIONAL_EXPORT_MODULE_RESOLUTION_AND_DECLARATION_CONTEXT';
		readonly moduleResolutionTrace: ModuleResolutionTraceSnapshot;
		readonly projectContextGraph: ProjectContextGraphSnapshot;
	};
	readonly facadeNonclaims: typeof DECLARATION_CONTEXT_REPORT_NONCLAIMS;
	readonly interpretation: 'SELECTED_VALIDATED_CAPTURE_BOUND_PACKAGE_ROOT_EXPORT_DECLARATION_CONTEXT';
	readonly predecessorNonclaims: typeof DECLARATION_CONTEXT_REPORT_PREDECESSOR_NONCLAIMS;
	readonly schemaVersion: typeof DECLARATION_CONTEXT_REPORT_RESULT_SCHEMA_VERSION;
	readonly selection: typeof DECLARATION_CONTEXT_REPORT_SELECTION;
	readonly semanticSnapshotSummary: {
		readonly id: SemanticSnapshotId;
		readonly programs: number;
		readonly projects: number;
		readonly sources: number;
	};
}

export interface DeclarationContextReportPartialOutcome {
	readonly diagnostics: readonly DeclarationContextReportDiagnostic[];
	readonly operationVersion: typeof DECLARATION_CONTEXT_REPORT_OPERATION_VERSION;
	readonly outcome: 'partial';
	readonly request: DeclarationContextReportRequest;
	readonly result: DeclarationContextReportResult;
	readonly schemaVersion: typeof DECLARATION_CONTEXT_REPORT_SCHEMA_VERSION;
	readonly stageOutcomes: DeclarationContextReportStageOutcomes;
	readonly state: 'partial';
	readonly subject: SubjectDescriptor;
}

export type DeclarationContextReportFailureState = 'failed' | 'incompatible' | 'resource-refused';

export interface DeclarationContextReportUnavailableOutcome {
	readonly code: string;
	readonly diagnostics: readonly DeclarationContextReportDiagnostic[];
	readonly facadeNonclaims: typeof DECLARATION_CONTEXT_REPORT_NONCLAIMS;
	readonly operationVersion: typeof DECLARATION_CONTEXT_REPORT_OPERATION_VERSION;
	readonly outcome: 'unavailable';
	readonly predecessorNonclaims: typeof DECLARATION_CONTEXT_REPORT_PREDECESSOR_NONCLAIMS;
	readonly request?: DeclarationContextReportRequest;
	readonly schemaVersion: typeof DECLARATION_CONTEXT_REPORT_SCHEMA_VERSION;
	readonly stage: DeclarationContextReportStage;
	readonly state: DeclarationContextReportFailureState;
	readonly subject?: SubjectDescriptor;
}

export type DeclarationContextReportOutcome =
	DeclarationContextReportPartialOutcome | DeclarationContextReportUnavailableOutcome;
