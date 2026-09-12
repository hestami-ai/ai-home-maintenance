import {
	CALL_GRAPH_CAPABILITY,
	CALL_GRAPH_CAPABILITY_STATUS,
	type CallGraphSnapshot
} from './call-graph.js';
import {
	CALL_GRAPH_REPORT_NONCLAIMS,
	CALL_GRAPH_REPORT_SAFETY_CEILINGS,
	type CallGraphReportGraphBudgets
} from './call-graph-report.js';
import {
	MODULE_DEPENDENCY_GRAPH_CAPABILITY,
	MODULE_DEPENDENCY_GRAPH_CAPABILITY_STATUS,
	type ModuleDependencyGraphSnapshot
} from './graph.js';
import {
	LOGICAL_GRAPH_COMPOSITION_CAPABILITY,
	LOGICAL_GRAPH_COMPOSITION_CAPABILITY_STATUS,
	LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_007_CONFORMANCE,
	LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_008_CONFORMANCE,
	LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_009_CONFORMANCE,
	LOGICAL_GRAPH_COMPOSITION_GRAPH_AUTHORITY,
	LOGICAL_GRAPH_COMPOSITION_NONCLAIMS,
	LOGICAL_GRAPH_COMPOSITION_SELECTION,
	type LogicalGraphCompositionBudgets,
	type LogicalGraphCompositionCoverage,
	type LogicalGraphCompositionSnapshot
} from './logical-graph-composition.js';
import {
	MODULE_DEPENDENCY_REPORT_NONCLAIMS,
	MODULE_DEPENDENCY_REPORT_SAFETY_CEILINGS,
	type ModuleDependencyReportGraphBudgets
} from './module-dependency-report.js';
import {
	PROJECT_CONTEXT_REPORT_NONCLAIMS,
	PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS,
	type ProjectContextReportBudgets,
	type ProjectContextReportDiagnostic
} from './project-context-report.js';
import type { ProjectContextGraphSnapshot } from './project-context-graph.js';
import type { SemanticSnapshotId } from './semantic.js';
import type { SubjectCompleteness, SubjectDescriptor } from './subject.js';

/**
 * Preliminary coding-agent facade over one exact same-subject module-dependency and call-layer
 * composition. It is not a query surface, a registered JAN-CSAA-007 operation envelope, or
 * DWP-004/DWP-005/DWP-006 completion evidence.
 */
export const LOGICAL_GRAPH_COMPOSITION_REPORT_REQUEST_SCHEMA_VERSION =
	'jan-csaa-logical-graph-composition-report-request/0.1.0' as const;
export const LOGICAL_GRAPH_COMPOSITION_REPORT_SCHEMA_VERSION =
	'jan-csaa-logical-graph-composition-report/0.1.0' as const;
export const LOGICAL_GRAPH_COMPOSITION_REPORT_RESULT_SCHEMA_VERSION =
	'jan-csaa-logical-graph-composition-report-result/0.1.0' as const;
export const LOGICAL_GRAPH_COMPOSITION_REPORT_OPERATION_VERSION =
	'jan-csaa-report-logical-graph-composition/0.1.0' as const;
export const LOGICAL_GRAPH_COMPOSITION_REPORT_AUTHORITY = 'NONE' as const;
export const LOGICAL_GRAPH_COMPOSITION_REPORT_AUTHORITY_TRANSFER = 'NONE' as const;
export const LOGICAL_GRAPH_COMPOSITION_REPORT_GATE_EFFECT = 'NONE' as const;
export const LOGICAL_GRAPH_COMPOSITION_REPORT_CAPABILITY_ID = LOGICAL_GRAPH_COMPOSITION_CAPABILITY;
export const LOGICAL_GRAPH_COMPOSITION_REPORT_FULL_CAPABILITY = 'NOT_CLAIMED' as const;

export const LOGICAL_GRAPH_COMPOSITION_REPORT_SELECTION = Object.freeze({
	composition: LOGICAL_GRAPH_COMPOSITION_SELECTION,
	contributingLayers: Object.freeze(['MODULE_DEPENDENCY', 'CALL'] as const),
	dependencyCruiserCorroboration: 'NOT_RUN',
	evidence:
		'FULL_VALIDATED_SAME_SUBJECT_PROJECT_CONTEXT_MODULE_DEPENDENCY_CALL_AND_REFERENCE_ONLY_COMPOSITION',
	semanticCapabilities: Object.freeze(['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX', 'TS_TYPE'] as const),
	subjectPopulation: 'EXPLICIT_PROJECT_CLOSURE_CAPTURED_IN_ONE_FROZEN_SUBJECT'
} as const);

export interface LogicalGraphCompositionReportBudgets extends Omit<
	ProjectContextReportBudgets,
	'maxResultBytes'
> {
	/** Maximum admitted partial-result bytes, including the command terminal LF. */
	readonly maxResultBytes: number;
	readonly callGraph: CallGraphReportGraphBudgets;
	readonly logicalGraphComposition: LogicalGraphCompositionBudgets;
	readonly moduleDependencyGraph: ModuleDependencyReportGraphBudgets;
}

/** Absolute admission ceilings, never defaults, performance targets, or completeness promises. */
export const LOGICAL_GRAPH_COMPOSITION_REPORT_SAFETY_CEILINGS = Object.freeze({
	...PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS,
	/**
	 * The exact seven-project JPWB composition witness currently exceeds the narrower standalone
	 * call-report edge ceiling. This facade retains a finite ceiling while admitting that measured
	 * predecessor population and the full detached evidence envelope.
	 */
	// Finite headroom above the measured seven-project exact-evidence envelope.
	maxResultBytes: 320 * 1024 * 1024,
	callGraph: Object.freeze({
		...CALL_GRAPH_REPORT_SAFETY_CEILINGS.callGraph,
		maxEdges: 75_000
	}),
	projectContext: Object.freeze({
		...PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS.projectContext,
		/** Successor-only TS_TYPE capture budget; the public CAP-010 ceiling remains unchanged. */
		maxInputRecords: 50_000_000
	}),
	logicalGraphComposition: Object.freeze({
		maxCallEdges: 75_000,
		maxCallNodes: CALL_GRAPH_REPORT_SAFETY_CEILINGS.callGraph.maxNodes,
		maxConflictRecords: 0 as const,
		maxDiagnostics: 100_000,
		maxEligibleSourceNodes: 100_000,
		/** Finite enriched TS_TYPE plus two-layer graph input-tree ceiling for this facade only. */
		maxInputRecords: 50_000_000,
		maxInputStringCharacters: 1_000_000_000,
		maxLinks: 100_000,
		maxModuleDependencyEdges: MODULE_DEPENDENCY_REPORT_SAFETY_CEILINGS.moduleDependency.maxEdges,
		maxModuleDependencyNodes: MODULE_DEPENDENCY_REPORT_SAFETY_CEILINGS.moduleDependency.maxNodes,
		maxOutputRecords: 10_000_000,
		maxTraversalSteps: 10_000_000,
		maxUnmatchedRecords: 0 as const
	}),
	moduleDependencyGraph: MODULE_DEPENDENCY_REPORT_SAFETY_CEILINGS.moduleDependency
} satisfies LogicalGraphCompositionReportBudgets);

export const LOGICAL_GRAPH_COMPOSITION_REPORT_PREDECESSOR_NONCLAIMS = Object.freeze({
	callGraphReport: CALL_GRAPH_REPORT_NONCLAIMS,
	logicalGraphComposition: LOGICAL_GRAPH_COMPOSITION_NONCLAIMS,
	moduleDependencyReport: MODULE_DEPENDENCY_REPORT_NONCLAIMS,
	projectContextReport: PROJECT_CONTEXT_REPORT_NONCLAIMS
} as const);

/** Embedded predecessor limitations remain authoritative; this facade only narrows claims. */
export const LOGICAL_GRAPH_COMPOSITION_REPORT_NONCLAIMS = Object.freeze([
	'FULL_JAN_CSAA_CAP_009_GRAPH_COMPOSITION',
	'UNIVERSAL_OR_MATERIALIZED_CODE_PROPERTY_GRAPH',
	'LAYERS_BEYOND_MODULE_DEPENDENCY_AND_CALL',
	'CROSS_LAYER_TRAVERSAL_OR_UNIFIED_AUTHORITATIVE_EDGE_SET',
	'SEMANTIC_EQUIVALENCE_BEYOND_EXACT_SOURCE_OCCURRENCE',
	'IMPORT_CAUSES_CALL_OR_CALL_BELONGS_TO_DEPENDENCY',
	'EXACT_OR_EXCLUSIVE_CALL_TARGETS_OR_EXACT_CALL_DISPATCH',
	'ENTRY_MECHANISM_OR_POPULATION_CLOSURE',
	'WHOLE_REPOSITORY_WHOLE_PROGRAM_OR_BEHAVIORAL_REACHABILITY',
	'JAN_CSAA_CAP_026_ARCHITECTURE_DISCOVERY',
	'JAN_CSAA_CAP_029_SEMANTIC_QUERY',
	'JAN_CSAA_CAP_030_CODE_SLICE',
	'JAN_CSAA_CAP_031_CHANGE_IMPACT',
	'JAN_CSAA_CAP_032_SEMANTIC_COMPARISON',
	'DWP_004_DWP_005_OR_DWP_006_COMPLETION',
	'G4_G5_OR_G6_GATE_PASS',
	'FULL_JAN_CSAA_007_008_009_010_OR_011_CONFORMANCE',
	'JAN_CSAA_007_REGISTERED_OPERATION_OR_OPERATION_RESPONSE_ENVELOPE',
	'PROVIDER_QUALIFICATION_OR_DEPENDENCY_CRUISER_CORROBORATION',
	'PERSISTED_OR_DESERIALIZED_CAPTURE_REPLAY',
	'PERSISTENT_FRESHNESS_OR_CROSS_REVISION_CURRENTNESS',
	'WORKING_CHANGE_MERGE_BASE_TARGET_REVISION_OR_CANDIDATE_MERGE_BINDING',
	'ORPHAN_DEAD_CODE_IRRELEVANCE_NON_IMPACT_OR_SAFE_REMOVAL',
	'RECOGNIZED_ARCHITECTURE_ARCHITECTURE_VIOLATION_OR_LAYER_CONFORMANCE',
	'RUNTIME_EXECUTION_BEHAVIOR_OR_TEST_SELECTION_PROOF',
	'RULE_QUERY_FINDING_SEVERITY_GATE_DESIGN_MERGE_REMEDIATION_OR_DISPOSITION_AUTHORITY'
] as const);

export interface LogicalGraphCompositionReportRequest {
	readonly budgets: LogicalGraphCompositionReportBudgets;
	readonly operationVersion: typeof LOGICAL_GRAPH_COMPOSITION_REPORT_OPERATION_VERSION;
	readonly schemaVersion: typeof LOGICAL_GRAPH_COMPOSITION_REPORT_REQUEST_SCHEMA_VERSION;
	/** Explicit bounded semantic closure; no workspace project is inferred silently. */
	readonly subjectProjectConfigPaths: readonly string[];
}

export type LogicalGraphCompositionReportStage =
	| 'REQUEST'
	| 'PREDECESSOR_PIPELINE'
	| 'MODULE_DEPENDENCY_GRAPH'
	| 'CALL_GRAPH'
	| 'LOGICAL_GRAPH_COMPOSITION'
	| 'CURRENTNESS'
	| 'RESULT';

export interface LogicalGraphCompositionReportDiagnostic {
	readonly code: string;
	readonly message: string;
	readonly path: string | null;
	readonly phase: string | null;
	readonly predecessorSource: Exclude<
		ProjectContextReportDiagnostic['source'],
		'CURRENTNESS'
	> | null;
	readonly severity: 'INFO' | 'WARNING' | 'ERROR' | null;
	readonly source:
		| 'REPORT'
		| 'PREDECESSOR_PIPELINE'
		| 'MODULE_DEPENDENCY_GRAPH'
		| 'CALL_GRAPH'
		| 'LOGICAL_GRAPH_COMPOSITION'
		| 'CURRENTNESS';
}

export interface LogicalGraphCompositionReportStageOutcomes {
	readonly callGraph: { readonly diagnosticCodes: readonly string[]; readonly outcome: 'partial' };
	readonly currentness: {
		readonly diagnosticCodes: readonly string[];
		readonly state: 'CURRENT_FOR_CAPTURED_SUBJECT' | 'STALE' | 'UNAVAILABLE';
	};
	readonly logicalGraphComposition: {
		readonly diagnosticCodes: readonly string[];
		readonly outcome: 'partial';
	};
	readonly moduleDependencyGraph: {
		readonly diagnosticCodes: readonly string[];
		readonly outcome: 'complete' | 'partial';
	};
	readonly predecessorPipeline: {
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

export interface LogicalGraphCompositionReportResult {
	readonly capability: {
		readonly architectureDiscovery: 'NOT_CLAIMED';
		readonly changeImpact: 'NOT_CLAIMED';
		readonly codeSlice: 'NOT_CLAIMED';
		readonly fullJanCsaaCapability009GraphComposition: typeof LOGICAL_GRAPH_COMPOSITION_REPORT_FULL_CAPABILITY;
		readonly fullJanCsaa007Conformance: typeof LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_007_CONFORMANCE;
		readonly fullJanCsaa008Conformance: typeof LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_008_CONFORMANCE;
		readonly fullJanCsaa009Conformance: typeof LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_009_CONFORMANCE;
		readonly graphAuthority: typeof LOGICAL_GRAPH_COMPOSITION_GRAPH_AUTHORITY;
		readonly id: typeof LOGICAL_GRAPH_COMPOSITION_REPORT_CAPABILITY_ID;
		readonly semanticComparison: 'NOT_CLAIMED';
		readonly semanticQuery: 'NOT_CLAIMED';
		readonly status: typeof LOGICAL_GRAPH_COMPOSITION_CAPABILITY_STATUS;
	};
	readonly contributingLayers: {
		readonly callGraph: {
			readonly capability: typeof CALL_GRAPH_CAPABILITY;
			readonly edges: number;
			readonly health: CallGraphSnapshot['health'];
			readonly limitations: number;
			readonly nodes: number;
			readonly status: typeof CALL_GRAPH_CAPABILITY_STATUS;
		};
		readonly moduleDependencyGraph: {
			readonly capability: typeof MODULE_DEPENDENCY_GRAPH_CAPABILITY;
			readonly edges: number;
			readonly health: ModuleDependencyGraphSnapshot['health'];
			readonly limitations: number;
			readonly nodes: number;
			readonly status: typeof MODULE_DEPENDENCY_GRAPH_CAPABILITY_STATUS;
		};
	};
	readonly coverage: LogicalGraphCompositionCoverage & {
		readonly closure: 'OPEN';
		readonly conflicts: number;
		readonly health: 'PARTIAL';
		readonly inheritedLimitations: number;
		readonly layers: 2;
		readonly unmatchedSources: number;
	};
	readonly currentness: {
		readonly changedPaths: readonly string[];
		readonly diagnosticCodes: readonly string[];
		readonly scope: 'SELECTED_CAPTURED_SUBJECT_ONLY';
		readonly state: 'CURRENT_FOR_CAPTURED_SUBJECT' | 'STALE' | 'UNAVAILABLE';
	};
	readonly evidence: {
		readonly callGraph: CallGraphSnapshot;
		readonly composition: LogicalGraphCompositionSnapshot;
		readonly encoding: 'FULL_VALIDATED_SAME_SUBJECT_PROJECT_CONTEXT_MODULE_CALL_AND_REFERENCE_ONLY_COMPOSITION';
		readonly moduleDependencyGraph: ModuleDependencyGraphSnapshot;
		readonly projectContextGraph: ProjectContextGraphSnapshot;
	};
	readonly facadeNonclaims: typeof LOGICAL_GRAPH_COMPOSITION_REPORT_NONCLAIMS;
	readonly interpretation: 'SELECTED_VALIDATED_SAME_SUBJECT_PARTIAL_OPEN_TWO_LAYER_REFERENCE_COMPOSITION';
	readonly predecessorNonclaims: typeof LOGICAL_GRAPH_COMPOSITION_REPORT_PREDECESSOR_NONCLAIMS;
	readonly schemaVersion: typeof LOGICAL_GRAPH_COMPOSITION_REPORT_RESULT_SCHEMA_VERSION;
	readonly selection: typeof LOGICAL_GRAPH_COMPOSITION_REPORT_SELECTION;
	readonly semanticSnapshotSummary: {
		readonly astNodes: number;
		readonly id: SemanticSnapshotId;
		readonly invocations: number;
		readonly programs: number;
		readonly projects: number;
		readonly sources: number;
		readonly types: number;
	};
}

export interface LogicalGraphCompositionReportPartialOutcome {
	readonly analysisAuthority: typeof LOGICAL_GRAPH_COMPOSITION_REPORT_AUTHORITY;
	readonly authorityTransfer: typeof LOGICAL_GRAPH_COMPOSITION_REPORT_AUTHORITY_TRANSFER;
	readonly diagnostics: readonly LogicalGraphCompositionReportDiagnostic[];
	readonly gateEffect: typeof LOGICAL_GRAPH_COMPOSITION_REPORT_GATE_EFFECT;
	readonly operationVersion: typeof LOGICAL_GRAPH_COMPOSITION_REPORT_OPERATION_VERSION;
	readonly outcome: 'partial';
	readonly request: LogicalGraphCompositionReportRequest;
	readonly result: LogicalGraphCompositionReportResult;
	readonly schemaVersion: typeof LOGICAL_GRAPH_COMPOSITION_REPORT_SCHEMA_VERSION;
	readonly stageOutcomes: LogicalGraphCompositionReportStageOutcomes;
	readonly state: 'partial';
	readonly subject: SubjectDescriptor;
}

export type LogicalGraphCompositionReportFailureState =
	'failed' | 'incompatible' | 'resource-refused';

export interface LogicalGraphCompositionReportUnavailableOutcome {
	readonly analysisAuthority: typeof LOGICAL_GRAPH_COMPOSITION_REPORT_AUTHORITY;
	readonly authorityTransfer: typeof LOGICAL_GRAPH_COMPOSITION_REPORT_AUTHORITY_TRANSFER;
	readonly code: string;
	readonly diagnostics: readonly LogicalGraphCompositionReportDiagnostic[];
	readonly facadeNonclaims: typeof LOGICAL_GRAPH_COMPOSITION_REPORT_NONCLAIMS;
	readonly gateEffect: typeof LOGICAL_GRAPH_COMPOSITION_REPORT_GATE_EFFECT;
	readonly operationVersion: typeof LOGICAL_GRAPH_COMPOSITION_REPORT_OPERATION_VERSION;
	readonly outcome: 'unavailable';
	readonly predecessorNonclaims: typeof LOGICAL_GRAPH_COMPOSITION_REPORT_PREDECESSOR_NONCLAIMS;
	readonly request?: LogicalGraphCompositionReportRequest;
	readonly schemaVersion: typeof LOGICAL_GRAPH_COMPOSITION_REPORT_SCHEMA_VERSION;
	readonly stage: LogicalGraphCompositionReportStage;
	readonly state: LogicalGraphCompositionReportFailureState;
	readonly subject?: SubjectDescriptor;
}

export type LogicalGraphCompositionReportOutcome =
	LogicalGraphCompositionReportPartialOutcome | LogicalGraphCompositionReportUnavailableOutcome;
