export * from './contracts/inventory.js';
export * from './contracts/call-graph.js';
export * from './contracts/call-graph-report.js';
export * from './contracts/conditional-export-resolution.js';
export * from './contracts/declaration-context-analysis.js';
export * from './contracts/declaration-context-report.js';
export * from './contracts/source-origin-correlation.js';
export * from './contracts/arrow-command-census.js';
export * from './contracts/arrow-command-census-report.js';
export * from './contracts/command-handler-graph.js';
export * from './contracts/command-handler-graph-report.js';
export * from './contracts/command-event-contract-overlay.js';
export * from './contracts/command-event-contract-overlay-report.js';
export * from './contracts/command-dispatch-topology.js';
export * from './contracts/command-dispatch-topology-report.js';
export * from './contracts/guard-enforcement-ledger.js';
export * from './contracts/guard-enforcement-ledger-report.js';
export * from './contracts/guard-classification-overlay.js';
export * from './contracts/guard-classification-overlay-report.js';
export * from './contracts/read-write-access-graph.js';
export * from './contracts/read-write-access-report.js';
export * from './contracts/dependency-comparison.js';
export * from './contracts/dependency-cruiser.js';
export * from './contracts/graph.js';
export * from './contracts/logical-graph-composition.js';
export * from './contracts/logical-graph-composition-report.js';
export * from './contracts/semantic-source-query.js';
export * from './contracts/semantic-source-query-report.js';
export * from './contracts/module-resolution-trace.js';
export * from './contracts/module-resolution-trace-report.js';
export * from './contracts/module-dependency-report.js';
export * from './contracts/project-context-graph.js';
export * from './contracts/project-context-report.js';
export * from './contracts/semantic.js';
export * from './contracts/state-machine-graph.js';
export * from './contracts/state-machine-graph-report.js';
export * from './contracts/static-module-impact-candidate-report.js';
export * from './contracts/working-source-edit-impact-candidate-report.js';
export * from './contracts/structural-module-reachability-analysis.js';
export * from './contracts/structural-module-reachability-report.js';
export * from './contracts/structural-scc-analysis.js';
export * from './contracts/structural-scc-report.js';
export * from './contracts/subject.js';
export * from './contracts/working-change-set.js';
export * from './inventory/canonical.js';
export * from './inventory/collect-inventory.js';
export * from './inventory/project-subject-for-inventory.js';
export * from './inventory/render-inventory.js';
export * from './inventory/run-inventory.js';
export {
	GENERATED_CONTEXT_EVIDENCE_OPERATION_VERSION,
	runGeneratedContextEvidence,
	type GeneratedContextEvidenceDifference,
	type GeneratedContextEvidenceMode,
	type RunGeneratedContextEvidenceOptions,
	type RunGeneratedContextEvidenceResult
} from './application/run-generated-context-evidence.js';
export {
	observeSvelteKitSyncGenerator,
	RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH,
	RPH_DEMO_GENERATED_CONTEXT_PATH,
	RPH_DEMO_PROJECT_ROOT,
	SVELTE_KIT_GENERATOR_ENTRY,
	SVELTE_KIT_GENERATOR_MANIFEST,
	SVELTE_KIT_LOCKFILE,
	SVELTE_KIT_PACKAGE_NAME,
	SVELTE_KIT_SYNC_GENERATOR_ID,
	type SvelteKitSyncGeneratorObservation
} from './subject/svelte-kit-generator.js';
export * from './subject/resolve-working-subject.js';
export {
	buildStaticSemanticSnapshot,
	STATIC_SEMANTIC_SNAPSHOT_PROGRESS_SCHEMA_VERSION,
	type BuildStaticSemanticSnapshotRuntimeOptions,
	type StaticSemanticSnapshotProgressCounts,
	type StaticSemanticSnapshotProgressEvent,
	type StaticSemanticSnapshotProgressMemoryUsage,
	type StaticSemanticSnapshotProgressPhase,
	type StaticSemanticSnapshotProgressProject
} from './semantic/build-static-semantic-snapshot.js';
export {
	evaluateSemanticSourceQuery,
	evidencePairForTruth,
	semanticQueryAnd,
	semanticQueryNot,
	semanticQueryOr,
	truthForEvidencePair
} from './query/evaluate-semantic-source-query.js';
export { buildCallGraph } from './graph/build-call-graph.js';
export { buildReadWriteAccessGraph } from './graph/build-read-write-access-graph.js';
export {
	buildCommandHandlerGraph,
	COMMAND_HANDLER_GRAPH_PROGRESS_SCHEMA_VERSION,
	selectJpwbCommandHandlerRegistries,
	type BuildCommandHandlerGraphOptions,
	type CommandHandlerGraphProgressEvent,
	type CommandHandlerGraphProgressPhase
} from './graph/build-command-handler-graph.js';
export {
	buildCommandEventContractOverlay,
	selectJpwbCommandEventContractOverlayInputs
} from './graph/build-command-event-contract-overlay.js';
export {
	buildCommandDispatchTopology,
	COMMAND_DISPATCH_TOPOLOGY_PROGRESS_SCHEMA_VERSION,
	selectJpwbCommandDispatchTopology,
	type BuildCommandDispatchTopologyOptions,
	type CommandDispatchTopologyProgressEvent,
	type CommandDispatchTopologyProgressPhase
} from './graph/build-command-dispatch-topology.js';
export { buildGuardClassificationOverlay } from './graph/build-guard-classification-overlay.js';
export {
	buildGuardEnforcementLedgerArtifactSet,
	selectGuardEnforcementLedgerArtifactSet,
	validateGuardEnforcementLedgerArtifactSet
} from './providers/jpwb-guard-enforcement-ledger/artifact-set.js';
export {
	GUARD_ENFORCEMENT_LEDGER_PROGRESS_SCHEMA_VERSION,
	observeGuardEnforcementLedger,
	type GuardEnforcementLedgerProgressEvent,
	type GuardEnforcementLedgerProgressPhase,
	type ObserveGuardEnforcementLedgerDependencies,
	type ObserveGuardEnforcementLedgerOptions
} from './providers/jpwb-guard-enforcement-ledger/observe-guard-enforcement-ledger.js';
export { validateGuardEnforcementLedgerObservation } from './providers/jpwb-guard-enforcement-ledger/validate-guard-enforcement-ledger.js';
export { buildModuleDependencyGraph } from './graph/build-module-dependency-graph.js';
export { buildLogicalGraphComposition } from './graph/build-logical-graph-composition.js';
export { buildProjectContextGraph } from './graph/build-project-context-graph.js';
export {
	runProjectContextReport,
	PROJECT_CONTEXT_REPORT_PROGRESS_NONCLAIMS,
	PROJECT_CONTEXT_REPORT_PROGRESS_SCHEMA_VERSION,
	projectContextReportExitCode,
	type ProjectContextReportProgressEvent,
	type ProjectContextReportProgressObservation,
	type ProjectContextReportProgressObservationBasis,
	type ProjectContextReportProgressObservationMetric,
	type ProjectContextReportProgressPhase,
	type RunProjectContextReportOptions
} from './application/run-project-context-report.js';
export {
	PROJECT_CONTEXT_PROGRESS_MAX_BYTES,
	PROJECT_CONTEXT_PROGRESS_MAX_EVENTS,
	PROJECT_CONTEXT_PROGRESS_TRANSPORT_SCHEMA_VERSION,
	type ProjectContextProgressTransportTruncation
} from './application/project-context-progress-jsonl.js';
export { buildConditionalExportResolution } from './resolution/build-conditional-export-resolution.js';
export { buildModuleResolutionTrace } from './resolution/build-module-resolution-trace.js';

export {
	moduleResolutionTraceReportExitCode,
	runModuleResolutionTraceReport,
	MODULE_RESOLUTION_TRACE_REPORT_PROGRESS_NONCLAIMS,
	MODULE_RESOLUTION_TRACE_REPORT_PROGRESS_SCHEMA_VERSION,
	type ModuleResolutionTraceReportProgressEvent,
	type ModuleResolutionTraceReportProgressObservation,
	type ModuleResolutionTraceReportProgressPhase,
	type RunModuleResolutionTraceReportOptions
} from './application/run-module-resolution-trace-report.js';

export {
	MODULE_RESOLUTION_TRACE_PROGRESS_MAX_BYTES,
	MODULE_RESOLUTION_TRACE_PROGRESS_MAX_EVENTS,
	MODULE_RESOLUTION_TRACE_PROGRESS_TRANSPORT_SCHEMA_VERSION,
	type ModuleResolutionTraceProgressTransportTruncation
} from './application/module-resolution-trace-progress-jsonl.js';

export {
	moduleDependencyReportExitCode,
	runModuleDependencyReport,
	MODULE_DEPENDENCY_REPORT_PROGRESS_NONCLAIMS,
	MODULE_DEPENDENCY_REPORT_PROGRESS_SCHEMA_VERSION,
	type ModuleDependencyReportProgressEvent,
	type ModuleDependencyReportProgressObservation,
	type ModuleDependencyReportProgressObservationMetric,
	type ModuleDependencyReportProgressPhase,
	type RunModuleDependencyReportOptions
} from './application/run-module-dependency-report.js';

export {
	MODULE_DEPENDENCY_PROGRESS_MAX_BYTES,
	MODULE_DEPENDENCY_PROGRESS_MAX_EVENTS,
	MODULE_DEPENDENCY_PROGRESS_TRANSPORT_SCHEMA_VERSION,
	type ModuleDependencyProgressTransportTruncation
} from './application/module-dependency-progress-jsonl.js';

export {
	callGraphReportExitCode,
	runCallGraphReport,
	CALL_GRAPH_REPORT_PROGRESS_NONCLAIMS,
	CALL_GRAPH_REPORT_PROGRESS_SCHEMA_VERSION,
	type CallGraphReportProgressEvent,
	type CallGraphReportProgressObservation,
	type CallGraphReportProgressObservationMetric,
	type CallGraphReportProgressPhase,
	type RunCallGraphReportOptions
} from './application/run-call-graph-report.js';

export {
	CALL_GRAPH_PROGRESS_MAX_BYTES,
	CALL_GRAPH_PROGRESS_MAX_EVENTS,
	CALL_GRAPH_PROGRESS_TRANSPORT_SCHEMA_VERSION,
	type CallGraphProgressTransportTruncation
} from './application/call-graph-progress-jsonl.js';

export {
	logicalGraphCompositionReportExitCode,
	runLogicalGraphCompositionReport,
	LOGICAL_GRAPH_COMPOSITION_REPORT_PROGRESS_NONCLAIMS,
	LOGICAL_GRAPH_COMPOSITION_REPORT_PROGRESS_SCHEMA_VERSION,
	type LogicalGraphCompositionReportProgressEvent,
	type LogicalGraphCompositionReportProgressMetric,
	type LogicalGraphCompositionReportProgressObservation,
	type LogicalGraphCompositionReportProgressPhase,
	type RunLogicalGraphCompositionReportOptions
} from './application/run-logical-graph-composition-report.js';

export {
	LOGICAL_GRAPH_COMPOSITION_PROGRESS_MAX_BYTES,
	LOGICAL_GRAPH_COMPOSITION_PROGRESS_MAX_EVENTS,
	LOGICAL_GRAPH_COMPOSITION_PROGRESS_TRANSPORT_SCHEMA_VERSION,
	type LogicalGraphCompositionProgressTransportTruncation
} from './application/logical-graph-composition-progress-jsonl.js';

export {
	runSemanticSourceQueryReport,
	SEMANTIC_SOURCE_QUERY_REPORT_PROGRESS_NONCLAIMS,
	SEMANTIC_SOURCE_QUERY_REPORT_PROGRESS_SCHEMA_VERSION,
	semanticSourceQueryReportExitCode,
	type RunSemanticSourceQueryReportOptions,
	type SemanticSourceQueryReportProgressEvent,
	type SemanticSourceQueryReportProgressMetric,
	type SemanticSourceQueryReportProgressObservation,
	type SemanticSourceQueryReportProgressPhase
} from './application/run-semantic-source-query-report.js';

export {
	SEMANTIC_SOURCE_QUERY_PROGRESS_MAX_BYTES,
	SEMANTIC_SOURCE_QUERY_PROGRESS_MAX_EVENTS,
	SEMANTIC_SOURCE_QUERY_PROGRESS_TRANSPORT_SCHEMA_VERSION,
	type SemanticSourceQueryProgressTransportTruncation
} from './application/semantic-source-query-progress-jsonl.js';

export {
	arrowCommandCensusReportExitCode,
	runArrowCommandCensusReport,
	ARROW_COMMAND_CENSUS_REPORT_PROGRESS_NONCLAIMS,
	ARROW_COMMAND_CENSUS_REPORT_PROGRESS_SCHEMA_VERSION,
	type ArrowCommandCensusReportProgressEvent,
	type ArrowCommandCensusReportProgressObservation,
	type ArrowCommandCensusReportProgressObservationMetric,
	type ArrowCommandCensusReportProgressPhase,
	type RunArrowCommandCensusReportOptions
} from './application/run-arrow-command-census-report.js';

export {
	ARROW_COMMAND_CENSUS_PROGRESS_MAX_BYTES,
	ARROW_COMMAND_CENSUS_PROGRESS_MAX_EVENTS,
	ARROW_COMMAND_CENSUS_PROGRESS_TRANSPORT_SCHEMA_VERSION,
	type ArrowCommandCensusProgressTransportTruncation
} from './application/arrow-command-census-progress-jsonl.js';

export {
	commandHandlerGraphReportExitCode,
	runCommandHandlerGraphReport,
	COMMAND_HANDLER_GRAPH_REPORT_PROGRESS_NONCLAIMS,
	COMMAND_HANDLER_GRAPH_REPORT_PROGRESS_SCHEMA_VERSION,
	type CommandHandlerGraphReportProgressEvent,
	type CommandHandlerGraphReportProgressObservation,
	type CommandHandlerGraphReportProgressObservationMetric,
	type CommandHandlerGraphReportProgressPhase,
	type RunCommandHandlerGraphReportOptions
} from './application/run-command-handler-graph-report.js';

export {
	COMMAND_HANDLER_GRAPH_PROGRESS_MAX_BYTES,
	COMMAND_HANDLER_GRAPH_PROGRESS_MAX_EVENTS,
	COMMAND_HANDLER_GRAPH_PROGRESS_TRANSPORT_SCHEMA_VERSION,
	type CommandHandlerGraphProgressTransportTruncation
} from './application/command-handler-graph-progress-jsonl.js';

export {
	commandDispatchTopologyReportExitCode,
	runCommandDispatchTopologyReport,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_PROGRESS_NONCLAIMS,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_PROGRESS_SCHEMA_VERSION,
	type CommandDispatchTopologyReportProgressEvent,
	type CommandDispatchTopologyReportProgressObservation,
	type CommandDispatchTopologyReportProgressObservationMetric,
	type CommandDispatchTopologyReportProgressPhase,
	type RunCommandDispatchTopologyReportOptions
} from './application/run-command-dispatch-topology-report.js';

export {
	COMMAND_DISPATCH_TOPOLOGY_PROGRESS_MAX_BYTES,
	COMMAND_DISPATCH_TOPOLOGY_PROGRESS_MAX_EVENTS,
	COMMAND_DISPATCH_TOPOLOGY_PROGRESS_TRANSPORT_SCHEMA_VERSION,
	type CommandDispatchTopologyProgressTransportTruncation
} from './application/command-dispatch-topology-progress-jsonl.js';

export {
	COMMAND_EVENT_CONTRACT_OVERLAY_PROGRESS_MAX_BYTES,
	COMMAND_EVENT_CONTRACT_OVERLAY_PROGRESS_MAX_EVENTS,
	COMMAND_EVENT_CONTRACT_OVERLAY_PROGRESS_TRANSPORT_SCHEMA_VERSION,
	type CommandEventContractOverlayProgressTransportTruncation
} from './application/command-event-contract-overlay-progress-jsonl.js';

export {
	commandEventContractOverlayReportExitCode,
	runCommandEventContractOverlayReport,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROGRESS_NONCLAIMS,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROGRESS_SCHEMA_VERSION,
	type CommandEventContractOverlayReportProgressEvent,
	type CommandEventContractOverlayReportProgressObservation,
	type CommandEventContractOverlayReportProgressObservationMetric,
	type CommandEventContractOverlayReportProgressPhase,
	type RunCommandEventContractOverlayReportOptions
} from './application/run-command-event-contract-overlay-report.js';

export {
	guardEnforcementLedgerReportExitCode,
	runGuardEnforcementLedgerReport,
	GUARD_ENFORCEMENT_LEDGER_REPORT_PROGRESS_NONCLAIMS,
	GUARD_ENFORCEMENT_LEDGER_REPORT_PROGRESS_SCHEMA_VERSION,
	type GuardEnforcementLedgerReportProgressEvent,
	type GuardEnforcementLedgerReportProgressObservation,
	type GuardEnforcementLedgerReportProgressObservationMetric,
	type GuardEnforcementLedgerReportProgressPhase,
	type RunGuardEnforcementLedgerReportOptions
} from './application/run-guard-enforcement-ledger-report.js';

export {
	GUARD_ENFORCEMENT_LEDGER_PROGRESS_MAX_BYTES,
	GUARD_ENFORCEMENT_LEDGER_PROGRESS_MAX_EVENTS,
	GUARD_ENFORCEMENT_LEDGER_PROGRESS_TRANSPORT_SCHEMA_VERSION,
	type GuardEnforcementLedgerProgressTransportTruncation
} from './application/guard-enforcement-ledger-progress-jsonl.js';

export {
	guardClassificationOverlayReportExitCode,
	runGuardClassificationOverlayReport,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_PROGRESS_NONCLAIMS,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_PROGRESS_SCHEMA_VERSION,
	type GuardClassificationOverlayReportProgressEvent,
	type GuardClassificationOverlayReportProgressObservation,
	type GuardClassificationOverlayReportProgressObservationMetric,
	type GuardClassificationOverlayReportProgressPhase,
	type RunGuardClassificationOverlayReportOptions
} from './application/run-guard-classification-overlay-report.js';

export {
	GUARD_CLASSIFICATION_OVERLAY_PROGRESS_MAX_BYTES,
	GUARD_CLASSIFICATION_OVERLAY_PROGRESS_MAX_EVENTS,
	GUARD_CLASSIFICATION_OVERLAY_PROGRESS_TRANSPORT_SCHEMA_VERSION,
	type GuardClassificationOverlayProgressTransportTruncation
} from './application/guard-classification-overlay-progress-jsonl.js';

export {
	runStateMachineGraphReport,
	stateMachineGraphReportExitCode,
	STATE_MACHINE_GRAPH_REPORT_PROGRESS_NONCLAIMS,
	STATE_MACHINE_GRAPH_REPORT_PROGRESS_SCHEMA_VERSION,
	type RunStateMachineGraphReportOptions,
	type StateMachineGraphReportProgressEvent,
	type StateMachineGraphReportProgressObservation,
	type StateMachineGraphReportProgressObservationMetric,
	type StateMachineGraphReportProgressPhase
} from './application/run-state-machine-graph-report.js';

export {
	STATE_MACHINE_GRAPH_PROGRESS_MAX_BYTES,
	STATE_MACHINE_GRAPH_PROGRESS_MAX_EVENTS,
	STATE_MACHINE_GRAPH_PROGRESS_TRANSPORT_SCHEMA_VERSION,
	type StateMachineGraphProgressTransportTruncation
} from './application/state-machine-graph-progress-jsonl.js';

export {
	declarationContextReportExitCode,
	runDeclarationContextReport,
	DECLARATION_CONTEXT_REPORT_PROGRESS_NONCLAIMS,
	DECLARATION_CONTEXT_REPORT_PROGRESS_SCHEMA_VERSION,
	type DeclarationContextReportProgressEvent,
	type DeclarationContextReportProgressObservation,
	type DeclarationContextReportProgressPhase,
	type RunDeclarationContextReportOptions
} from './application/run-declaration-context-report.js';

export {
	DECLARATION_CONTEXT_PROGRESS_MAX_BYTES,
	DECLARATION_CONTEXT_PROGRESS_MAX_EVENTS,
	DECLARATION_CONTEXT_PROGRESS_TRANSPORT_SCHEMA_VERSION,
	type DeclarationContextProgressTransportTruncation
} from './application/declaration-context-progress-jsonl.js';
export {
	readWriteAccessReportExitCode,
	runReadWriteAccessReport,
	READ_WRITE_ACCESS_REPORT_PROGRESS_NONCLAIMS,
	READ_WRITE_ACCESS_REPORT_PROGRESS_SCHEMA_VERSION,
	type ReadWriteAccessReportProgressEvent,
	type ReadWriteAccessReportProgressObservation,
	type ReadWriteAccessReportProgressObservationMetric,
	type ReadWriteAccessReportProgressPhase,
	type RunReadWriteAccessReportOptions
} from './application/run-read-write-access-report.js';
export {
	READ_WRITE_ACCESS_PROGRESS_MAX_BYTES,
	READ_WRITE_ACCESS_PROGRESS_MAX_EVENTS,
	READ_WRITE_ACCESS_PROGRESS_TRANSPORT_SCHEMA_VERSION,
	type ReadWriteAccessProgressTransportTruncation
} from './application/read-write-access-progress-jsonl.js';
export { buildDeclarationContextAnalysis } from './semantic/build-declaration-context-analysis.js';
export { buildSourceOriginCorrelation } from './semantic/build-source-origin-correlation.js';
export { buildStructuralModuleReachabilityAnalysis } from './graph/build-structural-module-reachability-analysis.js';
export {
	runStaticModuleImpactCandidateReport,
	staticModuleImpactCandidateReportExitCode,
	type RunStaticModuleImpactCandidateReportOptions
} from './application/run-static-module-impact-candidate-report.js';
export {
	runWorkingSourceEditImpactCandidateReport,
	type RunWorkingSourceEditImpactCandidateReportOptions,
	workingSourceEditImpactCandidateReportExitCode
} from './application/run-working-source-edit-impact-candidate-report.js';
export {
	runStructuralModuleReachabilityReport,
	STRUCTURAL_MODULE_REACHABILITY_REPORT_PROGRESS_NONCLAIMS,
	STRUCTURAL_MODULE_REACHABILITY_REPORT_PROGRESS_SCHEMA_VERSION,
	structuralModuleReachabilityReportExitCode,
	type RunStructuralModuleReachabilityReportOptions,
	type StructuralModuleReachabilityReportProgressEvent,
	type StructuralModuleReachabilityReportProgressObservation,
	type StructuralModuleReachabilityReportProgressObservationBasis,
	type StructuralModuleReachabilityReportProgressObservationMetric,
	type StructuralModuleReachabilityReportProgressPhase
} from './application/run-structural-module-reachability-report.js';
export {
	STRUCTURAL_MODULE_REACHABILITY_PROGRESS_MAX_BYTES,
	STRUCTURAL_MODULE_REACHABILITY_PROGRESS_MAX_EVENTS,
	STRUCTURAL_MODULE_REACHABILITY_PROGRESS_TRANSPORT_SCHEMA_VERSION,
	type StructuralModuleReachabilityProgressTransportTruncation
} from './application/structural-module-reachability-progress-jsonl.js';
export { buildStructuralSccAnalysis } from './graph/build-structural-scc-analysis.js';
export {
	runStructuralSccReport,
	STRUCTURAL_SCC_REPORT_PROGRESS_NONCLAIMS,
	STRUCTURAL_SCC_REPORT_PROGRESS_SCHEMA_VERSION,
	structuralSccReportExitCode,
	type RunStructuralSccReportOptions,
	type StructuralSccReportProgressEvent,
	type StructuralSccReportProgressObservation,
	type StructuralSccReportProgressObservationBasis,
	type StructuralSccReportProgressObservationMetric,
	type StructuralSccReportProgressPhase
} from './application/run-structural-scc-report.js';
export {
	STRUCTURAL_SCC_PROGRESS_MAX_BYTES,
	STRUCTURAL_SCC_PROGRESS_MAX_EVENTS,
	STRUCTURAL_SCC_PROGRESS_TRANSPORT_SCHEMA_VERSION,
	type StructuralSccProgressTransportTruncation
} from './application/structural-scc-progress-jsonl.js';
export { buildStateMachineGraph } from './graph/build-state-machine-graph.js';
export { compareDependencyProviders } from './graph/compare-dependency-providers.js';
export { validateDependencyProviderComparison } from './graph/validate-dependency-comparison.js';
export type {
	DependencyProviderComparisonValidationIssue,
	DependencyProviderComparisonValidationIssueCode,
	DependencyProviderComparisonValidationOptions,
	DependencyProviderComparisonValidationResult
} from './graph/validate-dependency-comparison.js';
export { validateCallGraph } from './graph/validate-call-graph.js';
export type {
	CallGraphValidationIssue,
	CallGraphValidationIssueCode,
	CallGraphValidationOptions,
	CallGraphValidationResult
} from './graph/validate-call-graph.js';
export { validateReadWriteAccessGraph } from './graph/validate-read-write-access-graph.js';
export type {
	ReadWriteAccessGraphValidationIssue,
	ReadWriteAccessGraphValidationIssueCode,
	ReadWriteAccessGraphValidationOptions,
	ReadWriteAccessGraphValidationResult
} from './graph/validate-read-write-access-graph.js';
export {
	validateCommandHandlerGraph,
	validateConstructedCommandHandlerGraph
} from './graph/validate-command-handler-graph.js';
export {
	validateCommandDispatchTopology,
	validateConstructedCommandDispatchTopology
} from './graph/validate-command-dispatch-topology.js';
export {
	validateCommandEventContractOverlay,
	validateConstructedCommandEventContractOverlay
} from './graph/validate-command-event-contract-overlay.js';
export {
	validateConstructedGuardClassificationOverlay,
	validateGuardClassificationOverlay
} from './graph/validate-guard-classification-overlay.js';
export type {
	CommandHandlerGraphValidationIssue,
	CommandHandlerGraphValidationIssueCode,
	CommandHandlerGraphValidationOptions,
	CommandHandlerGraphValidationResult
} from './graph/validate-command-handler-graph.js';
export { validateModuleDependencyGraph } from './graph/validate-graph.js';
export {
	validateConstructedLogicalGraphComposition,
	validateLogicalGraphComposition
} from './graph/validate-logical-graph-composition.js';
export { validateProjectContextGraph } from './graph/validate-project-context-graph.js';
export { validateConditionalExportResolution } from './resolution/validate-conditional-export-resolution.js';
export { validateModuleResolutionTrace } from './resolution/validate-module-resolution-trace.js';
export { validateDeclarationContextAnalysis } from './semantic/validate-declaration-context-analysis.js';
export { validateSourceOriginCorrelation } from './semantic/validate-source-origin-correlation.js';
export {
	validateConstructedStructuralModuleReachabilityAnalysis,
	validateStructuralModuleReachabilityAnalysis
} from './graph/validate-structural-module-reachability-analysis.js';
export {
	validateConstructedStructuralSccAnalysis,
	validateStructuralSccAnalysis
} from './graph/validate-structural-scc-analysis.js';
export type {
	ModuleDependencyGraphValidationIssue,
	ModuleDependencyGraphValidationIssueCode,
	ModuleDependencyGraphValidationOptions,
	ModuleDependencyGraphValidationResult
} from './graph/validate-graph.js';
export { validateStateMachineGraph } from './graph/validate-state-machine-graph.js';
export type {
	StateMachineGraphValidationIssue,
	StateMachineGraphValidationIssueCode,
	StateMachineGraphValidationOptions,
	StateMachineGraphValidationResult
} from './graph/validate-state-machine-graph.js';
export { canonicalSemanticJson, canonicalSemanticJsonWitness } from './semantic/canonical.js';
export type { CanonicalSemanticJsonWitness } from './semantic/canonical.js';
export * from './semantic/validate-snapshot.js';
export {
	dependencyCruiserObservationContentDigest,
	normalizeDependencyCruiserOutput,
	validateDependencyCruiserObservation
} from './providers/dependency-cruiser/normalize-output.js';
export { observeStateMachineTopology } from './providers/jpwb-state-machines/observe-state-machines.js';
export {
	ARROW_COMMAND_CENSUS_RETAINED_VERIFIER_PATHS,
	buildArrowCommandCensusArtifactSet,
	selectArrowCommandCensusArtifactSet,
	validateArrowCommandCensusArtifactSet
} from './providers/jpwb-arrow-command-census/artifact-set.js';
export {
	ARROW_COMMAND_CENSUS_PROGRESS_SCHEMA_VERSION,
	observeArrowCommandCensus,
	type ArrowCommandCensusProgressEvent,
	type ArrowCommandCensusProgressPhase,
	type ObserveArrowCommandCensusDependencies,
	type ObserveArrowCommandCensusOptions
} from './providers/jpwb-arrow-command-census/observe-arrow-command-census.js';
export { validateArrowCommandCensusObservation } from './providers/jpwb-arrow-command-census/validate-arrow-command-census.js';
export {
	validateStateMachineTopologyObservation,
	type StateMachineTopologyObservationValidationIssue,
	type StateMachineTopologyObservationValidationResult
} from './providers/jpwb-state-machines/validate-state-machine-observation.js';
export * from './subject/paths.js';
export * from './subject/product-boundary.js';
export * from './subject/artifacts.js';
export * from './subject/freshness.js';
export { hasFrozenSubjectArtifact, readFrozenSubjectArtifact } from './subject/frozen-store.js';
export * from './subject/generated-context.js';
export * from './subject/policy.js';
export * from './subject/projects.js';
export { resolveSubject } from './subject/resolve-subject.js';
export type { SubjectResolutionHooks } from './subject/resolve-subject.js';
export * from './subject/workspaces.js';

// Coding-agent, persistence, analysis, and enriched-evidence implementation-candidate surfaces.
// These remain advisory and preserve the authority, currentness, coverage, and gate-effect limits
// carried by their owning contracts; this export block makes no roadmap-completion claim.
export * from './agent/agent-operation-protocol.js';
export * from './cli/index.js';
export * from './persistence/content-addressed-file-store.js';
export * from './persistence/assess-dwp-007-persistence-selection.js';
export * from './persistence/measure-content-addressed-file-store-performance.js';
export * from './query/four-valued-query-algebra.js';
export * from './query/four-valued-query-operation.js';
export * from './query/module-code-slice.js';
export * from './impact/observe-working-source-edit.js';
export * from './impact/semantic-snapshot-comparison.js';
export * from './rules/harmonization-benchmark-accounting.js';
export * from './rules/harmonization-benchmark-baseline.js';
export * from './rules/harmonization-first-increment-rules.js';
export * from './rules/jpwb-harmonization-native-projection.js';
export * from './providers/coverage/import-vitest-v8-coverage.js';
export * from './providers/eslint/import-eslint-json.js';
export * from './providers/experimental/assess-advanced-cpg-provider-entry.js';
export * from './providers/runtime/evaluate-hybrid-runtime.js';
export * from './providers/runtime/import-runtime-trace.js';
export * from './providers/runtime/project-hybrid-static-prerequisites.js';
export * from './providers/runtime/provider-evidence.js';
export * from './providers/security/observe-jpwb-security.js';
export * from './providers/svelte/svelte-virtual-source.js';
export * from './providers/vitest/import-vitest-json.js';
export * from './graph/analyze-structural-module-graph.js';
export * from './graph/assess-dependency-cruiser-differential.js';
export * from './graph/build-structural-workspace-dependency-graph.js';
export * from './graph/run-current-dependency-cruiser-differential.js';
export * from './graph/structural-module-graph-report.js';
