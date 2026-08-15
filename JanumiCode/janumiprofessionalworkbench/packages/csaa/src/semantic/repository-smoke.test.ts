import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	ARROW_COMMAND_CENSUS_ARTIFACT_SET_OPERATION_VERSION,
	ARROW_COMMAND_CENSUS_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
	ARROW_COMMAND_CENSUS_OPERATION_VERSION,
	ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION,
	ARROW_COMMAND_CENSUS_RETAINED_VERIFIER_PATHS,
	CALL_GRAPH_OPERATION_VERSION,
	CALL_GRAPH_REQUEST_SCHEMA_VERSION,
	CONDITIONAL_EXPORT_RESOLUTION_AUTHORITY,
	CONDITIONAL_EXPORT_RESOLUTION_AUTHORITY_TRANSFER,
	CONDITIONAL_EXPORT_RESOLUTION_CANONICAL_PROFILE,
	CONDITIONAL_EXPORT_RESOLUTION_CAPABILITY,
	CONDITIONAL_EXPORT_RESOLUTION_CAPABILITY_STATUS,
	CONDITIONAL_EXPORT_RESOLUTION_CURRENTNESS,
	CONDITIONAL_EXPORT_RESOLUTION_FRESHNESS,
	CONDITIONAL_EXPORT_RESOLUTION_FULL_JAN_CSAA_012_CONFORMANCE,
	CONDITIONAL_EXPORT_RESOLUTION_GATE_EFFECT,
	CONDITIONAL_EXPORT_RESOLUTION_METHOD,
	CONDITIONAL_EXPORT_RESOLUTION_NONCLAIMS,
	CONDITIONAL_EXPORT_RESOLUTION_OPERATION_VERSION,
	CONDITIONAL_EXPORT_RESOLUTION_REQUEST_SCHEMA_VERSION,
	CONDITIONAL_EXPORT_RESOLUTION_SCHEMA_VERSION,
	CONDITIONAL_EXPORT_RESOLUTION_SELECTION,
	DECLARATION_CONTEXT_ANALYSIS_AUTHORITY,
	DECLARATION_CONTEXT_ANALYSIS_AUTHORITY_TRANSFER,
	DECLARATION_CONTEXT_ANALYSIS_CANONICAL_PROFILE,
	DECLARATION_CONTEXT_ANALYSIS_CAPABILITY,
	DECLARATION_CONTEXT_ANALYSIS_CAPABILITY_STATUS,
	DECLARATION_CONTEXT_ANALYSIS_CURRENTNESS,
	DECLARATION_CONTEXT_ANALYSIS_FRESHNESS,
	DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_007_CONFORMANCE,
	DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_008_CONFORMANCE,
	DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_013_CONFORMANCE,
	DECLARATION_CONTEXT_ANALYSIS_GATE_EFFECT,
	DECLARATION_CONTEXT_ANALYSIS_METHOD,
	DECLARATION_CONTEXT_ANALYSIS_NONCLAIMS,
	DECLARATION_CONTEXT_ANALYSIS_OPERATION_VERSION,
	DECLARATION_CONTEXT_ANALYSIS_REQUEST_SCHEMA_VERSION,
	DECLARATION_CONTEXT_ANALYSIS_SCHEMA_VERSION,
	DECLARATION_CONTEXT_ANALYSIS_SELECTION,
	COMMAND_HANDLER_GRAPH_OPERATION_VERSION,
	COMMAND_HANDLER_GRAPH_REQUEST_SCHEMA_VERSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_OPERATION_VERSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_REQUEST_SCHEMA_VERSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH,
	COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH,
	COMMAND_DISPATCH_TOPOLOGY_OPERATION_VERSION,
	COMMAND_DISPATCH_TOPOLOGY_REQUEST_SCHEMA_VERSION,
	COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_PATH,
	GUARD_CLASSIFICATION_OVERLAY_OPERATION_VERSION,
	GUARD_CLASSIFICATION_OVERLAY_REQUEST_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_OPERATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_RETAINED_VERIFIER_PATHS,
	LOGICAL_GRAPH_COMPOSITION_AUTHORITY_TRANSFER,
	LOGICAL_GRAPH_COMPOSITION_CURRENTNESS,
	LOGICAL_GRAPH_COMPOSITION_FRESHNESS,
	LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_007_CONFORMANCE,
	LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_008_CONFORMANCE,
	LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_009_CONFORMANCE,
	LOGICAL_GRAPH_COMPOSITION_GATE_EFFECT,
	LOGICAL_GRAPH_COMPOSITION_GRAPH_AUTHORITY,
	LOGICAL_GRAPH_COMPOSITION_NONCLAIMS,
	LOGICAL_GRAPH_COMPOSITION_OPERATION_VERSION,
	LOGICAL_GRAPH_COMPOSITION_REQUEST_SCHEMA_VERSION,
	LOGICAL_GRAPH_COMPOSITION_SELECTION,
	PROJECT_CONTEXT_GRAPH_AUTHORITY_TRANSFER,
	PROJECT_CONTEXT_GRAPH_CURRENTNESS,
	PROJECT_CONTEXT_GRAPH_FRESHNESS,
	PROJECT_CONTEXT_GRAPH_FULL_JAN_CSAA_010_CONFORMANCE,
	PROJECT_CONTEXT_GRAPH_GATE_EFFECT,
	PROJECT_CONTEXT_GRAPH_GRAPH_AUTHORITY,
	PROJECT_CONTEXT_GRAPH_NONCLAIMS,
	PROJECT_CONTEXT_GRAPH_OPERATION_VERSION,
	PROJECT_CONTEXT_GRAPH_REQUEST_SCHEMA_VERSION,
	PROJECT_CONTEXT_GRAPH_SELECTION,
	DEPENDENCY_CRUISER_INVOCATION_SCHEMA_VERSION,
	DEPENDENCY_CRUISER_ARGV_GRAMMAR_VERSION,
	DEPENDENCY_CRUISER_PROVIDER_ID,
	DEPENDENCY_CRUISER_PROVIDER_VERSION,
	DEPENDENCY_CRUISER_RAW_SCHEMA_ID,
	DEPENDENCY_PROVIDER_COMPARISON_OPERATION_VERSION,
	DEPENDENCY_PROVIDER_COMPARISON_REQUEST_SCHEMA_VERSION,
	FULL_JAN_CSAA_CAPABILITY_007_DATA_FLOW,
	MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
	MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
	MODULE_RESOLUTION_TRACE_AUTHORITY,
	MODULE_RESOLUTION_TRACE_AUTHORITY_TRANSFER,
	MODULE_RESOLUTION_TRACE_CANONICAL_PROFILE,
	MODULE_RESOLUTION_TRACE_CAPABILITY,
	MODULE_RESOLUTION_TRACE_CAPABILITY_STATUS,
	MODULE_RESOLUTION_TRACE_CURRENTNESS,
	MODULE_RESOLUTION_TRACE_FRESHNESS,
	MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_007_CONFORMANCE,
	MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_008_CONFORMANCE,
	MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_011_CONFORMANCE,
	MODULE_RESOLUTION_TRACE_GATE_EFFECT,
	MODULE_RESOLUTION_TRACE_METHOD,
	MODULE_RESOLUTION_TRACE_NONCLAIMS,
	MODULE_RESOLUTION_TRACE_OPERATION_VERSION,
	MODULE_RESOLUTION_TRACE_REQUEST_SCHEMA_VERSION,
	MODULE_RESOLUTION_TRACE_SCHEMA_VERSION,
	MODULE_RESOLUTION_TRACE_SELECTION,
	READ_WRITE_ACCESS_GRAPH_OPERATION_VERSION,
	READ_WRITE_ACCESS_GRAPH_REQUEST_SCHEMA_VERSION,
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_REQUEST_SCHEMA_VERSION,
	STATE_MACHINE_GRAPH_OPERATION_VERSION,
	STATE_MACHINE_GRAPH_REQUEST_SCHEMA_VERSION,
	STATE_MACHINE_TOPOLOGY_OBSERVATION_OPERATION_VERSION,
	STATE_MACHINE_TOPOLOGY_OBSERVATION_REQUEST_SCHEMA_VERSION,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_AUTHORITY_TRANSFER,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_FULL_JAN_CSAA_007_CONFORMANCE,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_FULL_JAN_CSAA_008_CONFORMANCE,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_GATE_EFFECT,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_GRAPH_AUTHORITY,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_NONCLAIMS,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_OPERATION_VERSION,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_REQUEST_SCHEMA_VERSION,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION,
	STRUCTURAL_SCC_ANALYSIS_OPERATION_VERSION,
	STRUCTURAL_SCC_ANALYSIS_REQUEST_SCHEMA_VERSION,
	STRUCTURAL_SCC_ANALYSIS_AUTHORITY_TRANSFER,
	STRUCTURAL_SCC_ANALYSIS_FULL_JAN_CSAA_007_CONFORMANCE,
	STRUCTURAL_SCC_ANALYSIS_FULL_JAN_CSAA_008_CONFORMANCE,
	STRUCTURAL_SCC_ANALYSIS_GATE_EFFECT,
	STRUCTURAL_SCC_ANALYSIS_GRAPH_AUTHORITY,
	STRUCTURAL_SCC_ANALYSIS_NONCLAIMS,
	STRUCTURAL_SCC_ANALYSIS_SELECTION,
	SUBJECT_POLICY_VERSION,
	SUBJECT_REQUEST_SCHEMA_VERSION,
	type CallGraphSnapshot,
	type ConditionalExportResolutionInputs,
	type ConditionalExportResolutionProgressEvent,
	type ConditionalExportResolutionSnapshot,
	type DeclarationContextAnalysisBuildInputs,
	type DeclarationContextAnalysisProgressEvent,
	type DeclarationContextAnalysisSnapshot,
	type ModuleDependencyGraphSnapshot,
	type ModuleResolutionTraceBuildInputs,
	type ModuleResolutionTraceProgressEvent,
	type ModuleResolutionTraceSnapshot,
	type ProjectContextGraphSnapshot,
	type BuildStateMachineGraphRequest,
	type GuardEnforcementLedgerObservation,
	type StateMachineGraphSnapshot,
	type StateMachineTopologyObservation,
	type SemanticCapability,
	type StaticSemanticSnapshotProgressEvent,
	type ResolveSubjectRequest,
	buildCallGraph,
	buildConditionalExportResolution,
	buildDeclarationContextAnalysis,
	buildCommandEventContractOverlay,
	buildCommandHandlerGraph,
	buildCommandDispatchTopology,
	buildGuardClassificationOverlay,
	buildGuardEnforcementLedgerArtifactSet,
	buildArrowCommandCensusArtifactSet,
	buildLogicalGraphComposition,
	buildModuleDependencyGraph,
	buildModuleResolutionTrace,
	buildProjectContextGraph,
	buildStructuralModuleReachabilityAnalysis,
	buildStructuralSccAnalysis,
	buildReadWriteAccessGraph,
	buildStaticSemanticSnapshot,
	buildStateMachineGraph,
	canonicalSemanticJson,
	canonicalSemanticJsonWitness,
	compareDependencyProviders,
	normalizeDependencyCruiserOutput,
	observeArrowCommandCensus,
	observeGuardEnforcementLedger,
	observeStateMachineTopology,
	resolveSubject,
	selectJpwbCommandEventContractOverlayInputs,
	selectJpwbCommandHandlerRegistries,
	selectJpwbCommandDispatchTopology,
	sha256,
	validateDependencyCruiserObservation,
	validateDependencyProviderComparison,
	validateConditionalExportResolution,
	validateDeclarationContextAnalysis,
	validateArrowCommandCensusObservation,
	validateCommandEventContractOverlay,
	validateCommandHandlerGraph,
	validateCommandDispatchTopology,
	validateGuardClassificationOverlay,
	validateGuardEnforcementLedgerObservation,
	validateLogicalGraphComposition,
	validateModuleDependencyGraph,
	validateModuleResolutionTrace,
	validateProjectContextGraph,
	validateStructuralModuleReachabilityAnalysis,
	validateStructuralSccAnalysis,
	validateReadWriteAccessGraph,
	validateStateMachineGraph,
	validateStateMachineTopologyObservation,
	validateStaticSemanticSnapshot
} from '@janumipwb/csaa';

const SMOKE_SELECTOR = process.env.CSAA_REPOSITORY_SMOKE;
type RepositorySmokeProfile = 'FULL' | 'STRUCTURAL';
type RepositorySmokeSuite =
	| 'COMMAND_HANDLER_ONLY'
	| 'CONDITIONAL_EXPORT_RESOLUTION_ONLY'
	| 'DECLARATION_CONTEXT_ANALYSIS_ONLY'
	| 'FULL_SUITE'
	| 'LOGICAL_GRAPH_COMPOSITION_ONLY'
	| 'MODULE_RESOLUTION_TRACE_ONLY'
	| 'PROJECT_CONTEXT_GRAPH_ONLY'
	| 'STRUCTURAL_MODULE_REACHABILITY_ONLY'
	| 'STRUCTURAL_SCC_ONLY';

interface RepositorySmokeProjectionPlan {
	readonly runIndependentSemanticRevalidation: boolean;
	readonly runCallGraph: boolean;
	readonly runCommandEventContractOverlay: boolean;
	readonly runConditionalExportResolution: boolean;
	readonly runDeclarationContextAnalysis: boolean;
	readonly runDependencyProviderComparison: boolean;
	readonly runGuardClassificationOverlay: boolean;
	readonly runLogicalGraphComposition: boolean;
	readonly runModuleDependencyGraph: boolean;
	readonly runModuleResolutionTrace: boolean;
	readonly runProjectContextGraph: boolean;
	readonly runReadWriteAccessGraph: boolean;
	readonly runRepositoryDiscoveryPreflight: boolean;
	readonly runStateMachineProjection: boolean;
	readonly runStructuralModuleReachabilityAnalysis: boolean;
	readonly runStructuralSccAnalysis: boolean;
	readonly suite: RepositorySmokeSuite;
	readonly terminateAfterConditionalExportResolution: boolean;
	readonly terminateAfterDeclarationContextAnalysis: boolean;
	readonly terminateAfterLogicalGraphComposition: boolean;
	readonly terminateAfterModuleResolutionTrace: boolean;
	readonly terminateAfterProjectContextGraph: boolean;
	readonly terminateAfterStructuralModuleReachabilityAnalysis: boolean;
	readonly terminateAfterStructuralSccAnalysis: boolean;
}

const REPOSITORY_SMOKE_PROJECTION_PLANS: Readonly<
	Record<RepositorySmokeSuite, RepositorySmokeProjectionPlan>
> = {
	COMMAND_HANDLER_ONLY: {
		runIndependentSemanticRevalidation: false,
		runCallGraph: false,
		runCommandEventContractOverlay: true,
		runConditionalExportResolution: false,
		runDeclarationContextAnalysis: false,
		runDependencyProviderComparison: false,
		runGuardClassificationOverlay: true,
		runLogicalGraphComposition: false,
		runModuleDependencyGraph: false,
		runModuleResolutionTrace: false,
		runProjectContextGraph: false,
		runReadWriteAccessGraph: false,
		runRepositoryDiscoveryPreflight: false,
		runStateMachineProjection: true,
		runStructuralModuleReachabilityAnalysis: false,
		runStructuralSccAnalysis: false,
		suite: 'COMMAND_HANDLER_ONLY',
		terminateAfterConditionalExportResolution: false,
		terminateAfterDeclarationContextAnalysis: false,
		terminateAfterLogicalGraphComposition: false,
		terminateAfterModuleResolutionTrace: false,
		terminateAfterProjectContextGraph: false,
		terminateAfterStructuralModuleReachabilityAnalysis: false,
		terminateAfterStructuralSccAnalysis: false
	},
	FULL_SUITE: {
		runIndependentSemanticRevalidation: true,
		runCallGraph: true,
		runCommandEventContractOverlay: false,
		runConditionalExportResolution: false,
		runDeclarationContextAnalysis: false,
		runDependencyProviderComparison: true,
		runGuardClassificationOverlay: false,
		runLogicalGraphComposition: true,
		runModuleDependencyGraph: true,
		runModuleResolutionTrace: false,
		runProjectContextGraph: true,
		runReadWriteAccessGraph: true,
		runRepositoryDiscoveryPreflight: true,
		runStateMachineProjection: true,
		runStructuralModuleReachabilityAnalysis: true,
		runStructuralSccAnalysis: true,
		suite: 'FULL_SUITE',
		terminateAfterConditionalExportResolution: false,
		terminateAfterDeclarationContextAnalysis: false,
		terminateAfterLogicalGraphComposition: false,
		terminateAfterModuleResolutionTrace: false,
		terminateAfterProjectContextGraph: false,
		terminateAfterStructuralModuleReachabilityAnalysis: false,
		terminateAfterStructuralSccAnalysis: false
	},
	LOGICAL_GRAPH_COMPOSITION_ONLY: {
		runIndependentSemanticRevalidation: false,
		runCallGraph: true,
		runCommandEventContractOverlay: false,
		runConditionalExportResolution: false,
		runDeclarationContextAnalysis: false,
		runDependencyProviderComparison: false,
		runGuardClassificationOverlay: false,
		runLogicalGraphComposition: true,
		runModuleDependencyGraph: true,
		runModuleResolutionTrace: false,
		runProjectContextGraph: false,
		runReadWriteAccessGraph: false,
		runRepositoryDiscoveryPreflight: false,
		runStateMachineProjection: false,
		runStructuralModuleReachabilityAnalysis: false,
		runStructuralSccAnalysis: false,
		suite: 'LOGICAL_GRAPH_COMPOSITION_ONLY',
		terminateAfterConditionalExportResolution: false,
		terminateAfterDeclarationContextAnalysis: false,
		terminateAfterLogicalGraphComposition: true,
		terminateAfterModuleResolutionTrace: false,
		terminateAfterProjectContextGraph: false,
		terminateAfterStructuralModuleReachabilityAnalysis: false,
		terminateAfterStructuralSccAnalysis: false
	},
	PROJECT_CONTEXT_GRAPH_ONLY: {
		runIndependentSemanticRevalidation: false,
		runCallGraph: false,
		runCommandEventContractOverlay: false,
		runConditionalExportResolution: false,
		runDeclarationContextAnalysis: false,
		runDependencyProviderComparison: false,
		runGuardClassificationOverlay: false,
		runLogicalGraphComposition: false,
		runModuleDependencyGraph: false,
		runModuleResolutionTrace: false,
		runProjectContextGraph: true,
		runReadWriteAccessGraph: false,
		runRepositoryDiscoveryPreflight: false,
		runStateMachineProjection: false,
		runStructuralModuleReachabilityAnalysis: false,
		runStructuralSccAnalysis: false,
		suite: 'PROJECT_CONTEXT_GRAPH_ONLY',
		terminateAfterConditionalExportResolution: false,
		terminateAfterDeclarationContextAnalysis: false,
		terminateAfterLogicalGraphComposition: false,
		terminateAfterModuleResolutionTrace: false,
		terminateAfterProjectContextGraph: true,
		terminateAfterStructuralModuleReachabilityAnalysis: false,
		terminateAfterStructuralSccAnalysis: false
	},
	CONDITIONAL_EXPORT_RESOLUTION_ONLY: {
		runIndependentSemanticRevalidation: false,
		runCallGraph: false,
		runCommandEventContractOverlay: false,
		runConditionalExportResolution: true,
		runDeclarationContextAnalysis: false,
		runDependencyProviderComparison: false,
		runGuardClassificationOverlay: false,
		runLogicalGraphComposition: false,
		runModuleDependencyGraph: false,
		runModuleResolutionTrace: false,
		runProjectContextGraph: true,
		runReadWriteAccessGraph: false,
		runRepositoryDiscoveryPreflight: false,
		runStateMachineProjection: false,
		runStructuralModuleReachabilityAnalysis: false,
		runStructuralSccAnalysis: false,
		suite: 'CONDITIONAL_EXPORT_RESOLUTION_ONLY',
		terminateAfterConditionalExportResolution: true,
		terminateAfterDeclarationContextAnalysis: false,
		terminateAfterLogicalGraphComposition: false,
		terminateAfterModuleResolutionTrace: false,
		terminateAfterProjectContextGraph: false,
		terminateAfterStructuralModuleReachabilityAnalysis: false,
		terminateAfterStructuralSccAnalysis: false
	},
	MODULE_RESOLUTION_TRACE_ONLY: {
		runIndependentSemanticRevalidation: false,
		runCallGraph: false,
		runCommandEventContractOverlay: false,
		runConditionalExportResolution: true,
		runDeclarationContextAnalysis: false,
		runDependencyProviderComparison: false,
		runGuardClassificationOverlay: false,
		runLogicalGraphComposition: false,
		runModuleDependencyGraph: false,
		runModuleResolutionTrace: true,
		runProjectContextGraph: true,
		runReadWriteAccessGraph: false,
		runRepositoryDiscoveryPreflight: false,
		runStateMachineProjection: false,
		runStructuralModuleReachabilityAnalysis: false,
		runStructuralSccAnalysis: false,
		suite: 'MODULE_RESOLUTION_TRACE_ONLY',
		terminateAfterConditionalExportResolution: false,
		terminateAfterDeclarationContextAnalysis: false,
		terminateAfterLogicalGraphComposition: false,
		terminateAfterModuleResolutionTrace: true,
		terminateAfterProjectContextGraph: false,
		terminateAfterStructuralModuleReachabilityAnalysis: false,
		terminateAfterStructuralSccAnalysis: false
	},
	DECLARATION_CONTEXT_ANALYSIS_ONLY: {
		runIndependentSemanticRevalidation: false,
		runCallGraph: false,
		runCommandEventContractOverlay: false,
		runConditionalExportResolution: true,
		runDeclarationContextAnalysis: true,
		runDependencyProviderComparison: false,
		runGuardClassificationOverlay: false,
		runLogicalGraphComposition: false,
		runModuleDependencyGraph: false,
		runModuleResolutionTrace: true,
		runProjectContextGraph: true,
		runReadWriteAccessGraph: false,
		runRepositoryDiscoveryPreflight: false,
		runStateMachineProjection: false,
		runStructuralModuleReachabilityAnalysis: false,
		runStructuralSccAnalysis: false,
		suite: 'DECLARATION_CONTEXT_ANALYSIS_ONLY',
		terminateAfterConditionalExportResolution: false,
		terminateAfterDeclarationContextAnalysis: true,
		terminateAfterLogicalGraphComposition: false,
		terminateAfterModuleResolutionTrace: false,
		terminateAfterProjectContextGraph: false,
		terminateAfterStructuralModuleReachabilityAnalysis: false,
		terminateAfterStructuralSccAnalysis: false
	},
	STRUCTURAL_MODULE_REACHABILITY_ONLY: {
		runIndependentSemanticRevalidation: false,
		runCallGraph: false,
		runCommandEventContractOverlay: false,
		runConditionalExportResolution: false,
		runDeclarationContextAnalysis: false,
		runDependencyProviderComparison: false,
		runGuardClassificationOverlay: false,
		runLogicalGraphComposition: false,
		runModuleDependencyGraph: true,
		runModuleResolutionTrace: false,
		runProjectContextGraph: false,
		runReadWriteAccessGraph: false,
		runRepositoryDiscoveryPreflight: false,
		runStateMachineProjection: false,
		runStructuralModuleReachabilityAnalysis: true,
		runStructuralSccAnalysis: false,
		suite: 'STRUCTURAL_MODULE_REACHABILITY_ONLY',
		terminateAfterConditionalExportResolution: false,
		terminateAfterDeclarationContextAnalysis: false,
		terminateAfterLogicalGraphComposition: false,
		terminateAfterModuleResolutionTrace: false,
		terminateAfterProjectContextGraph: false,
		terminateAfterStructuralModuleReachabilityAnalysis: true,
		terminateAfterStructuralSccAnalysis: false
	},
	STRUCTURAL_SCC_ONLY: {
		runIndependentSemanticRevalidation: false,
		runCallGraph: false,
		runCommandEventContractOverlay: false,
		runConditionalExportResolution: false,
		runDeclarationContextAnalysis: false,
		runDependencyProviderComparison: false,
		runGuardClassificationOverlay: false,
		runLogicalGraphComposition: false,
		runModuleDependencyGraph: true,
		runModuleResolutionTrace: false,
		runProjectContextGraph: false,
		runReadWriteAccessGraph: false,
		runRepositoryDiscoveryPreflight: false,
		runStateMachineProjection: false,
		runStructuralModuleReachabilityAnalysis: false,
		runStructuralSccAnalysis: true,
		suite: 'STRUCTURAL_SCC_ONLY',
		terminateAfterConditionalExportResolution: false,
		terminateAfterDeclarationContextAnalysis: false,
		terminateAfterLogicalGraphComposition: false,
		terminateAfterModuleResolutionTrace: false,
		terminateAfterProjectContextGraph: false,
		terminateAfterStructuralModuleReachabilityAnalysis: false,
		terminateAfterStructuralSccAnalysis: true
	}
};

function repositorySmokeProfile(value: string | undefined): RepositorySmokeProfile {
	if (value === undefined || value.trim() === '') return 'FULL';
	const normalized = value.trim().toUpperCase();
	if (normalized === 'FULL' || normalized === 'STRUCTURAL') return normalized;
	throw new Error(`Unsupported CSAA_REPOSITORY_SMOKE_PROFILE: ${value}`);
}

function repositorySmokeSuite(value: string | undefined): RepositorySmokeSuite {
	if (value === undefined || value.trim() === '') return 'FULL_SUITE';
	const normalized = value.trim().toUpperCase();
	if (normalized === 'COMMAND_HANDLER' || normalized === 'COMMAND_HANDLER_ONLY')
		return 'COMMAND_HANDLER_ONLY';
	if (
		normalized === 'CONDITIONAL_EXPORT_RESOLUTION' ||
		normalized === 'CONDITIONAL_EXPORT_RESOLUTION_ONLY'
	)
		return 'CONDITIONAL_EXPORT_RESOLUTION_ONLY';
	if (
		normalized === 'DECLARATION_CONTEXT_ANALYSIS' ||
		normalized === 'DECLARATION_CONTEXT_ANALYSIS_ONLY'
	)
		return 'DECLARATION_CONTEXT_ANALYSIS_ONLY';
	if (normalized === 'MODULE_RESOLUTION_TRACE' || normalized === 'MODULE_RESOLUTION_TRACE_ONLY')
		return 'MODULE_RESOLUTION_TRACE_ONLY';
	if (
		normalized === 'STRUCTURAL_MODULE_REACHABILITY' ||
		normalized === 'STRUCTURAL_MODULE_REACHABILITY_ONLY'
	)
		return 'STRUCTURAL_MODULE_REACHABILITY_ONLY';
	if (normalized === 'STRUCTURAL_SCC' || normalized === 'STRUCTURAL_SCC_ONLY')
		return 'STRUCTURAL_SCC_ONLY';
	if (normalized === 'LOGICAL_GRAPH_COMPOSITION' || normalized === 'LOGICAL_GRAPH_COMPOSITION_ONLY')
		return 'LOGICAL_GRAPH_COMPOSITION_ONLY';
	if (normalized === 'PROJECT_CONTEXT_GRAPH' || normalized === 'PROJECT_CONTEXT_GRAPH_ONLY')
		return 'PROJECT_CONTEXT_GRAPH_ONLY';
	if (normalized === 'FULL' || normalized === 'FULL_SUITE') return 'FULL_SUITE';
	throw new Error(`Unsupported CSAA_REPOSITORY_SMOKE_SUITE: ${value}`);
}

function assertRepositorySmokeSelection(
	profile: RepositorySmokeProfile,
	suite: RepositorySmokeSuite,
	selector: string | undefined
): void {
	if (suite === 'FULL_SUITE') return;
	if (suite === 'LOGICAL_GRAPH_COMPOSITION_ONLY') {
		if (profile !== 'FULL')
			throw new Error(
				'LOGICAL_GRAPH_COMPOSITION_ONLY requires CSAA_REPOSITORY_SMOKE_PROFILE=FULL.'
			);
		if (selector !== '1')
			throw new Error('LOGICAL_GRAPH_COMPOSITION_ONLY requires CSAA_REPOSITORY_SMOKE=1.');
		return;
	}
	if (profile !== 'STRUCTURAL')
		throw new Error(`${suite} requires CSAA_REPOSITORY_SMOKE_PROFILE=STRUCTURAL.`);
	if (selector !== '1') throw new Error(`${suite} requires CSAA_REPOSITORY_SMOKE=1.`);
}

function semanticCapabilitiesForProfile(
	profile: RepositorySmokeProfile
): readonly SemanticCapability[] {
	return profile === 'FULL'
		? ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX', 'TS_TYPE']
		: ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'];
}

const SMOKE_PROFILE = repositorySmokeProfile(process.env.CSAA_REPOSITORY_SMOKE_PROFILE);
const SMOKE_SUITE = repositorySmokeSuite(process.env.CSAA_REPOSITORY_SMOKE_SUITE);
const SMOKE_PROJECTION_PLAN = REPOSITORY_SMOKE_PROJECTION_PLANS[SMOKE_SUITE];
assertRepositorySmokeSelection(SMOKE_PROFILE, SMOKE_SUITE, SMOKE_SELECTOR);
const SEMANTIC_CAPABILITIES = semanticCapabilitiesForProfile(SMOKE_PROFILE);
const RUN_REPOSITORY_SMOKE =
	SMOKE_SELECTOR !== undefined && SMOKE_SELECTOR !== '' && SMOKE_SELECTOR !== '0';
// Provisional runaway guards required by the budgeted APIs and test runner for this opt-in
// smoke. They are not empirically established operating ceilings, product defaults, SLOs, or
// acceptance targets. Snapshot bytes are canonical JSON UTF-8 bytes; semantic duration is
// observed at phase checkpoints rather than by cancelling computation at an exact instant.
const REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES = 1_000_000_000;
const REPOSITORY_SMOKE_FAILSAFE_SUBJECT_DURATION_MS = 180_000;
const REPOSITORY_SMOKE_FAILSAFE_SUBJECT_FILES = 100_000;
const REPOSITORY_SMOKE_FAILSAFE_SUBJECT_PROJECTS = 200;
const REPOSITORY_SMOKE_FAILSAFE_SUBJECT_CONFIG_DEPTH = 64;
const REPOSITORY_SMOKE_FAILSAFE_SEMANTIC_DURATION_MS = 3_600_000;
const REPOSITORY_SMOKE_FAILSAFE_SNAPSHOT_BYTES = 1_000_000_000;
const REPOSITORY_SMOKE_FAILSAFE_PROVIDER_DURATION_MS = 300_000;
// Two subject resolutions, the semantic build, two provider processes, and one hour for
// bounded projections, repeated independent predecessor validation, failure reporting, and
// cleanup. This is a test-runner guard, not an empirical product ceiling or SLO.
const REPOSITORY_SMOKE_FAILSAFE_TEST_TIMEOUT_MS =
	REPOSITORY_SMOKE_FAILSAFE_SUBJECT_DURATION_MS * 2 +
	REPOSITORY_SMOKE_FAILSAFE_SEMANTIC_DURATION_MS +
	REPOSITORY_SMOKE_FAILSAFE_PROVIDER_DURATION_MS * 2 +
	3_600_000;
// Historical three-project representative slice used by the FULL smoke profile.
const REPRESENTATIVE_PROJECTS = [
	'packages/rph-application/tsconfig.json',
	'packages/rph-contracts/tsconfig.json',
	'packages/rph-domain/tsconfig.json'
] as const;
const COMMAND_HANDLER_COMPILER_CLOSURE_PROJECTS = [
	'packages/rph-application/tsconfig.json',
	'packages/rph-assurance/tsconfig.json',
	'packages/rph-contracts/tsconfig.json',
	'packages/rph-domain/tsconfig.json',
	'packages/rph-persistence/tsconfig.json',
	'packages/rph-ports/tsconfig.json',
	'packages/rph-projections/tsconfig.json'
] as const;

function selectedProjectsForSmoke(
	profile: RepositorySmokeProfile,
	suite: RepositorySmokeSuite,
	selector: string | undefined
): readonly string[] | null {
	return selector === 'all'
		? null
		: selector === undefined || selector === '1'
			? profile === 'STRUCTURAL' || suite === 'LOGICAL_GRAPH_COMPOSITION_ONLY'
				? COMMAND_HANDLER_COMPILER_CLOSURE_PROJECTS
				: REPRESENTATIVE_PROJECTS
			: selector
					.split(',')
					.map((path) => path.trim())
					.filter((path) => path.length > 0);
}

const SELECTED_PROJECTS = selectedProjectsForSmoke(SMOKE_PROFILE, SMOKE_SUITE, SMOKE_SELECTOR);
const USE_COMMON_COMMAND_HANDLER_SUBJECT =
	SMOKE_PROFILE === 'STRUCTURAL' &&
	SELECTED_PROJECTS !== null &&
	SELECTED_PROJECTS.length === COMMAND_HANDLER_COMPILER_CLOSURE_PROJECTS.length &&
	COMMAND_HANDLER_COMPILER_CLOSURE_PROJECTS.every(
		(path, index) => SELECTED_PROJECTS[index] === path
	);
const COMMAND_ANALYSIS_AUXILIARY_ARTIFACTS = [
	...ARROW_COMMAND_CENSUS_RETAINED_VERIFIER_PATHS,
	...GUARD_ENFORCEMENT_LEDGER_RETAINED_VERIFIER_PATHS,
	COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_PATH,
	COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH,
	COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH
] as const;
const STRUCTURAL_MODULE_REACHABILITY_CRITERION_LOGICAL_PATH =
	'packages/rph-application/src/index.ts' as const;
const CONDITIONAL_EXPORT_RESOLUTION_CONSUMER_LOGICAL_PATH =
	'packages/rph-application/src/command-bus.ts' as const;
const CONDITIONAL_EXPORT_RESOLUTION_PACKAGE_NAME = '@janumipwb/rph-contracts' as const;
const CONDITIONAL_EXPORT_RESOLUTION_EXPORT_SUBPATH = '.' as const;
const CONDITIONAL_EXPORT_RESOLUTION_EXPLICIT_CONDITIONS = ['source', 'types'] as const;
const MODULE_RESOLUTION_TRACE_EXPLICIT_CONDITIONS = ['types'] as const;
const DECLARATION_CONTEXT_ANALYSIS_EXPORT_NAME = 'RPH_CONTRACTS_VERSION' as const;
const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

const REPOSITORY_SMOKE_TELEMETRY_SCHEMA_VERSION =
	'jan-csaa-repository-smoke-telemetry/1.11.0' as const;

type RepositorySmokePhase =
	| 'ARROW_COMMAND_CENSUS_ARTIFACT_SET_BINDING'
	| 'ARROW_COMMAND_CENSUS_OBSERVATION'
	| 'ARROW_COMMAND_CENSUS_SUBJECT_SELECTION'
	| 'ARROW_COMMAND_CENSUS_VALIDATE_AND_SERIALIZE'
	| 'CALL_GRAPH'
	| 'COMMAND_EVENT_CONTRACT_STATIC_OVERLAY'
	| 'COMMAND_HANDLER_STATIC_PROJECTION'
	| 'COMMAND_DISPATCH_STATIC_TOPOLOGY'
	| 'CONDITIONAL_EXPORT_RESOLUTION'
	| 'GUARD_CLASSIFICATION_STATIC_OVERLAY'
	| 'GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_BINDING'
	| 'GUARD_ENFORCEMENT_LEDGER_OBSERVATION'
	| 'GUARD_ENFORCEMENT_LEDGER_VALIDATE_AND_SERIALIZE'
	| 'LOGICAL_GRAPH_COMPOSITION'
	| 'DEPENDENCY_CRUISER_EXECUTION'
	| 'DEPENDENCY_CRUISER_NORMALIZATION'
	| 'DEPENDENCY_PROVIDER_COMPARISON'
	| 'MODULE_DEPENDENCY_GRAPH'
	| 'MODULE_RESOLUTION_TRACE'
	| 'DECLARATION_CONTEXT_ANALYSIS'
	| 'PROJECT_CONTEXT_GRAPH'
	| 'STRUCTURAL_MODULE_REACHABILITY_ANALYSIS'
	| 'STRUCTURAL_SCC_ANALYSIS'
	| 'READ_WRITE_ACCESS_GRAPH'
	| 'REPOSITORY_DISCOVERY_PREFLIGHT'
	| 'SELECTED_SUBJECT_RESOLUTION'
	| 'STATE_MACHINE_GRAPH_PROJECTION'
	| 'STATE_MACHINE_TOPOLOGY_OBSERVATION'
	| 'STATIC_SEMANTIC_SNAPSHOT_BUILD'
	| 'STATIC_SEMANTIC_SNAPSHOT_VALIDATE_AND_SERIALIZE';

const STRUCTURAL_SCC_ONLY_SKIPPED_PHASES: readonly RepositorySmokePhase[] = [
	'CONDITIONAL_EXPORT_RESOLUTION',
	'MODULE_RESOLUTION_TRACE',
	'DECLARATION_CONTEXT_ANALYSIS',
	'STRUCTURAL_MODULE_REACHABILITY_ANALYSIS',
	'CALL_GRAPH',
	'LOGICAL_GRAPH_COMPOSITION',
	'READ_WRITE_ACCESS_GRAPH',
	'STATE_MACHINE_TOPOLOGY_OBSERVATION',
	'STATE_MACHINE_GRAPH_PROJECTION',
	'ARROW_COMMAND_CENSUS_SUBJECT_SELECTION',
	'ARROW_COMMAND_CENSUS_ARTIFACT_SET_BINDING',
	'ARROW_COMMAND_CENSUS_OBSERVATION',
	'ARROW_COMMAND_CENSUS_VALIDATE_AND_SERIALIZE',
	'GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_BINDING',
	'GUARD_ENFORCEMENT_LEDGER_OBSERVATION',
	'GUARD_ENFORCEMENT_LEDGER_VALIDATE_AND_SERIALIZE',
	'COMMAND_HANDLER_STATIC_PROJECTION',
	'COMMAND_EVENT_CONTRACT_STATIC_OVERLAY',
	'GUARD_CLASSIFICATION_STATIC_OVERLAY',
	'COMMAND_DISPATCH_STATIC_TOPOLOGY',
	'DEPENDENCY_CRUISER_EXECUTION',
	'DEPENDENCY_CRUISER_NORMALIZATION',
	'DEPENDENCY_PROVIDER_COMPARISON'
];

const STRUCTURAL_MODULE_REACHABILITY_ONLY_SKIPPED_PHASES: readonly RepositorySmokePhase[] = [
	'CONDITIONAL_EXPORT_RESOLUTION',
	'MODULE_RESOLUTION_TRACE',
	'DECLARATION_CONTEXT_ANALYSIS',
	'STRUCTURAL_SCC_ANALYSIS',
	'CALL_GRAPH',
	'LOGICAL_GRAPH_COMPOSITION',
	'READ_WRITE_ACCESS_GRAPH',
	'STATE_MACHINE_TOPOLOGY_OBSERVATION',
	'STATE_MACHINE_GRAPH_PROJECTION',
	'ARROW_COMMAND_CENSUS_SUBJECT_SELECTION',
	'ARROW_COMMAND_CENSUS_ARTIFACT_SET_BINDING',
	'ARROW_COMMAND_CENSUS_OBSERVATION',
	'ARROW_COMMAND_CENSUS_VALIDATE_AND_SERIALIZE',
	'GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_BINDING',
	'GUARD_ENFORCEMENT_LEDGER_OBSERVATION',
	'GUARD_ENFORCEMENT_LEDGER_VALIDATE_AND_SERIALIZE',
	'COMMAND_HANDLER_STATIC_PROJECTION',
	'COMMAND_EVENT_CONTRACT_STATIC_OVERLAY',
	'GUARD_CLASSIFICATION_STATIC_OVERLAY',
	'COMMAND_DISPATCH_STATIC_TOPOLOGY',
	'DEPENDENCY_CRUISER_EXECUTION',
	'DEPENDENCY_CRUISER_NORMALIZATION',
	'DEPENDENCY_PROVIDER_COMPARISON'
];

const STRUCTURAL_MODULE_REACHABILITY_ONLY_COMPLETED_PHASES: readonly RepositorySmokePhase[] = [
	'SELECTED_SUBJECT_RESOLUTION',
	'STATIC_SEMANTIC_SNAPSHOT_BUILD',
	'MODULE_DEPENDENCY_GRAPH',
	'STRUCTURAL_MODULE_REACHABILITY_ANALYSIS'
];

const STRUCTURAL_MODULE_REACHABILITY_ONLY_EXPECTED_SKIPPED_PHASES: readonly RepositorySmokePhase[] =
	[
		'REPOSITORY_DISCOVERY_PREFLIGHT',
		'STATIC_SEMANTIC_SNAPSHOT_VALIDATE_AND_SERIALIZE',
		'PROJECT_CONTEXT_GRAPH',
		...STRUCTURAL_MODULE_REACHABILITY_ONLY_SKIPPED_PHASES
	];

const STRUCTURAL_SCC_ONLY_COMPLETED_PHASES: readonly RepositorySmokePhase[] = [
	'SELECTED_SUBJECT_RESOLUTION',
	'STATIC_SEMANTIC_SNAPSHOT_BUILD',
	'MODULE_DEPENDENCY_GRAPH',
	'STRUCTURAL_SCC_ANALYSIS'
];

const STRUCTURAL_SCC_ONLY_EXPECTED_SKIPPED_PHASES: readonly RepositorySmokePhase[] = [
	'REPOSITORY_DISCOVERY_PREFLIGHT',
	'STATIC_SEMANTIC_SNAPSHOT_VALIDATE_AND_SERIALIZE',
	'PROJECT_CONTEXT_GRAPH',
	...STRUCTURAL_SCC_ONLY_SKIPPED_PHASES
];

const LOGICAL_GRAPH_COMPOSITION_ONLY_DOWNSTREAM_SKIPPED_PHASES: readonly RepositorySmokePhase[] = [
	'READ_WRITE_ACCESS_GRAPH',
	'STATE_MACHINE_TOPOLOGY_OBSERVATION',
	'STATE_MACHINE_GRAPH_PROJECTION',
	'ARROW_COMMAND_CENSUS_SUBJECT_SELECTION',
	'ARROW_COMMAND_CENSUS_ARTIFACT_SET_BINDING',
	'ARROW_COMMAND_CENSUS_OBSERVATION',
	'ARROW_COMMAND_CENSUS_VALIDATE_AND_SERIALIZE',
	'GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_BINDING',
	'GUARD_ENFORCEMENT_LEDGER_OBSERVATION',
	'GUARD_ENFORCEMENT_LEDGER_VALIDATE_AND_SERIALIZE',
	'COMMAND_HANDLER_STATIC_PROJECTION',
	'COMMAND_EVENT_CONTRACT_STATIC_OVERLAY',
	'GUARD_CLASSIFICATION_STATIC_OVERLAY',
	'COMMAND_DISPATCH_STATIC_TOPOLOGY',
	'DEPENDENCY_CRUISER_EXECUTION',
	'DEPENDENCY_CRUISER_NORMALIZATION',
	'DEPENDENCY_PROVIDER_COMPARISON'
];

const LOGICAL_GRAPH_COMPOSITION_ONLY_COMPLETED_PHASES: readonly RepositorySmokePhase[] = [
	'SELECTED_SUBJECT_RESOLUTION',
	'STATIC_SEMANTIC_SNAPSHOT_BUILD',
	'MODULE_DEPENDENCY_GRAPH',
	'CALL_GRAPH',
	'LOGICAL_GRAPH_COMPOSITION'
];

const LOGICAL_GRAPH_COMPOSITION_ONLY_EXPECTED_SKIPPED_PHASES: readonly RepositorySmokePhase[] = [
	'REPOSITORY_DISCOVERY_PREFLIGHT',
	'STATIC_SEMANTIC_SNAPSHOT_VALIDATE_AND_SERIALIZE',
	'PROJECT_CONTEXT_GRAPH',
	'CONDITIONAL_EXPORT_RESOLUTION',
	'MODULE_RESOLUTION_TRACE',
	'DECLARATION_CONTEXT_ANALYSIS',
	'STRUCTURAL_MODULE_REACHABILITY_ANALYSIS',
	'STRUCTURAL_SCC_ANALYSIS',
	...LOGICAL_GRAPH_COMPOSITION_ONLY_DOWNSTREAM_SKIPPED_PHASES
];

const PROJECT_CONTEXT_GRAPH_ONLY_DOWNSTREAM_SKIPPED_PHASES: readonly RepositorySmokePhase[] = [
	'CONDITIONAL_EXPORT_RESOLUTION',
	'MODULE_RESOLUTION_TRACE',
	'DECLARATION_CONTEXT_ANALYSIS',
	'MODULE_DEPENDENCY_GRAPH',
	'STRUCTURAL_MODULE_REACHABILITY_ANALYSIS',
	'STRUCTURAL_SCC_ANALYSIS',
	'CALL_GRAPH',
	'LOGICAL_GRAPH_COMPOSITION',
	'READ_WRITE_ACCESS_GRAPH',
	'STATE_MACHINE_TOPOLOGY_OBSERVATION',
	'STATE_MACHINE_GRAPH_PROJECTION',
	'ARROW_COMMAND_CENSUS_SUBJECT_SELECTION',
	'ARROW_COMMAND_CENSUS_ARTIFACT_SET_BINDING',
	'ARROW_COMMAND_CENSUS_OBSERVATION',
	'ARROW_COMMAND_CENSUS_VALIDATE_AND_SERIALIZE',
	'GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_BINDING',
	'GUARD_ENFORCEMENT_LEDGER_OBSERVATION',
	'GUARD_ENFORCEMENT_LEDGER_VALIDATE_AND_SERIALIZE',
	'COMMAND_HANDLER_STATIC_PROJECTION',
	'COMMAND_EVENT_CONTRACT_STATIC_OVERLAY',
	'GUARD_CLASSIFICATION_STATIC_OVERLAY',
	'COMMAND_DISPATCH_STATIC_TOPOLOGY',
	'DEPENDENCY_CRUISER_EXECUTION',
	'DEPENDENCY_CRUISER_NORMALIZATION',
	'DEPENDENCY_PROVIDER_COMPARISON'
];

const PROJECT_CONTEXT_GRAPH_ONLY_COMPLETED_PHASES: readonly RepositorySmokePhase[] = [
	'SELECTED_SUBJECT_RESOLUTION',
	'STATIC_SEMANTIC_SNAPSHOT_BUILD',
	'PROJECT_CONTEXT_GRAPH'
];

const PROJECT_CONTEXT_GRAPH_ONLY_EXPECTED_SKIPPED_PHASES: readonly RepositorySmokePhase[] = [
	'REPOSITORY_DISCOVERY_PREFLIGHT',
	'STATIC_SEMANTIC_SNAPSHOT_VALIDATE_AND_SERIALIZE',
	...PROJECT_CONTEXT_GRAPH_ONLY_DOWNSTREAM_SKIPPED_PHASES
];

const CONDITIONAL_EXPORT_RESOLUTION_ONLY_DOWNSTREAM_SKIPPED_PHASES: readonly RepositorySmokePhase[] =
	PROJECT_CONTEXT_GRAPH_ONLY_DOWNSTREAM_SKIPPED_PHASES.filter(
		(phase) => phase !== 'CONDITIONAL_EXPORT_RESOLUTION'
	);

const CONDITIONAL_EXPORT_RESOLUTION_ONLY_COMPLETED_PHASES: readonly RepositorySmokePhase[] = [
	'SELECTED_SUBJECT_RESOLUTION',
	'STATIC_SEMANTIC_SNAPSHOT_BUILD',
	'PROJECT_CONTEXT_GRAPH',
	'CONDITIONAL_EXPORT_RESOLUTION'
];

const CONDITIONAL_EXPORT_RESOLUTION_ONLY_EXPECTED_SKIPPED_PHASES: readonly RepositorySmokePhase[] =
	[
		'REPOSITORY_DISCOVERY_PREFLIGHT',
		'STATIC_SEMANTIC_SNAPSHOT_VALIDATE_AND_SERIALIZE',
		...CONDITIONAL_EXPORT_RESOLUTION_ONLY_DOWNSTREAM_SKIPPED_PHASES
	];

const MODULE_RESOLUTION_TRACE_ONLY_DOWNSTREAM_SKIPPED_PHASES: readonly RepositorySmokePhase[] =
	CONDITIONAL_EXPORT_RESOLUTION_ONLY_DOWNSTREAM_SKIPPED_PHASES.filter(
		(phase) => phase !== 'MODULE_RESOLUTION_TRACE'
	);

const MODULE_RESOLUTION_TRACE_ONLY_COMPLETED_PHASES: readonly RepositorySmokePhase[] = [
	'SELECTED_SUBJECT_RESOLUTION',
	'STATIC_SEMANTIC_SNAPSHOT_BUILD',
	'PROJECT_CONTEXT_GRAPH',
	'CONDITIONAL_EXPORT_RESOLUTION',
	'MODULE_RESOLUTION_TRACE'
];

const MODULE_RESOLUTION_TRACE_ONLY_EXPECTED_SKIPPED_PHASES: readonly RepositorySmokePhase[] = [
	'REPOSITORY_DISCOVERY_PREFLIGHT',
	'STATIC_SEMANTIC_SNAPSHOT_VALIDATE_AND_SERIALIZE',
	...MODULE_RESOLUTION_TRACE_ONLY_DOWNSTREAM_SKIPPED_PHASES
];

const DECLARATION_CONTEXT_ANALYSIS_ONLY_DOWNSTREAM_SKIPPED_PHASES: readonly RepositorySmokePhase[] =
	MODULE_RESOLUTION_TRACE_ONLY_DOWNSTREAM_SKIPPED_PHASES.filter(
		(phase) => phase !== 'DECLARATION_CONTEXT_ANALYSIS'
	);

const DECLARATION_CONTEXT_ANALYSIS_ONLY_COMPLETED_PHASES: readonly RepositorySmokePhase[] = [
	'SELECTED_SUBJECT_RESOLUTION',
	'STATIC_SEMANTIC_SNAPSHOT_BUILD',
	'PROJECT_CONTEXT_GRAPH',
	'CONDITIONAL_EXPORT_RESOLUTION',
	'MODULE_RESOLUTION_TRACE',
	'DECLARATION_CONTEXT_ANALYSIS'
];

const DECLARATION_CONTEXT_ANALYSIS_ONLY_EXPECTED_SKIPPED_PHASES: readonly RepositorySmokePhase[] = [
	'REPOSITORY_DISCOVERY_PREFLIGHT',
	'STATIC_SEMANTIC_SNAPSHOT_VALIDATE_AND_SERIALIZE',
	...DECLARATION_CONTEXT_ANALYSIS_ONLY_DOWNSTREAM_SKIPPED_PHASES
];

interface RepositorySmokeTelemetryOptions {
	/** Deterministic test clock; one sample supplies both wall and monotonic values. */
	readonly now?: () => number;
	readonly write?: (line: string) => void;
}

function redactTelemetryPath(text: string, path: string, replacement: string): string {
	const pattern = path
		.split(/[\\/]+/u)
		.map((part) => part.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
		.join('[\\\\/]');
	return pattern.length === 0 ? text : text.replace(new RegExp(pattern, 'giu'), replacement);
}

function sanitizeTelemetryText(text: string): string {
	return redactTelemetryPath(
		redactTelemetryPath(
			redactTelemetryPath(text, REPOSITORY_ROOT, '<repository-root>'),
			tmpdir(),
			'<temporary-root>'
		),
		process.execPath,
		'<process-executable>'
	).slice(0, 4_096);
}

function errorTelemetry(error: unknown): { readonly message: string; readonly name: string } {
	if (error instanceof Error)
		return { message: sanitizeTelemetryText(error.message), name: error.name };
	try {
		return { message: sanitizeTelemetryText(String(error)), name: typeof error };
	} catch {
		return { message: '<unprintable thrown value>', name: typeof error };
	}
}

function createRepositorySmokeTelemetry(
	details: Readonly<Record<string, unknown>>,
	options: RepositorySmokeTelemetryOptions = {}
) {
	const readTimes = (): { readonly monotonicMs: number; readonly wallMs: number } => {
		if (options.now !== undefined) {
			const value = options.now();
			return { monotonicMs: value, wallMs: value };
		}
		return { monotonicMs: performance.now(), wallMs: Date.now() };
	};
	const write = options.write ?? ((line: string): void => void process.stdout.write(line));
	const runStarted = readTimes();
	let sequence = 0;
	let active: {
		readonly details: Readonly<Record<string, unknown>>;
		readonly name: RepositorySmokePhase;
		readonly startedAtMonotonicMs: number;
	} | null = null;
	let ended = false;
	const completed: Array<{ readonly durationMs: number; readonly phase: RepositorySmokePhase }> =
		[];
	const skipped: RepositorySmokePhase[] = [];
	const emit = (event: Readonly<Record<string, unknown>>): void => {
		write(
			`${JSON.stringify({ schemaVersion: REPOSITORY_SMOKE_TELEMETRY_SCHEMA_VERSION, sequence, ...event })}\n`
		);
		sequence += 1;
	};
	const phaseDurationsMs = (): Readonly<Record<string, number>> =>
		Object.fromEntries(completed.map((entry) => [entry.phase, entry.durationMs]));
	emit({
		details,
		event: 'CSAA_REPOSITORY_SMOKE_RUN',
		runElapsedMs: 0,
		state: 'STARTED',
		timestamp: new Date(runStarted.wallMs).toISOString()
	});
	return {
		complete(completionDetails: Readonly<Record<string, unknown>> = {}): void {
			if (active === null) throw new Error('Repository smoke telemetry has no active phase.');
			const finishedAt = readTimes();
			const durationMs = Math.max(
				0,
				Math.round(finishedAt.monotonicMs - active.startedAtMonotonicMs)
			);
			completed.push({ durationMs, phase: active.name });
			emit({
				details: completionDetails,
				durationMs,
				event: 'CSAA_REPOSITORY_SMOKE_PHASE',
				phase: active.name,
				runElapsedMs: Math.max(0, Math.round(finishedAt.monotonicMs - runStarted.monotonicMs)),
				state: 'COMPLETED',
				timestamp: new Date(finishedAt.wallMs).toISOString()
			});
			active = null;
		},
		fail(error: unknown): void {
			if (ended) return;
			const failedAt = readTimes();
			const failedPhase = active?.name ?? null;
			if (active !== null)
				emit({
					details: active.details,
					durationMs: Math.max(0, Math.round(failedAt.monotonicMs - active.startedAtMonotonicMs)),
					error: errorTelemetry(error),
					event: 'CSAA_REPOSITORY_SMOKE_PHASE',
					phase: active.name,
					runElapsedMs: Math.max(0, Math.round(failedAt.monotonicMs - runStarted.monotonicMs)),
					state: 'FAILED',
					timestamp: new Date(failedAt.wallMs).toISOString()
				});
			active = null;
			emit({
				error: errorTelemetry(error),
				event: 'CSAA_REPOSITORY_SMOKE_RUN',
				failedPhase,
				phaseDurationsMs: phaseDurationsMs(),
				runElapsedMs: Math.max(0, Math.round(failedAt.monotonicMs - runStarted.monotonicMs)),
				state: 'FAILED',
				timestamp: new Date(failedAt.wallMs).toISOString()
			});
			ended = true;
		},
		finish(completionDetails: Readonly<Record<string, unknown>> = {}): void {
			if (active !== null)
				throw new Error(`Repository smoke phase ${active.name} is still active.`);
			if (ended) throw new Error('Repository smoke telemetry has already ended.');
			const finishedAt = readTimes();
			emit({
				details: completionDetails,
				event: 'CSAA_REPOSITORY_SMOKE_RUN',
				phaseDurationsMs: phaseDurationsMs(),
				runElapsedMs: Math.max(0, Math.round(finishedAt.monotonicMs - runStarted.monotonicMs)),
				state: 'COMPLETED',
				timestamp: new Date(finishedAt.wallMs).toISOString()
			});
			ended = true;
		},
		phaseDurationsMs,
		skip(name: RepositorySmokePhase, skipDetails: Readonly<Record<string, unknown>>): void {
			if (active !== null)
				throw new Error(`Repository smoke phase ${active.name} is still active.`);
			if (ended) throw new Error('Repository smoke telemetry has already ended.');
			const skippedAt = readTimes();
			skipped.push(name);
			emit({
				details: skipDetails,
				durationMs: 0,
				event: 'CSAA_REPOSITORY_SMOKE_PHASE',
				phase: name,
				runElapsedMs: Math.max(0, Math.round(skippedAt.monotonicMs - runStarted.monotonicMs)),
				state: 'SKIPPED',
				timestamp: new Date(skippedAt.wallMs).toISOString()
			});
		},
		skippedPhases(): readonly RepositorySmokePhase[] {
			return [...skipped];
		},
		start(name: RepositorySmokePhase, phaseDetails: Readonly<Record<string, unknown>> = {}): void {
			if (active !== null)
				throw new Error(`Repository smoke phase ${active.name} is still active.`);
			if (ended) throw new Error('Repository smoke telemetry has already ended.');
			const startedAt = readTimes();
			active = { details: phaseDetails, name, startedAtMonotonicMs: startedAt.monotonicMs };
			emit({
				details: phaseDetails,
				event: 'CSAA_REPOSITORY_SMOKE_PHASE',
				phase: name,
				runElapsedMs: Math.max(0, Math.round(startedAt.monotonicMs - runStarted.monotonicMs)),
				state: 'STARTED',
				timestamp: new Date(startedAt.wallMs).toISOString()
			});
		}
	};
}

function providerInputPaths(projectPaths: readonly string[]): string[] {
	if (SELECTED_PROJECTS === null) return ['apps', 'packages'];
	return [
		...new Set(
			projectPaths.map((path) => {
				const separator = path.lastIndexOf('/');
				return separator < 0 ? path : path.slice(0, separator);
			})
		)
	].sort();
}

function resolveSmokeSubject(scope: ResolveSubjectRequest['scope']) {
	return resolveSubject({
		budgets: {
			maxBytes: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES,
			maxConfigDepth: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_CONFIG_DEPTH,
			maxDiagnostics: 100_000,
			maxDurationMs: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_DURATION_MS,
			maxFiles: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_FILES,
			maxProjects: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_PROJECTS
		},
		expectEmpty: false,
		filters: { exclude: [], include: [] },
		operationVersion: 'jan-csaa-repository-smoke/1.0.0',
		outputs: [],
		policyVersion: SUBJECT_POLICY_VERSION,
		rootLocator: REPOSITORY_ROOT,
		schemaVersion: SUBJECT_REQUEST_SCHEMA_VERSION,
		scope,
		subjectKind: 'WORKTREE'
	});
}

describe('repository smoke phase telemetry', () => {
	it('selects an explicit structural profile without changing the full default', () => {
		expect(repositorySmokeProfile(undefined)).toBe('FULL');
		expect(repositorySmokeProfile('')).toBe('FULL');
		expect(repositorySmokeProfile(' structural ')).toBe('STRUCTURAL');
		expect(() => repositorySmokeProfile('unknown')).toThrow(
			'Unsupported CSAA_REPOSITORY_SMOKE_PROFILE: unknown'
		);
		expect(repositorySmokeSuite(undefined)).toBe('FULL_SUITE');
		expect(repositorySmokeSuite('')).toBe('FULL_SUITE');
		expect(repositorySmokeSuite(' command_handler ')).toBe('COMMAND_HANDLER_ONLY');
		expect(repositorySmokeSuite(' command_handler_only ')).toBe('COMMAND_HANDLER_ONLY');
		expect(repositorySmokeSuite(' conditional_export_resolution ')).toBe(
			'CONDITIONAL_EXPORT_RESOLUTION_ONLY'
		);
		expect(repositorySmokeSuite(' conditional_export_resolution_only ')).toBe(
			'CONDITIONAL_EXPORT_RESOLUTION_ONLY'
		);
		expect(repositorySmokeSuite(' declaration_context_analysis ')).toBe(
			'DECLARATION_CONTEXT_ANALYSIS_ONLY'
		);
		expect(repositorySmokeSuite(' declaration_context_analysis_only ')).toBe(
			'DECLARATION_CONTEXT_ANALYSIS_ONLY'
		);
		expect(repositorySmokeSuite(' module_resolution_trace ')).toBe('MODULE_RESOLUTION_TRACE_ONLY');
		expect(repositorySmokeSuite(' module_resolution_trace_only ')).toBe(
			'MODULE_RESOLUTION_TRACE_ONLY'
		);
		expect(repositorySmokeSuite(' structural_module_reachability ')).toBe(
			'STRUCTURAL_MODULE_REACHABILITY_ONLY'
		);
		expect(repositorySmokeSuite(' structural_module_reachability_only ')).toBe(
			'STRUCTURAL_MODULE_REACHABILITY_ONLY'
		);
		expect(repositorySmokeSuite(' structural_scc ')).toBe('STRUCTURAL_SCC_ONLY');
		expect(repositorySmokeSuite(' structural_scc_only ')).toBe('STRUCTURAL_SCC_ONLY');
		expect(repositorySmokeSuite(' logical_graph_composition ')).toBe(
			'LOGICAL_GRAPH_COMPOSITION_ONLY'
		);
		expect(repositorySmokeSuite(' logical_graph_composition_only ')).toBe(
			'LOGICAL_GRAPH_COMPOSITION_ONLY'
		);
		expect(repositorySmokeSuite(' project_context_graph ')).toBe('PROJECT_CONTEXT_GRAPH_ONLY');
		expect(repositorySmokeSuite(' project_context_graph_only ')).toBe('PROJECT_CONTEXT_GRAPH_ONLY');
		expect(repositorySmokeSuite(' full ')).toBe('FULL_SUITE');
		expect(repositorySmokeSuite(' full_suite ')).toBe('FULL_SUITE');
		expect(() => repositorySmokeSuite('unknown')).toThrow(
			'Unsupported CSAA_REPOSITORY_SMOKE_SUITE: unknown'
		);
		expect(() => assertRepositorySmokeSelection('FULL', 'COMMAND_HANDLER_ONLY', '1')).toThrow(
			'COMMAND_HANDLER_ONLY requires CSAA_REPOSITORY_SMOKE_PROFILE=STRUCTURAL.'
		);
		for (const selector of [undefined, '', '0', 'all', ' 1 '])
			expect(() =>
				assertRepositorySmokeSelection('STRUCTURAL', 'COMMAND_HANDLER_ONLY', selector)
			).toThrow('COMMAND_HANDLER_ONLY requires CSAA_REPOSITORY_SMOKE=1.');
		expect(() =>
			assertRepositorySmokeSelection('STRUCTURAL', 'COMMAND_HANDLER_ONLY', '1')
		).not.toThrow();
		expect(() =>
			assertRepositorySmokeSelection('FULL', 'STRUCTURAL_MODULE_REACHABILITY_ONLY', '1')
		).toThrow(
			'STRUCTURAL_MODULE_REACHABILITY_ONLY requires CSAA_REPOSITORY_SMOKE_PROFILE=STRUCTURAL.'
		);
		expect(() =>
			assertRepositorySmokeSelection('STRUCTURAL', 'STRUCTURAL_MODULE_REACHABILITY_ONLY', 'all')
		).toThrow('STRUCTURAL_MODULE_REACHABILITY_ONLY requires CSAA_REPOSITORY_SMOKE=1.');
		expect(() =>
			assertRepositorySmokeSelection('STRUCTURAL', 'STRUCTURAL_MODULE_REACHABILITY_ONLY', '1')
		).not.toThrow();
		expect(() => assertRepositorySmokeSelection('FULL', 'STRUCTURAL_SCC_ONLY', '1')).toThrow(
			'STRUCTURAL_SCC_ONLY requires CSAA_REPOSITORY_SMOKE_PROFILE=STRUCTURAL.'
		);
		expect(() =>
			assertRepositorySmokeSelection('STRUCTURAL', 'STRUCTURAL_SCC_ONLY', 'all')
		).toThrow('STRUCTURAL_SCC_ONLY requires CSAA_REPOSITORY_SMOKE=1.');
		expect(() =>
			assertRepositorySmokeSelection('STRUCTURAL', 'STRUCTURAL_SCC_ONLY', '1')
		).not.toThrow();
		expect(() =>
			assertRepositorySmokeSelection('STRUCTURAL', 'LOGICAL_GRAPH_COMPOSITION_ONLY', '1')
		).toThrow('LOGICAL_GRAPH_COMPOSITION_ONLY requires CSAA_REPOSITORY_SMOKE_PROFILE=FULL.');
		expect(() =>
			assertRepositorySmokeSelection('FULL', 'LOGICAL_GRAPH_COMPOSITION_ONLY', 'all')
		).toThrow('LOGICAL_GRAPH_COMPOSITION_ONLY requires CSAA_REPOSITORY_SMOKE=1.');
		expect(() =>
			assertRepositorySmokeSelection('FULL', 'LOGICAL_GRAPH_COMPOSITION_ONLY', '1')
		).not.toThrow();
		expect(() => assertRepositorySmokeSelection('FULL', 'PROJECT_CONTEXT_GRAPH_ONLY', '1')).toThrow(
			'PROJECT_CONTEXT_GRAPH_ONLY requires CSAA_REPOSITORY_SMOKE_PROFILE=STRUCTURAL.'
		);
		expect(() =>
			assertRepositorySmokeSelection('STRUCTURAL', 'PROJECT_CONTEXT_GRAPH_ONLY', 'all')
		).toThrow('PROJECT_CONTEXT_GRAPH_ONLY requires CSAA_REPOSITORY_SMOKE=1.');
		expect(() =>
			assertRepositorySmokeSelection('STRUCTURAL', 'PROJECT_CONTEXT_GRAPH_ONLY', '1')
		).not.toThrow();
		expect(() =>
			assertRepositorySmokeSelection('FULL', 'CONDITIONAL_EXPORT_RESOLUTION_ONLY', '1')
		).toThrow(
			'CONDITIONAL_EXPORT_RESOLUTION_ONLY requires CSAA_REPOSITORY_SMOKE_PROFILE=STRUCTURAL.'
		);
		expect(() =>
			assertRepositorySmokeSelection('STRUCTURAL', 'CONDITIONAL_EXPORT_RESOLUTION_ONLY', 'all')
		).toThrow('CONDITIONAL_EXPORT_RESOLUTION_ONLY requires CSAA_REPOSITORY_SMOKE=1.');
		expect(() =>
			assertRepositorySmokeSelection('STRUCTURAL', 'CONDITIONAL_EXPORT_RESOLUTION_ONLY', '1')
		).not.toThrow();
		expect(() =>
			assertRepositorySmokeSelection('FULL', 'MODULE_RESOLUTION_TRACE_ONLY', '1')
		).toThrow('MODULE_RESOLUTION_TRACE_ONLY requires CSAA_REPOSITORY_SMOKE_PROFILE=STRUCTURAL.');
		expect(() =>
			assertRepositorySmokeSelection('STRUCTURAL', 'MODULE_RESOLUTION_TRACE_ONLY', 'all')
		).toThrow('MODULE_RESOLUTION_TRACE_ONLY requires CSAA_REPOSITORY_SMOKE=1.');
		expect(() =>
			assertRepositorySmokeSelection('STRUCTURAL', 'MODULE_RESOLUTION_TRACE_ONLY', '1')
		).not.toThrow();
		expect(() =>
			assertRepositorySmokeSelection('FULL', 'DECLARATION_CONTEXT_ANALYSIS_ONLY', '1')
		).toThrow(
			'DECLARATION_CONTEXT_ANALYSIS_ONLY requires CSAA_REPOSITORY_SMOKE_PROFILE=STRUCTURAL.'
		);
		expect(() =>
			assertRepositorySmokeSelection('STRUCTURAL', 'DECLARATION_CONTEXT_ANALYSIS_ONLY', 'all')
		).toThrow('DECLARATION_CONTEXT_ANALYSIS_ONLY requires CSAA_REPOSITORY_SMOKE=1.');
		expect(() =>
			assertRepositorySmokeSelection('STRUCTURAL', 'DECLARATION_CONTEXT_ANALYSIS_ONLY', '1')
		).not.toThrow();
		expect(selectedProjectsForSmoke('FULL', 'FULL_SUITE', '1')).toEqual(REPRESENTATIVE_PROJECTS);
		expect(selectedProjectsForSmoke('FULL', 'LOGICAL_GRAPH_COMPOSITION_ONLY', '1')).toEqual(
			COMMAND_HANDLER_COMPILER_CLOSURE_PROJECTS
		);
		expect(selectedProjectsForSmoke('STRUCTURAL', 'STRUCTURAL_SCC_ONLY', '1')).toEqual(
			COMMAND_HANDLER_COMPILER_CLOSURE_PROJECTS
		);
		expect(selectedProjectsForSmoke('STRUCTURAL', 'PROJECT_CONTEXT_GRAPH_ONLY', '1')).toEqual(
			COMMAND_HANDLER_COMPILER_CLOSURE_PROJECTS
		);
		expect(
			selectedProjectsForSmoke('STRUCTURAL', 'CONDITIONAL_EXPORT_RESOLUTION_ONLY', '1')
		).toEqual(COMMAND_HANDLER_COMPILER_CLOSURE_PROJECTS);
		expect(selectedProjectsForSmoke('STRUCTURAL', 'MODULE_RESOLUTION_TRACE_ONLY', '1')).toEqual(
			COMMAND_HANDLER_COMPILER_CLOSURE_PROJECTS
		);
		expect(
			selectedProjectsForSmoke('STRUCTURAL', 'DECLARATION_CONTEXT_ANALYSIS_ONLY', '1')
		).toEqual(COMMAND_HANDLER_COMPILER_CLOSURE_PROJECTS);
		expect(selectedProjectsForSmoke('FULL', 'FULL_SUITE', 'all')).toBeNull();
		expect(REPOSITORY_SMOKE_PROJECTION_PLANS.COMMAND_HANDLER_ONLY).toEqual({
			runIndependentSemanticRevalidation: false,
			runCallGraph: false,
			runCommandEventContractOverlay: true,
			runConditionalExportResolution: false,
			runDeclarationContextAnalysis: false,
			runDependencyProviderComparison: false,
			runGuardClassificationOverlay: true,
			runLogicalGraphComposition: false,
			runModuleDependencyGraph: false,
			runModuleResolutionTrace: false,
			runProjectContextGraph: false,
			runReadWriteAccessGraph: false,
			runRepositoryDiscoveryPreflight: false,
			runStateMachineProjection: true,
			runStructuralModuleReachabilityAnalysis: false,
			runStructuralSccAnalysis: false,
			suite: 'COMMAND_HANDLER_ONLY',
			terminateAfterConditionalExportResolution: false,
			terminateAfterDeclarationContextAnalysis: false,
			terminateAfterLogicalGraphComposition: false,
			terminateAfterModuleResolutionTrace: false,
			terminateAfterProjectContextGraph: false,
			terminateAfterStructuralModuleReachabilityAnalysis: false,
			terminateAfterStructuralSccAnalysis: false
		});
		expect(REPOSITORY_SMOKE_PROJECTION_PLANS.FULL_SUITE).toEqual({
			runIndependentSemanticRevalidation: true,
			runCallGraph: true,
			runCommandEventContractOverlay: false,
			runConditionalExportResolution: false,
			runDeclarationContextAnalysis: false,
			runDependencyProviderComparison: true,
			runGuardClassificationOverlay: false,
			runLogicalGraphComposition: true,
			runModuleDependencyGraph: true,
			runModuleResolutionTrace: false,
			runProjectContextGraph: true,
			runReadWriteAccessGraph: true,
			runRepositoryDiscoveryPreflight: true,
			runStateMachineProjection: true,
			runStructuralModuleReachabilityAnalysis: true,
			runStructuralSccAnalysis: true,
			suite: 'FULL_SUITE',
			terminateAfterConditionalExportResolution: false,
			terminateAfterDeclarationContextAnalysis: false,
			terminateAfterLogicalGraphComposition: false,
			terminateAfterModuleResolutionTrace: false,
			terminateAfterProjectContextGraph: false,
			terminateAfterStructuralModuleReachabilityAnalysis: false,
			terminateAfterStructuralSccAnalysis: false
		});
		expect(REPOSITORY_SMOKE_PROJECTION_PLANS.LOGICAL_GRAPH_COMPOSITION_ONLY).toEqual({
			runIndependentSemanticRevalidation: false,
			runCallGraph: true,
			runCommandEventContractOverlay: false,
			runConditionalExportResolution: false,
			runDeclarationContextAnalysis: false,
			runDependencyProviderComparison: false,
			runGuardClassificationOverlay: false,
			runLogicalGraphComposition: true,
			runModuleDependencyGraph: true,
			runModuleResolutionTrace: false,
			runProjectContextGraph: false,
			runReadWriteAccessGraph: false,
			runRepositoryDiscoveryPreflight: false,
			runStateMachineProjection: false,
			runStructuralModuleReachabilityAnalysis: false,
			runStructuralSccAnalysis: false,
			suite: 'LOGICAL_GRAPH_COMPOSITION_ONLY',
			terminateAfterConditionalExportResolution: false,
			terminateAfterDeclarationContextAnalysis: false,
			terminateAfterLogicalGraphComposition: true,
			terminateAfterModuleResolutionTrace: false,
			terminateAfterProjectContextGraph: false,
			terminateAfterStructuralModuleReachabilityAnalysis: false,
			terminateAfterStructuralSccAnalysis: false
		});
		expect(REPOSITORY_SMOKE_PROJECTION_PLANS.PROJECT_CONTEXT_GRAPH_ONLY).toEqual({
			runIndependentSemanticRevalidation: false,
			runCallGraph: false,
			runCommandEventContractOverlay: false,
			runConditionalExportResolution: false,
			runDeclarationContextAnalysis: false,
			runDependencyProviderComparison: false,
			runGuardClassificationOverlay: false,
			runLogicalGraphComposition: false,
			runModuleDependencyGraph: false,
			runModuleResolutionTrace: false,
			runProjectContextGraph: true,
			runReadWriteAccessGraph: false,
			runRepositoryDiscoveryPreflight: false,
			runStateMachineProjection: false,
			runStructuralModuleReachabilityAnalysis: false,
			runStructuralSccAnalysis: false,
			suite: 'PROJECT_CONTEXT_GRAPH_ONLY',
			terminateAfterConditionalExportResolution: false,
			terminateAfterDeclarationContextAnalysis: false,
			terminateAfterLogicalGraphComposition: false,
			terminateAfterModuleResolutionTrace: false,
			terminateAfterProjectContextGraph: true,
			terminateAfterStructuralModuleReachabilityAnalysis: false,
			terminateAfterStructuralSccAnalysis: false
		});
		expect(REPOSITORY_SMOKE_PROJECTION_PLANS.CONDITIONAL_EXPORT_RESOLUTION_ONLY).toEqual({
			runIndependentSemanticRevalidation: false,
			runCallGraph: false,
			runCommandEventContractOverlay: false,
			runConditionalExportResolution: true,
			runDeclarationContextAnalysis: false,
			runDependencyProviderComparison: false,
			runGuardClassificationOverlay: false,
			runLogicalGraphComposition: false,
			runModuleDependencyGraph: false,
			runModuleResolutionTrace: false,
			runProjectContextGraph: true,
			runReadWriteAccessGraph: false,
			runRepositoryDiscoveryPreflight: false,
			runStateMachineProjection: false,
			runStructuralModuleReachabilityAnalysis: false,
			runStructuralSccAnalysis: false,
			suite: 'CONDITIONAL_EXPORT_RESOLUTION_ONLY',
			terminateAfterConditionalExportResolution: true,
			terminateAfterDeclarationContextAnalysis: false,
			terminateAfterLogicalGraphComposition: false,
			terminateAfterModuleResolutionTrace: false,
			terminateAfterProjectContextGraph: false,
			terminateAfterStructuralModuleReachabilityAnalysis: false,
			terminateAfterStructuralSccAnalysis: false
		});
		expect(REPOSITORY_SMOKE_PROJECTION_PLANS.MODULE_RESOLUTION_TRACE_ONLY).toEqual({
			runIndependentSemanticRevalidation: false,
			runCallGraph: false,
			runCommandEventContractOverlay: false,
			runConditionalExportResolution: true,
			runDeclarationContextAnalysis: false,
			runDependencyProviderComparison: false,
			runGuardClassificationOverlay: false,
			runLogicalGraphComposition: false,
			runModuleDependencyGraph: false,
			runModuleResolutionTrace: true,
			runProjectContextGraph: true,
			runReadWriteAccessGraph: false,
			runRepositoryDiscoveryPreflight: false,
			runStateMachineProjection: false,
			runStructuralModuleReachabilityAnalysis: false,
			runStructuralSccAnalysis: false,
			suite: 'MODULE_RESOLUTION_TRACE_ONLY',
			terminateAfterConditionalExportResolution: false,
			terminateAfterDeclarationContextAnalysis: false,
			terminateAfterLogicalGraphComposition: false,
			terminateAfterModuleResolutionTrace: true,
			terminateAfterProjectContextGraph: false,
			terminateAfterStructuralModuleReachabilityAnalysis: false,
			terminateAfterStructuralSccAnalysis: false
		});
		expect(REPOSITORY_SMOKE_PROJECTION_PLANS.DECLARATION_CONTEXT_ANALYSIS_ONLY).toEqual({
			runIndependentSemanticRevalidation: false,
			runCallGraph: false,
			runCommandEventContractOverlay: false,
			runConditionalExportResolution: true,
			runDeclarationContextAnalysis: true,
			runDependencyProviderComparison: false,
			runGuardClassificationOverlay: false,
			runLogicalGraphComposition: false,
			runModuleDependencyGraph: false,
			runModuleResolutionTrace: true,
			runProjectContextGraph: true,
			runReadWriteAccessGraph: false,
			runRepositoryDiscoveryPreflight: false,
			runStateMachineProjection: false,
			runStructuralModuleReachabilityAnalysis: false,
			runStructuralSccAnalysis: false,
			suite: 'DECLARATION_CONTEXT_ANALYSIS_ONLY',
			terminateAfterConditionalExportResolution: false,
			terminateAfterDeclarationContextAnalysis: true,
			terminateAfterLogicalGraphComposition: false,
			terminateAfterModuleResolutionTrace: false,
			terminateAfterProjectContextGraph: false,
			terminateAfterStructuralModuleReachabilityAnalysis: false,
			terminateAfterStructuralSccAnalysis: false
		});
		expect(REPOSITORY_SMOKE_PROJECTION_PLANS.STRUCTURAL_MODULE_REACHABILITY_ONLY).toEqual({
			runIndependentSemanticRevalidation: false,
			runCallGraph: false,
			runCommandEventContractOverlay: false,
			runConditionalExportResolution: false,
			runDeclarationContextAnalysis: false,
			runDependencyProviderComparison: false,
			runGuardClassificationOverlay: false,
			runLogicalGraphComposition: false,
			runModuleDependencyGraph: true,
			runModuleResolutionTrace: false,
			runProjectContextGraph: false,
			runReadWriteAccessGraph: false,
			runRepositoryDiscoveryPreflight: false,
			runStateMachineProjection: false,
			runStructuralModuleReachabilityAnalysis: true,
			runStructuralSccAnalysis: false,
			suite: 'STRUCTURAL_MODULE_REACHABILITY_ONLY',
			terminateAfterConditionalExportResolution: false,
			terminateAfterDeclarationContextAnalysis: false,
			terminateAfterLogicalGraphComposition: false,
			terminateAfterModuleResolutionTrace: false,
			terminateAfterProjectContextGraph: false,
			terminateAfterStructuralModuleReachabilityAnalysis: true,
			terminateAfterStructuralSccAnalysis: false
		});
		expect(REPOSITORY_SMOKE_PROJECTION_PLANS.STRUCTURAL_SCC_ONLY).toEqual({
			runIndependentSemanticRevalidation: false,
			runCallGraph: false,
			runCommandEventContractOverlay: false,
			runConditionalExportResolution: false,
			runDeclarationContextAnalysis: false,
			runDependencyProviderComparison: false,
			runGuardClassificationOverlay: false,
			runLogicalGraphComposition: false,
			runModuleDependencyGraph: true,
			runModuleResolutionTrace: false,
			runProjectContextGraph: false,
			runReadWriteAccessGraph: false,
			runRepositoryDiscoveryPreflight: false,
			runStateMachineProjection: false,
			runStructuralModuleReachabilityAnalysis: false,
			runStructuralSccAnalysis: true,
			suite: 'STRUCTURAL_SCC_ONLY',
			terminateAfterConditionalExportResolution: false,
			terminateAfterDeclarationContextAnalysis: false,
			terminateAfterLogicalGraphComposition: false,
			terminateAfterModuleResolutionTrace: false,
			terminateAfterProjectContextGraph: false,
			terminateAfterStructuralModuleReachabilityAnalysis: false,
			terminateAfterStructuralSccAnalysis: true
		});
		expect(STRUCTURAL_SCC_ONLY_COMPLETED_PHASES).toEqual([
			'SELECTED_SUBJECT_RESOLUTION',
			'STATIC_SEMANTIC_SNAPSHOT_BUILD',
			'MODULE_DEPENDENCY_GRAPH',
			'STRUCTURAL_SCC_ANALYSIS'
		]);
		expect(STRUCTURAL_SCC_ONLY_EXPECTED_SKIPPED_PHASES).toEqual([
			'REPOSITORY_DISCOVERY_PREFLIGHT',
			'STATIC_SEMANTIC_SNAPSHOT_VALIDATE_AND_SERIALIZE',
			'PROJECT_CONTEXT_GRAPH',
			'CONDITIONAL_EXPORT_RESOLUTION',
			'MODULE_RESOLUTION_TRACE',
			'DECLARATION_CONTEXT_ANALYSIS',
			'STRUCTURAL_MODULE_REACHABILITY_ANALYSIS',
			'CALL_GRAPH',
			'LOGICAL_GRAPH_COMPOSITION',
			'READ_WRITE_ACCESS_GRAPH',
			'STATE_MACHINE_TOPOLOGY_OBSERVATION',
			'STATE_MACHINE_GRAPH_PROJECTION',
			'ARROW_COMMAND_CENSUS_SUBJECT_SELECTION',
			'ARROW_COMMAND_CENSUS_ARTIFACT_SET_BINDING',
			'ARROW_COMMAND_CENSUS_OBSERVATION',
			'ARROW_COMMAND_CENSUS_VALIDATE_AND_SERIALIZE',
			'GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_BINDING',
			'GUARD_ENFORCEMENT_LEDGER_OBSERVATION',
			'GUARD_ENFORCEMENT_LEDGER_VALIDATE_AND_SERIALIZE',
			'COMMAND_HANDLER_STATIC_PROJECTION',
			'COMMAND_EVENT_CONTRACT_STATIC_OVERLAY',
			'GUARD_CLASSIFICATION_STATIC_OVERLAY',
			'COMMAND_DISPATCH_STATIC_TOPOLOGY',
			'DEPENDENCY_CRUISER_EXECUTION',
			'DEPENDENCY_CRUISER_NORMALIZATION',
			'DEPENDENCY_PROVIDER_COMPARISON'
		]);
		expect(STRUCTURAL_MODULE_REACHABILITY_ONLY_COMPLETED_PHASES).toEqual([
			'SELECTED_SUBJECT_RESOLUTION',
			'STATIC_SEMANTIC_SNAPSHOT_BUILD',
			'MODULE_DEPENDENCY_GRAPH',
			'STRUCTURAL_MODULE_REACHABILITY_ANALYSIS'
		]);
		expect(STRUCTURAL_MODULE_REACHABILITY_ONLY_EXPECTED_SKIPPED_PHASES).toEqual([
			'REPOSITORY_DISCOVERY_PREFLIGHT',
			'STATIC_SEMANTIC_SNAPSHOT_VALIDATE_AND_SERIALIZE',
			'PROJECT_CONTEXT_GRAPH',
			'CONDITIONAL_EXPORT_RESOLUTION',
			'MODULE_RESOLUTION_TRACE',
			'DECLARATION_CONTEXT_ANALYSIS',
			'STRUCTURAL_SCC_ANALYSIS',
			'CALL_GRAPH',
			'LOGICAL_GRAPH_COMPOSITION',
			'READ_WRITE_ACCESS_GRAPH',
			'STATE_MACHINE_TOPOLOGY_OBSERVATION',
			'STATE_MACHINE_GRAPH_PROJECTION',
			'ARROW_COMMAND_CENSUS_SUBJECT_SELECTION',
			'ARROW_COMMAND_CENSUS_ARTIFACT_SET_BINDING',
			'ARROW_COMMAND_CENSUS_OBSERVATION',
			'ARROW_COMMAND_CENSUS_VALIDATE_AND_SERIALIZE',
			'GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_BINDING',
			'GUARD_ENFORCEMENT_LEDGER_OBSERVATION',
			'GUARD_ENFORCEMENT_LEDGER_VALIDATE_AND_SERIALIZE',
			'COMMAND_HANDLER_STATIC_PROJECTION',
			'COMMAND_EVENT_CONTRACT_STATIC_OVERLAY',
			'GUARD_CLASSIFICATION_STATIC_OVERLAY',
			'COMMAND_DISPATCH_STATIC_TOPOLOGY',
			'DEPENDENCY_CRUISER_EXECUTION',
			'DEPENDENCY_CRUISER_NORMALIZATION',
			'DEPENDENCY_PROVIDER_COMPARISON'
		]);
		expect(LOGICAL_GRAPH_COMPOSITION_ONLY_COMPLETED_PHASES).toEqual([
			'SELECTED_SUBJECT_RESOLUTION',
			'STATIC_SEMANTIC_SNAPSHOT_BUILD',
			'MODULE_DEPENDENCY_GRAPH',
			'CALL_GRAPH',
			'LOGICAL_GRAPH_COMPOSITION'
		]);
		expect(LOGICAL_GRAPH_COMPOSITION_ONLY_EXPECTED_SKIPPED_PHASES).toEqual([
			'REPOSITORY_DISCOVERY_PREFLIGHT',
			'STATIC_SEMANTIC_SNAPSHOT_VALIDATE_AND_SERIALIZE',
			'PROJECT_CONTEXT_GRAPH',
			'CONDITIONAL_EXPORT_RESOLUTION',
			'MODULE_RESOLUTION_TRACE',
			'DECLARATION_CONTEXT_ANALYSIS',
			'STRUCTURAL_MODULE_REACHABILITY_ANALYSIS',
			'STRUCTURAL_SCC_ANALYSIS',
			'READ_WRITE_ACCESS_GRAPH',
			'STATE_MACHINE_TOPOLOGY_OBSERVATION',
			'STATE_MACHINE_GRAPH_PROJECTION',
			'ARROW_COMMAND_CENSUS_SUBJECT_SELECTION',
			'ARROW_COMMAND_CENSUS_ARTIFACT_SET_BINDING',
			'ARROW_COMMAND_CENSUS_OBSERVATION',
			'ARROW_COMMAND_CENSUS_VALIDATE_AND_SERIALIZE',
			'GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_BINDING',
			'GUARD_ENFORCEMENT_LEDGER_OBSERVATION',
			'GUARD_ENFORCEMENT_LEDGER_VALIDATE_AND_SERIALIZE',
			'COMMAND_HANDLER_STATIC_PROJECTION',
			'COMMAND_EVENT_CONTRACT_STATIC_OVERLAY',
			'GUARD_CLASSIFICATION_STATIC_OVERLAY',
			'COMMAND_DISPATCH_STATIC_TOPOLOGY',
			'DEPENDENCY_CRUISER_EXECUTION',
			'DEPENDENCY_CRUISER_NORMALIZATION',
			'DEPENDENCY_PROVIDER_COMPARISON'
		]);
		expect(PROJECT_CONTEXT_GRAPH_ONLY_COMPLETED_PHASES).toEqual([
			'SELECTED_SUBJECT_RESOLUTION',
			'STATIC_SEMANTIC_SNAPSHOT_BUILD',
			'PROJECT_CONTEXT_GRAPH'
		]);
		expect(PROJECT_CONTEXT_GRAPH_ONLY_EXPECTED_SKIPPED_PHASES).toEqual([
			'REPOSITORY_DISCOVERY_PREFLIGHT',
			'STATIC_SEMANTIC_SNAPSHOT_VALIDATE_AND_SERIALIZE',
			'CONDITIONAL_EXPORT_RESOLUTION',
			'MODULE_RESOLUTION_TRACE',
			'DECLARATION_CONTEXT_ANALYSIS',
			'MODULE_DEPENDENCY_GRAPH',
			'STRUCTURAL_MODULE_REACHABILITY_ANALYSIS',
			'STRUCTURAL_SCC_ANALYSIS',
			'CALL_GRAPH',
			'LOGICAL_GRAPH_COMPOSITION',
			'READ_WRITE_ACCESS_GRAPH',
			'STATE_MACHINE_TOPOLOGY_OBSERVATION',
			'STATE_MACHINE_GRAPH_PROJECTION',
			'ARROW_COMMAND_CENSUS_SUBJECT_SELECTION',
			'ARROW_COMMAND_CENSUS_ARTIFACT_SET_BINDING',
			'ARROW_COMMAND_CENSUS_OBSERVATION',
			'ARROW_COMMAND_CENSUS_VALIDATE_AND_SERIALIZE',
			'GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_BINDING',
			'GUARD_ENFORCEMENT_LEDGER_OBSERVATION',
			'GUARD_ENFORCEMENT_LEDGER_VALIDATE_AND_SERIALIZE',
			'COMMAND_HANDLER_STATIC_PROJECTION',
			'COMMAND_EVENT_CONTRACT_STATIC_OVERLAY',
			'GUARD_CLASSIFICATION_STATIC_OVERLAY',
			'COMMAND_DISPATCH_STATIC_TOPOLOGY',
			'DEPENDENCY_CRUISER_EXECUTION',
			'DEPENDENCY_CRUISER_NORMALIZATION',
			'DEPENDENCY_PROVIDER_COMPARISON'
		]);
		expect(CONDITIONAL_EXPORT_RESOLUTION_ONLY_COMPLETED_PHASES).toEqual([
			'SELECTED_SUBJECT_RESOLUTION',
			'STATIC_SEMANTIC_SNAPSHOT_BUILD',
			'PROJECT_CONTEXT_GRAPH',
			'CONDITIONAL_EXPORT_RESOLUTION'
		]);
		expect(CONDITIONAL_EXPORT_RESOLUTION_ONLY_EXPECTED_SKIPPED_PHASES).toEqual([
			'REPOSITORY_DISCOVERY_PREFLIGHT',
			'STATIC_SEMANTIC_SNAPSHOT_VALIDATE_AND_SERIALIZE',
			'MODULE_RESOLUTION_TRACE',
			'DECLARATION_CONTEXT_ANALYSIS',
			'MODULE_DEPENDENCY_GRAPH',
			'STRUCTURAL_MODULE_REACHABILITY_ANALYSIS',
			'STRUCTURAL_SCC_ANALYSIS',
			'CALL_GRAPH',
			'LOGICAL_GRAPH_COMPOSITION',
			'READ_WRITE_ACCESS_GRAPH',
			'STATE_MACHINE_TOPOLOGY_OBSERVATION',
			'STATE_MACHINE_GRAPH_PROJECTION',
			'ARROW_COMMAND_CENSUS_SUBJECT_SELECTION',
			'ARROW_COMMAND_CENSUS_ARTIFACT_SET_BINDING',
			'ARROW_COMMAND_CENSUS_OBSERVATION',
			'ARROW_COMMAND_CENSUS_VALIDATE_AND_SERIALIZE',
			'GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_BINDING',
			'GUARD_ENFORCEMENT_LEDGER_OBSERVATION',
			'GUARD_ENFORCEMENT_LEDGER_VALIDATE_AND_SERIALIZE',
			'COMMAND_HANDLER_STATIC_PROJECTION',
			'COMMAND_EVENT_CONTRACT_STATIC_OVERLAY',
			'GUARD_CLASSIFICATION_STATIC_OVERLAY',
			'COMMAND_DISPATCH_STATIC_TOPOLOGY',
			'DEPENDENCY_CRUISER_EXECUTION',
			'DEPENDENCY_CRUISER_NORMALIZATION',
			'DEPENDENCY_PROVIDER_COMPARISON'
		]);
		expect(MODULE_RESOLUTION_TRACE_ONLY_COMPLETED_PHASES).toEqual([
			'SELECTED_SUBJECT_RESOLUTION',
			'STATIC_SEMANTIC_SNAPSHOT_BUILD',
			'PROJECT_CONTEXT_GRAPH',
			'CONDITIONAL_EXPORT_RESOLUTION',
			'MODULE_RESOLUTION_TRACE'
		]);
		expect(MODULE_RESOLUTION_TRACE_ONLY_EXPECTED_SKIPPED_PHASES).toEqual([
			'REPOSITORY_DISCOVERY_PREFLIGHT',
			'STATIC_SEMANTIC_SNAPSHOT_VALIDATE_AND_SERIALIZE',
			'DECLARATION_CONTEXT_ANALYSIS',
			'MODULE_DEPENDENCY_GRAPH',
			'STRUCTURAL_MODULE_REACHABILITY_ANALYSIS',
			'STRUCTURAL_SCC_ANALYSIS',
			'CALL_GRAPH',
			'LOGICAL_GRAPH_COMPOSITION',
			'READ_WRITE_ACCESS_GRAPH',
			'STATE_MACHINE_TOPOLOGY_OBSERVATION',
			'STATE_MACHINE_GRAPH_PROJECTION',
			'ARROW_COMMAND_CENSUS_SUBJECT_SELECTION',
			'ARROW_COMMAND_CENSUS_ARTIFACT_SET_BINDING',
			'ARROW_COMMAND_CENSUS_OBSERVATION',
			'ARROW_COMMAND_CENSUS_VALIDATE_AND_SERIALIZE',
			'GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_BINDING',
			'GUARD_ENFORCEMENT_LEDGER_OBSERVATION',
			'GUARD_ENFORCEMENT_LEDGER_VALIDATE_AND_SERIALIZE',
			'COMMAND_HANDLER_STATIC_PROJECTION',
			'COMMAND_EVENT_CONTRACT_STATIC_OVERLAY',
			'GUARD_CLASSIFICATION_STATIC_OVERLAY',
			'COMMAND_DISPATCH_STATIC_TOPOLOGY',
			'DEPENDENCY_CRUISER_EXECUTION',
			'DEPENDENCY_CRUISER_NORMALIZATION',
			'DEPENDENCY_PROVIDER_COMPARISON'
		]);
		expect(DECLARATION_CONTEXT_ANALYSIS_ONLY_COMPLETED_PHASES).toEqual([
			'SELECTED_SUBJECT_RESOLUTION',
			'STATIC_SEMANTIC_SNAPSHOT_BUILD',
			'PROJECT_CONTEXT_GRAPH',
			'CONDITIONAL_EXPORT_RESOLUTION',
			'MODULE_RESOLUTION_TRACE',
			'DECLARATION_CONTEXT_ANALYSIS'
		]);
		expect(DECLARATION_CONTEXT_ANALYSIS_ONLY_EXPECTED_SKIPPED_PHASES).toEqual([
			'REPOSITORY_DISCOVERY_PREFLIGHT',
			'STATIC_SEMANTIC_SNAPSHOT_VALIDATE_AND_SERIALIZE',
			'MODULE_DEPENDENCY_GRAPH',
			'STRUCTURAL_MODULE_REACHABILITY_ANALYSIS',
			'STRUCTURAL_SCC_ANALYSIS',
			'CALL_GRAPH',
			'LOGICAL_GRAPH_COMPOSITION',
			'READ_WRITE_ACCESS_GRAPH',
			'STATE_MACHINE_TOPOLOGY_OBSERVATION',
			'STATE_MACHINE_GRAPH_PROJECTION',
			'ARROW_COMMAND_CENSUS_SUBJECT_SELECTION',
			'ARROW_COMMAND_CENSUS_ARTIFACT_SET_BINDING',
			'ARROW_COMMAND_CENSUS_OBSERVATION',
			'ARROW_COMMAND_CENSUS_VALIDATE_AND_SERIALIZE',
			'GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_BINDING',
			'GUARD_ENFORCEMENT_LEDGER_OBSERVATION',
			'GUARD_ENFORCEMENT_LEDGER_VALIDATE_AND_SERIALIZE',
			'COMMAND_HANDLER_STATIC_PROJECTION',
			'COMMAND_EVENT_CONTRACT_STATIC_OVERLAY',
			'GUARD_CLASSIFICATION_STATIC_OVERLAY',
			'COMMAND_DISPATCH_STATIC_TOPOLOGY',
			'DEPENDENCY_CRUISER_EXECUTION',
			'DEPENDENCY_CRUISER_NORMALIZATION',
			'DEPENDENCY_PROVIDER_COMPARISON'
		]);
		expect(semanticCapabilitiesForProfile('STRUCTURAL')).toEqual([
			'TS_PROJECT',
			'TS_SYMBOL',
			'TS_SYNTAX'
		]);
		expect(semanticCapabilitiesForProfile('FULL')).toEqual([
			'TS_PROJECT',
			'TS_SYMBOL',
			'TS_SYNTAX',
			'TS_TYPE'
		]);
		expect(COMMAND_HANDLER_COMPILER_CLOSURE_PROJECTS).toEqual([
			'packages/rph-application/tsconfig.json',
			'packages/rph-assurance/tsconfig.json',
			'packages/rph-contracts/tsconfig.json',
			'packages/rph-domain/tsconfig.json',
			'packages/rph-persistence/tsconfig.json',
			'packages/rph-ports/tsconfig.json',
			'packages/rph-projections/tsconfig.json'
		]);
		expect(COMMAND_ANALYSIS_AUXILIARY_ARTIFACTS).toEqual([
			...ARROW_COMMAND_CENSUS_RETAINED_VERIFIER_PATHS,
			...GUARD_ENFORCEMENT_LEDGER_RETAINED_VERIFIER_PATHS,
			COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_PATH,
			COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH,
			COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH
		]);
	});

	it('emits ordered structured run and phase progress with independent phase durations', () => {
		const lines: string[] = [];
		const times = [1_000, 1_010, 1_040, 1_050, 1_060];
		const telemetry = createRepositorySmokeTelemetry(
			{ selector: 'fixture' },
			{
				now: () => times.shift()!,
				write: (line) => lines.push(line)
			}
		);
		telemetry.start('CALL_GRAPH', { callSites: 7 });
		telemetry.complete({ edges: 9 });
		telemetry.skip('STATE_MACHINE_GRAPH_PROJECTION', {
			reason: 'artifact absent',
			reasonCode: 'STATE_MACHINE_ARTIFACT_ABSENT'
		});
		telemetry.finish({ outcome: 'partial' });
		const events = lines.map((line) => JSON.parse(line) as Record<string, any>);
		expect(events.map((event) => [event.event, event.state, event.phase ?? null])).toEqual([
			['CSAA_REPOSITORY_SMOKE_RUN', 'STARTED', null],
			['CSAA_REPOSITORY_SMOKE_PHASE', 'STARTED', 'CALL_GRAPH'],
			['CSAA_REPOSITORY_SMOKE_PHASE', 'COMPLETED', 'CALL_GRAPH'],
			['CSAA_REPOSITORY_SMOKE_PHASE', 'SKIPPED', 'STATE_MACHINE_GRAPH_PROJECTION'],
			['CSAA_REPOSITORY_SMOKE_RUN', 'COMPLETED', null]
		]);
		expect(events[2]).toMatchObject({ durationMs: 30, runElapsedMs: 40 });
		expect(events[3]).toMatchObject({
			details: { reasonCode: 'STATE_MACHINE_ARTIFACT_ABSENT' },
			durationMs: 0
		});
		expect(events[4]!.phaseDurationsMs).toEqual({ CALL_GRAPH: 30 });
		expect(telemetry.phaseDurationsMs()).toEqual({ CALL_GRAPH: 30 });
		expect(telemetry.skippedPhases()).toEqual(['STATE_MACHINE_GRAPH_PROJECTION']);
		expect(
			events.every((event) => event.schemaVersion === REPOSITORY_SMOKE_TELEMETRY_SCHEMA_VERSION)
		).toBe(true);
	});

	it('rejects skip operations that would obscure an active or ended run state', () => {
		const telemetry = createRepositorySmokeTelemetry({}, { write: () => undefined });
		telemetry.start('CALL_GRAPH');
		expect(() => telemetry.skip('MODULE_DEPENDENCY_GRAPH', {})).toThrow(
			'Repository smoke phase CALL_GRAPH is still active.'
		);
		telemetry.complete();
		telemetry.finish();
		expect(() => telemetry.skip('MODULE_DEPENDENCY_GRAPH', {})).toThrow(
			'Repository smoke telemetry has already ended.'
		);
	});

	it('records the active failure phase and reuses the same error in the run terminal event', () => {
		const lines: string[] = [];
		const times = [2_000, 2_010, 2_025];
		const telemetry = createRepositorySmokeTelemetry(
			{ selector: 'fixture' },
			{
				now: () => times.shift()!,
				write: (line) => lines.push(line)
			}
		);
		telemetry.start('DEPENDENCY_CRUISER_EXECUTION', { inputPaths: ['packages/domain'] });
		telemetry.fail(new Error('provider refused'));
		const events = lines.map((line) => JSON.parse(line) as Record<string, any>);
		expect(events.at(-2)).toMatchObject({
			durationMs: 15,
			error: { message: 'provider refused', name: 'Error' },
			phase: 'DEPENDENCY_CRUISER_EXECUTION',
			state: 'FAILED'
		});
		expect(events.at(-1)).toMatchObject({
			error: { message: 'provider refused', name: 'Error' },
			failedPhase: 'DEPENDENCY_CRUISER_EXECUTION',
			state: 'FAILED'
		});
	});
});

describe('current JPWB repository semantic and graph smoke', () => {
	it.runIf(RUN_REPOSITORY_SMOKE)(
		'freezes, replays, validates, and projects the selected TypeScript project closure',
		async () => {
			const telemetry = createRepositorySmokeTelemetry({
				budgetClassification: 'PROVISIONAL_CALLER_OPERATION_BUDGETS_NOT_PRODUCT_CEILINGS',
				provisionalCallerOperationBudgets: {
					declarationContextAnalysisMaxDurationMs: REPOSITORY_SMOKE_FAILSAFE_SEMANTIC_DURATION_MS,
					dependencyProviderMaxDurationMs: REPOSITORY_SMOKE_FAILSAFE_PROVIDER_DURATION_MS,
					semanticMaxDurationMs: REPOSITORY_SMOKE_FAILSAFE_SEMANTIC_DURATION_MS,
					semanticMaxSnapshotBytes: REPOSITORY_SMOKE_FAILSAFE_SNAPSHOT_BYTES,
					subjectResolution: {
						maxBytes: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES,
						maxConfigDepth: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_CONFIG_DEPTH,
						maxDurationMs: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_DURATION_MS,
						maxFiles: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_FILES,
						maxProjects: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_PROJECTS
					},
					testDurationMs: REPOSITORY_SMOKE_FAILSAFE_TEST_TIMEOUT_MS
				},
				projectionPlan: SMOKE_PROJECTION_PLAN,
				selectedProjects: SELECTED_PROJECTS ?? ['<repository>'],
				semanticCapabilities: SEMANTIC_CAPABILITIES,
				semanticProfile: SMOKE_PROFILE,
				smokeSuite: SMOKE_SUITE,
				selector: SMOKE_SELECTOR ?? null
			});
			try {
				let repositorySubjectOutcome: ReturnType<typeof resolveSmokeSubject> | null = null;
				if (SELECTED_PROJECTS !== null && SMOKE_PROJECTION_PLAN.runRepositoryDiscoveryPreflight) {
					telemetry.start('REPOSITORY_DISCOVERY_PREFLIGHT', {
						requiredProjects: SELECTED_PROJECTS
					});
					repositorySubjectOutcome = resolveSmokeSubject({ kind: 'REPOSITORY' });
					expect(repositorySubjectOutcome.outcome, JSON.stringify(repositorySubjectOutcome)).toBe(
						'resolved'
					);
					if (repositorySubjectOutcome.outcome !== 'resolved')
						throw new Error(JSON.stringify(repositorySubjectOutcome));
					const discoveredProjectPaths = repositorySubjectOutcome.subject.projects.map(
						(project) => project.configPath
					);
					expect(discoveredProjectPaths).toEqual(expect.arrayContaining([...SELECTED_PROJECTS]));
					telemetry.complete({ discoveredProjects: discoveredProjectPaths.length });
				} else
					telemetry.skip('REPOSITORY_DISCOVERY_PREFLIGHT', {
						reason:
							SELECTED_PROJECTS === null
								? 'Repository scope is already the selected subject.'
								: 'The selected smoke suite resolves its exact explicit-project subject directly.',
						reasonCode:
							SELECTED_PROJECTS === null
								? 'REPOSITORY_SCOPE_ALREADY_SELECTED'
								: 'SUITE_PHASE_NOT_REQUESTED'
					});
				telemetry.start('SELECTED_SUBJECT_RESOLUTION', {
					scope: SELECTED_PROJECTS === null ? 'REPOSITORY' : 'EXPLICIT_PROJECTS'
				});
				const subjectOutcome = resolveSmokeSubject(
					SELECTED_PROJECTS === null
						? { kind: 'REPOSITORY' }
						: {
								...(USE_COMMON_COMMAND_HANDLER_SUBJECT &&
								SMOKE_SUITE !== 'STRUCTURAL_SCC_ONLY' &&
								SMOKE_SUITE !== 'STRUCTURAL_MODULE_REACHABILITY_ONLY' &&
								SMOKE_SUITE !== 'PROJECT_CONTEXT_GRAPH_ONLY' &&
								SMOKE_SUITE !== 'CONDITIONAL_EXPORT_RESOLUTION_ONLY' &&
								SMOKE_SUITE !== 'MODULE_RESOLUTION_TRACE_ONLY' &&
								SMOKE_SUITE !== 'DECLARATION_CONTEXT_ANALYSIS_ONLY'
									? { additionalArtifacts: COMMAND_ANALYSIS_AUXILIARY_ARTIFACTS }
									: {}),
								kind: 'EXPLICIT_PROJECTS',
								projects: SELECTED_PROJECTS
							}
				);
				expect(subjectOutcome.outcome, JSON.stringify(subjectOutcome)).toBe('resolved');
				if (subjectOutcome.outcome !== 'resolved') throw new Error(JSON.stringify(subjectOutcome));
				const subject = subjectOutcome.subject;
				const projectPaths = subject.projects.map((project) => project.configPath);
				expect(projectPaths).toEqual(
					expect.arrayContaining([...(SELECTED_PROJECTS ?? REPRESENTATIVE_PROJECTS)])
				);
				const subjectArtifactBytes = subject.artifacts.reduce(
					(total, artifact) => total + artifact.bytes,
					0
				);
				telemetry.complete({
					artifactBytes: subjectArtifactBytes,
					artifacts: subject.artifacts.length,
					projects: subject.projects.length,
					subjectId: subject.descriptor.subjectId
				});

				const semanticPipelineStartedAt = performance.now();
				const semanticProgressEvents: StaticSemanticSnapshotProgressEvent[] = [];
				const semanticPhaseDurationsMs: Record<string, number> = {};
				const semanticMemoryHighWaterBytes = {
					external: 0,
					heapTotal: 0,
					heapUsed: 0,
					rss: 0
				};
				telemetry.start('STATIC_SEMANTIC_SNAPSHOT_BUILD', {
					capabilities: SEMANTIC_CAPABILITIES,
					provisionalCallerOperationBudgets: {
						maxDurationMs: REPOSITORY_SMOKE_FAILSAFE_SEMANTIC_DURATION_MS,
						maxSnapshotBytes: REPOSITORY_SMOKE_FAILSAFE_SNAPSHOT_BYTES
					}
				});
				const outcome = buildStaticSemanticSnapshot(
					{
						assignabilityRequests: [],
						budgets: {
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
							maxDurationMs: REPOSITORY_SMOKE_FAILSAFE_SEMANTIC_DURATION_MS,
							maxLiteralCharacters: 10_000,
							maxPathCharacters: 4_096,
							maxProjects: 200,
							maxSnapshotBytes: REPOSITORY_SMOKE_FAILSAFE_SNAPSHOT_BYTES,
							maxScopes: 1_000_000,
							maxSources: 100_000
						},
						capabilities: SEMANTIC_CAPABILITIES,
						expectEmpty: false,
						operationVersion: SEMANTIC_OPERATION_VERSION,
						rootLocator: REPOSITORY_ROOT,
						schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
						subjectId: subject.descriptor.subjectId
					},
					{ subject },
					{
						onProgress(event) {
							semanticProgressEvents.push(event);
							if (event.state !== 'STARTED')
								semanticPhaseDurationsMs[event.phase] =
									(semanticPhaseDurationsMs[event.phase] ?? 0) + event.durationMs;
							semanticMemoryHighWaterBytes.external = Math.max(
								semanticMemoryHighWaterBytes.external,
								event.memoryUsage.external
							);
							semanticMemoryHighWaterBytes.heapTotal = Math.max(
								semanticMemoryHighWaterBytes.heapTotal,
								event.memoryUsage.heapTotal
							);
							semanticMemoryHighWaterBytes.heapUsed = Math.max(
								semanticMemoryHighWaterBytes.heapUsed,
								event.memoryUsage.heapUsed
							);
							semanticMemoryHighWaterBytes.rss = Math.max(
								semanticMemoryHighWaterBytes.rss,
								event.memoryUsage.rss
							);
							process.stdout.write(`${JSON.stringify(event)}\n`);
						}
					}
				);
				const outcomeSummary = JSON.stringify({
					diagnostics: outcome.diagnostics,
					outcome: outcome.outcome
				});
				expect(['complete', 'partial'], outcomeSummary).toContain(outcome.outcome);
				if (outcome.outcome !== 'complete' && outcome.outcome !== 'partial')
					throw new Error(outcomeSummary);
				const snapshot = outcome.snapshot;
				telemetry.complete({
					adapterPhaseDurationsMs: semanticPhaseDurationsMs,
					astNodes: snapshot.astNodes.length,
					diagnostics: outcome.diagnostics.length,
					memoryHighWaterBytes: semanticMemoryHighWaterBytes,
					outcome: outcome.outcome,
					programs: snapshot.programs.length,
					progressEvents: semanticProgressEvents.length,
					sources: snapshot.sources.length
				});
				expect(snapshot.projects).toHaveLength(subject.projects.length);
				expect(snapshot.programs).toHaveLength(subject.projects.length);
				expect(snapshot.sources.length).toBeGreaterThan(0);
				expect(snapshot.astNodes.length).toBeGreaterThan(snapshot.sources.length);
				expect(snapshot.declarationCandidates.length).toBeGreaterThan(0);
				expect(snapshot.declarations.length).toBeGreaterThan(0);
				expect(snapshot.symbols.length).toBeGreaterThan(0);
				expect(snapshot.aliases.length).toBeGreaterThan(0);
				expect(snapshot.references.length).toBeGreaterThan(0);
				expect(snapshot.moduleResolutions.length).toBeGreaterThan(0);
				expect(snapshot.moduleExports.length).toBeGreaterThan(0);
				const completedInternalSemanticPhases = new Set(
					semanticProgressEvents
						.filter((event) => event.state === 'COMPLETED')
						.map((event) => event.phase)
				);
				for (const requiredPhase of ['SERIALIZE', 'VALIDATE', 'FINALIZE'] as const)
					expect(completedInternalSemanticPhases.has(requiredPhase)).toBe(true);
				const internalSerializeEvent = semanticProgressEvents.find(
					(event) => event.phase === 'SERIALIZE' && event.state === 'COMPLETED'
				);
				if (internalSerializeEvent === undefined)
					throw new Error('The semantic builder did not report a completed SERIALIZE phase.');
				let semanticSnapshotWitness: {
					readonly bytes: number;
					readonly sha256: string | null;
					readonly validationMode: 'BUILDER_INTERNAL' | 'INDEPENDENT_REVALIDATION';
				} = {
					bytes: internalSerializeEvent.counts.canonicalBytes,
					sha256: null,
					validationMode: 'BUILDER_INTERNAL'
				};
				expect(semanticSnapshotWitness.bytes).toBeGreaterThan(0);
				expect(semanticSnapshotWitness.bytes).toBeLessThanOrEqual(
					snapshot.budgets.maxSnapshotBytes
				);
				if (SMOKE_PROJECTION_PLAN.runIndependentSemanticRevalidation) {
					telemetry.start('STATIC_SEMANTIC_SNAPSHOT_VALIDATE_AND_SERIALIZE', {
						semanticSnapshotId: snapshot.id
					});
					expect(
						validateStaticSemanticSnapshot(
							snapshot,
							{
								maxDepth: 4_096,
								maxDiagnostics: snapshot.budgets.maxDiagnostics,
								maxIssues: 100_000,
								maxRecords: snapshot.budgets.maxSnapshotBytes,
								maxReferenceChecks: snapshot.budgets.maxSnapshotBytes,
								maxStringCharacters: snapshot.budgets.maxSnapshotBytes
							},
							{ frozenSubject: subject }
						)
					).toEqual({ issues: [], state: 'VALID' });
					const canonicalWitness = canonicalSemanticJsonWitness(snapshot);
					expect(canonicalWitness.bytes).toBeLessThanOrEqual(snapshot.budgets.maxSnapshotBytes);
					expect(canonicalWitness.sha256).toMatch(/^[a-f0-9]{64}$/u);
					expect(canonicalWitness.bytes).toBe(semanticSnapshotWitness.bytes);
					semanticSnapshotWitness = {
						...canonicalWitness,
						validationMode: 'INDEPENDENT_REVALIDATION'
					};
					telemetry.complete({
						bytes: canonicalWitness.bytes,
						sha256: canonicalWitness.sha256,
						validationState: 'VALID'
					});
				} else
					telemetry.skip('STATIC_SEMANTIC_SNAPSHOT_VALIDATE_AND_SERIALIZE', {
						builderCompletedPhases: ['SERIALIZE', 'VALIDATE', 'FINALIZE'],
						canonicalBytes: semanticSnapshotWitness.bytes,
						reason:
							'The semantic builder already serialized, validated, and finalized the accepted snapshot against the frozen subject.',
						reasonCode: 'VALIDATED_IN_BUILD_PIPELINE'
					});
				const semanticPipelineDurationMs = Math.max(
					0,
					Math.round(performance.now() - semanticPipelineStartedAt)
				);
				let projectContextGraph: ProjectContextGraphSnapshot | null = null;
				let projectContextGraphResult: null | {
					readonly bytes: number;
					readonly chargedInputTraversalSteps: number;
					readonly closure: string;
					readonly configurationClosureRecords: number;
					readonly contentDigest: string;
					readonly durationMs: number;
					readonly graphId: string;
					readonly inputDigest: string;
					readonly memberships: number;
					readonly programs: number;
					readonly projectReferences: number;
					readonly projects: number;
					readonly sha256: string;
					readonly sources: number;
				} = null;
				let conditionalExportResolutionResult: null | {
					readonly authorityTransfer: string;
					readonly branches: number;
					readonly bytes: number;
					readonly capability: string;
					readonly capabilityStatus: string;
					readonly chargedTraversalSteps: number;
					readonly closure: string;
					readonly conditionChecks: number;
					readonly contentDigest: string;
					readonly currentness: string;
					readonly decisionState: string;
					readonly durationMs: number;
					readonly exactExportKeyComparisons: number;
					readonly freshness: string;
					readonly frontiers: number;
					readonly fullJanCsaa012Conformance: string;
					readonly gateEffect: string;
					readonly inputDigest: string;
					readonly manifestBytes: number;
					readonly nonclaims: readonly string[];
					readonly resolutionAuthority: string;
					readonly resolutionId: string;
					readonly resolution: ConditionalExportResolutionSnapshot;
					readonly resultCompleteness: string;
					readonly selectedTarget: string | null;
					readonly sha256: string;
				} = null;
				let conditionalExportInputs: ConditionalExportResolutionInputs | null = null;
				let moduleResolutionTraceResult: null | {
					readonly attempts: number;
					readonly authorityTransfer: string;
					readonly bytes: number;
					readonly candidates: number;
					readonly capability: string;
					readonly capabilityStatus: string;
					readonly chargedTraversalSteps: number;
					readonly closure: string;
					readonly contentDigest: string;
					readonly currentness: string;
					readonly durationMs: number;
					readonly freshness: string;
					readonly fullJanCsaa007Conformance: string;
					readonly fullJanCsaa008Conformance: string;
					readonly fullJanCsaa011Conformance: string;
					readonly gateEffect: string;
					readonly health: string;
					readonly inputDigest: string;
					readonly nonclaims: readonly string[];
					readonly readBytes: number;
					readonly resolutionAuthority: string;
					readonly resultCompleteness: string;
					readonly sha256: string;
					readonly targetLogicalPath: string;
					readonly trace: ModuleResolutionTraceSnapshot;
					readonly traceId: string;
				} = null;
				let moduleResolutionTraceInputs: ModuleResolutionTraceBuildInputs | null = null;
				let declarationContextAnalysisResult: null | {
					readonly aliasHops: number;
					readonly analysis: DeclarationContextAnalysisSnapshot;
					readonly analysisAuthority: string;
					readonly analysisId: string;
					readonly artifacts: number;
					readonly authorityTransfer: string;
					readonly bytes: number;
					readonly capability: string;
					readonly capabilityStatus: string;
					readonly chargedTraversalSteps: number;
					readonly closure: string;
					readonly contentDigest: string;
					readonly currentness: string;
					readonly declarations: number;
					readonly durationMs: number;
					readonly freshness: string;
					readonly fullJanCsaa007Conformance: string;
					readonly fullJanCsaa008Conformance: string;
					readonly fullJanCsaa013Conformance: string;
					readonly gateEffect: string;
					readonly health: string;
					readonly inputDigest: string;
					readonly mergeState: string;
					readonly nonclaims: readonly string[];
					readonly readBytes: number;
					readonly resultCompleteness: string;
					readonly sha256: string;
					readonly terminalArtifactLogicalPath: string;
					readonly terminalDeclarationKind: string;
					readonly terminalSymbolName: string;
				} = null;
				if (SMOKE_PROJECTION_PLAN.runProjectContextGraph) {
					const projectContextStartedAt = performance.now();
					const configurationClosureRecords = subject.projects.reduce(
						(total, project) => total + project.configClosure.length,
						0
					);
					const declaredProjectReferences = snapshot.projects.reduce(
						(total, project) => total + project.projectReferences.length,
						0
					);
					const memberships = snapshot.programs.length + snapshot.sources.length;
					const chargedInputTraversalSteps =
						snapshot.projects.length +
						snapshot.programs.length +
						snapshot.sources.length +
						declaredProjectReferences +
						configurationClosureRecords;
					const projectContextBudgets = {
						maxConfigurationClosureRecords: configurationClosureRecords,
						maxDiagnostics: 100_000,
						maxInputRecords: 50_000_000,
						maxInputStringCharacters: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES,
						maxMemberships: memberships,
						maxOutputRecords:
							1 +
							snapshot.projects.length +
							snapshot.programs.length +
							snapshot.sources.length +
							memberships +
							declaredProjectReferences,
						maxPrograms: snapshot.programs.length,
						maxProjectReferences: declaredProjectReferences,
						maxProjects: snapshot.projects.length,
						maxSources: snapshot.sources.length,
						maxTraversalSteps: chargedInputTraversalSteps
					};
					const projectContextInputs = {
						frozenSubject: subject,
						request: {
							budgets: projectContextBudgets,
							operationVersion: PROJECT_CONTEXT_GRAPH_OPERATION_VERSION,
							schemaVersion: PROJECT_CONTEXT_GRAPH_REQUEST_SCHEMA_VERSION,
							selection: PROJECT_CONTEXT_GRAPH_SELECTION,
							semanticSnapshotId: snapshot.id,
							subjectId: snapshot.subjectId
						},
						semanticSnapshot: snapshot
					};
					telemetry.start('PROJECT_CONTEXT_GRAPH', {
						budgetClassification: 'PROVISIONAL_CALLER_OPERATION_BUDGETS_NOT_PRODUCT_CEILINGS',
						budgets: projectContextBudgets,
						semanticSnapshotId: snapshot.id,
						subjectId: snapshot.subjectId
					});
					const projectContextOutcome = buildProjectContextGraph(projectContextInputs, {
						onProgress(event) {
							process.stdout.write(`${JSON.stringify(event)}\n`);
						}
					});
					expect(
						projectContextOutcome.outcome,
						JSON.stringify(projectContextOutcome.diagnostics)
					).toBe('partial');
					if (projectContextOutcome.outcome !== 'partial')
						throw new Error(JSON.stringify(projectContextOutcome));
					projectContextGraph = projectContextOutcome.graph;
					if (
						SMOKE_SUITE !== 'CONDITIONAL_EXPORT_RESOLUTION_ONLY' &&
						SMOKE_SUITE !== 'MODULE_RESOLUTION_TRACE_ONLY' &&
						SMOKE_SUITE !== 'DECLARATION_CONTEXT_ANALYSIS_ONLY'
					)
						expect(
							validateProjectContextGraph(projectContextGraph, projectContextInputs, {
								maxDepth: 4_096,
								maxInputRecords: projectContextBudgets.maxInputRecords,
								maxInputStringCharacters: projectContextBudgets.maxInputStringCharacters,
								maxIssues: projectContextBudgets.maxDiagnostics,
								maxRecords: projectContextBudgets.maxInputRecords,
								maxStringCharacters: projectContextBudgets.maxInputStringCharacters
							})
						).toEqual({ issues: [], state: 'VALID' });
					expect(projectContextGraph.projects).toHaveLength(snapshot.projects.length);
					expect(projectContextGraph.programs).toHaveLength(snapshot.programs.length);
					expect(projectContextGraph.sources).toHaveLength(snapshot.sources.length);
					expect(projectContextGraph.memberships).toHaveLength(memberships);
					expect(projectContextGraph.projectReferences).toHaveLength(declaredProjectReferences);
					expect(projectContextGraph.outsideSelectedProjectReferences).toEqual([]);
					expect(projectContextGraph.unresolvedProjectReferences).toEqual([]);
					expect(projectContextGraph.coverage).toMatchObject({
						chargedInputTraversalSteps,
						configurationClosureRecords,
						declaredProjectReferences,
						memberships,
						outsideSelectedProjectReferences: 0,
						programPopulationReconciles: true,
						projectPopulationReconciles: true,
						referencePopulationReconciles: true,
						resolvedProjectReferences: declaredProjectReferences,
						sourcePopulationReconciles: true,
						unresolvedProjectReferences: 0
					});
					expect(projectContextGraph.closure).toBe('CLOSED_FOR_ALL_DECLARED_PROJECT_REFERENCES');
					expect(projectContextGraph.health).toBe('PARTIAL');
					expect(projectContextGraph.graphAuthority).toBe(PROJECT_CONTEXT_GRAPH_GRAPH_AUTHORITY);
					expect(projectContextGraph.authorityTransfer).toBe(
						PROJECT_CONTEXT_GRAPH_AUTHORITY_TRANSFER
					);
					expect(projectContextGraph.gateEffect).toBe(PROJECT_CONTEXT_GRAPH_GATE_EFFECT);
					expect(projectContextGraph.freshness).toBe(PROJECT_CONTEXT_GRAPH_FRESHNESS);
					expect(projectContextGraph.currentness).toBe(PROJECT_CONTEXT_GRAPH_CURRENTNESS);
					expect(projectContextGraph.fullJanCsaa010Conformance).toBe(
						PROJECT_CONTEXT_GRAPH_FULL_JAN_CSAA_010_CONFORMANCE
					);
					expect(projectContextGraph.nonclaims).toEqual(PROJECT_CONTEXT_GRAPH_NONCLAIMS);
					const projectContextWitness = canonicalSemanticJsonWitness(projectContextGraph);
					if (SMOKE_SUITE === 'PROJECT_CONTEXT_GRAPH_ONLY') {
						expect(projectContextGraph.budgets).toEqual({
							maxConfigurationClosureRecords: 28,
							maxDiagnostics: 100_000,
							maxInputRecords: 50_000_000,
							maxInputStringCharacters: 1_000_000_000,
							maxMemberships: 2_539,
							maxOutputRecords: 5_086,
							maxPrograms: 7,
							maxProjectReferences: 0,
							maxProjects: 7,
							maxSources: 2_532,
							maxTraversalSteps: 2_574
						});
						expect(projectContextGraph.coverage).toEqual({
							chargedInputTraversalSteps: 2_574,
							configurationClosureRecords: 28,
							declaredProjectReferences: 0,
							inputPrograms: 7,
							inputProjects: 7,
							inputSources: 2_532,
							memberships: 2_539,
							outsideSelectedProjectReferences: 0,
							programPopulationReconciles: true,
							programSourceMemberships: 2_532,
							projectPopulationReconciles: true,
							projectedPrograms: 7,
							projectedProjects: 7,
							projectedSources: 2_532,
							projectProgramMemberships: 7,
							referencePopulationReconciles: true,
							resolvedProjectReferences: 0,
							sourcePopulationReconciles: true,
							unresolvedProjectReferences: 0
						});
						expect(projectContextWitness.bytes).toBe(3_588_305);
					}
					telemetry.complete({
						bytes: projectContextWitness.bytes,
						configurationClosureRecords,
						memberships,
						programs: projectContextGraph.programs.length,
						projectReferences: projectContextGraph.projectReferences.length,
						projects: projectContextGraph.projects.length,
						sources: projectContextGraph.sources.length,
						validationState: 'VALID'
					});
					projectContextGraphResult = {
						bytes: projectContextWitness.bytes,
						chargedInputTraversalSteps,
						closure: projectContextGraph.closure,
						configurationClosureRecords,
						contentDigest: projectContextGraph.contentDigest,
						durationMs: Math.max(0, Math.round(performance.now() - projectContextStartedAt)),
						graphId: projectContextGraph.id,
						inputDigest: projectContextGraph.inputDigest,
						memberships,
						programs: projectContextGraph.programs.length,
						projectReferences: projectContextGraph.projectReferences.length,
						projects: projectContextGraph.projects.length,
						sha256: projectContextWitness.sha256,
						sources: projectContextGraph.sources.length
					};
				} else
					telemetry.skip('PROJECT_CONTEXT_GRAPH', {
						reason: 'The selected smoke suite does not request the project-context projection.',
						reasonCode: 'SUITE_PHASE_NOT_REQUESTED'
					});
				if (SMOKE_PROJECTION_PLAN.runConditionalExportResolution) {
					if (projectContextGraph === null)
						throw new Error(
							'CONDITIONAL_EXPORT_RESOLUTION_ONLY requires validated project-context evidence.'
						);
					const conditionalExportStartedAt = performance.now();
					const consumerSources = projectContextGraph.sources.filter(
						(source) => source.logicalPath === CONDITIONAL_EXPORT_RESOLUTION_CONSUMER_LOGICAL_PATH
					);
					expect(consumerSources).toHaveLength(1);
					const consumerSource = consumerSources[0];
					if (consumerSource === undefined)
						throw new Error('The selected CAP-012 consumer source is absent.');
					const consumerPrograms = projectContextGraph.programs.filter(
						(program) => program.id === consumerSource.programId
					);
					expect(consumerPrograms).toHaveLength(1);
					const consumerProgram = consumerPrograms[0];
					if (consumerProgram === undefined)
						throw new Error('The selected CAP-012 consumer program is absent.');
					const selectedWorkspaces = subject.workspaces.filter(
						(workspace) => workspace.name === CONDITIONAL_EXPORT_RESOLUTION_PACKAGE_NAME
					);
					expect(selectedWorkspaces).toHaveLength(1);
					const selectedWorkspace = selectedWorkspaces[0];
					if (selectedWorkspace === undefined)
						throw new Error('The selected CAP-012 workspace package is absent.');
					expect(selectedWorkspace.manifestPath).toBe('packages/rph-contracts/package.json');
					const conditionalExportConditions = SMOKE_PROJECTION_PLAN.runModuleResolutionTrace
						? MODULE_RESOLUTION_TRACE_EXPLICIT_CONDITIONS
						: CONDITIONAL_EXPORT_RESOLUTION_EXPLICIT_CONDITIONS;
					const conditionalExportBudgets = {
						maxAstNodes: 111,
						maxBranches: 4,
						maxConditionChecks: 4,
						maxDiagnostics: 100_000,
						maxFrontiers: 0,
						maxInputRecords: 50_000_000,
						maxInputStringCharacters: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES,
						maxManifestBytes: 1_467,
						maxOutputRecords: 5,
						maxTraversalSteps: 117
					};
					conditionalExportInputs = {
						frozenSubject: subject,
						projectContextGraph,
						request: {
							budgets: conditionalExportBudgets,
							conditions: conditionalExportConditions,
							consumer: {
								projectContextProgramId: consumerProgram.id,
								projectContextSourceId: consumerSource.id,
								semanticProgramId: consumerProgram.semanticProgramId,
								semanticSourceId: consumerSource.semanticSourceId
							},
							exportSubpath: CONDITIONAL_EXPORT_RESOLUTION_EXPORT_SUBPATH,
							manifestPath: selectedWorkspace.manifestPath,
							moduleMode: 'IMPORT' as const,
							operationVersion: CONDITIONAL_EXPORT_RESOLUTION_OPERATION_VERSION,
							packageName: CONDITIONAL_EXPORT_RESOLUTION_PACKAGE_NAME,
							platform: 'NODE' as const,
							projectContextGraph: {
								contentDigest: projectContextGraph.contentDigest,
								graphId: projectContextGraph.id,
								inputDigest: projectContextGraph.inputDigest
							},
							schemaVersion: CONDITIONAL_EXPORT_RESOLUTION_REQUEST_SCHEMA_VERSION,
							selection: CONDITIONAL_EXPORT_RESOLUTION_SELECTION,
							semanticSnapshotId: snapshot.id,
							subjectId: subject.descriptor.subjectId
						},
						semanticSnapshot: snapshot
					};
					const conditionalExportProgressEvents: ConditionalExportResolutionProgressEvent[] = [];
					telemetry.start('CONDITIONAL_EXPORT_RESOLUTION', {
						budgetClassification: 'PROVISIONAL_CALLER_OPERATION_BUDGETS_NOT_PRODUCT_CEILINGS',
						consumerLogicalPath: consumerSource.logicalPath,
						exportSubpath: CONDITIONAL_EXPORT_RESOLUTION_EXPORT_SUBPATH,
						packageName: CONDITIONAL_EXPORT_RESOLUTION_PACKAGE_NAME
					});
					const conditionalExportOutcome = buildConditionalExportResolution(
						conditionalExportInputs,
						{
							onProgress(event) {
								conditionalExportProgressEvents.push(event);
								process.stdout.write(`${JSON.stringify(event)}\n`);
							}
						}
					);
					await Promise.resolve();
					expect(
						conditionalExportProgressEvents
							.filter((event) => event.state === 'COMPLETED')
							.map((event) => event.phase)
					).toEqual([
						'REQUEST_BIND',
						'INPUT_BUDGET',
						'PROJECT_CONTEXT_GRAPH_VALIDATE',
						'CONSUMER_BIND',
						'MANIFEST_PARSE',
						'EXPORT_KEY_MATCH',
						'CONDITION_EVALUATE',
						'MATERIALIZE',
						'SERIALIZE',
						'RESOLUTION_VALIDATE'
					]);
					expect(
						conditionalExportOutcome.outcome,
						JSON.stringify(conditionalExportOutcome.diagnostics)
					).toBe('partial');
					if (conditionalExportOutcome.outcome !== 'partial')
						throw new Error(JSON.stringify(conditionalExportOutcome));
					const resolution = conditionalExportOutcome.resolution;
					expect(
						validateConditionalExportResolution(resolution, conditionalExportInputs, {
							maxDepth: 4_096,
							maxInputRecords: conditionalExportBudgets.maxInputRecords,
							maxInputStringCharacters: conditionalExportBudgets.maxInputStringCharacters,
							maxIssues: conditionalExportBudgets.maxDiagnostics,
							maxRecords: conditionalExportBudgets.maxInputRecords,
							maxStringCharacters: conditionalExportBudgets.maxInputStringCharacters
						})
					).toEqual({ issues: [], state: 'VALID' });
					expect(resolution.budgets).toEqual(conditionalExportBudgets);
					expect(resolution.consumerEnvironment).toEqual({
						conditionSemantics: 'MEMBERSHIP_ONLY_PRIORITY_FROM_MANIFEST_DECLARATION_ORDER',
						conditions: conditionalExportConditions,
						defaultConditionEnabled: true,
						effectiveConditions: SMOKE_PROJECTION_PLAN.runModuleResolutionTrace
							? ['types', 'node', 'import']
							: ['source', 'types', 'node', 'import'],
						logicalPath: CONDITIONAL_EXPORT_RESOLUTION_CONSUMER_LOGICAL_PATH,
						moduleMode: 'IMPORT',
						platform: 'NODE',
						projectContextProgramId: consumerProgram.id,
						projectContextProjectId: consumerProgram.projectId,
						projectContextSourceId: consumerSource.id,
						semanticProgramId: consumerProgram.semanticProgramId,
						semanticProjectId: consumerProgram.semanticProjectId,
						semanticSourceId: consumerSource.semanticSourceId
					});
					expect(resolution.manifestWitness).toEqual({
						exportsPropertySpan: {
							coordinateSystem: 'UTF16_CODE_UNIT_ZERO_BASED_HALF_OPEN',
							length: 332,
							start: 300
						},
						exportsValueSha256: 'aadd683ab52d321a88747a71bcb388d8935cca99120f13ae92820c950168ba69',
						exportsValueSpan: {
							coordinateSystem: 'UTF16_CODE_UNIT_ZERO_BASED_HALF_OPEN',
							length: 321,
							start: 311
						},
						importsPropertySpan: null,
						manifestBytes: 1_467,
						manifestPath: 'packages/rph-contracts/package.json',
						manifestSha256: '2e751402faeb3e5cd6d72c1335241f283d552f4733e51287a4aa3ff7fdc11ea1',
						parseMethod: 'TYPESCRIPT_PARSE_JSON_TEXT',
						parserVersion: '5.9.3',
						rootSpan: {
							coordinateSystem: 'UTF16_CODE_UNIT_ZERO_BASED_HALF_OPEN',
							length: 1_466,
							start: 0
						},
						sourceEncoding: 'UTF-8',
						workspaceKind: 'PACKAGE',
						workspaceName: CONDITIONAL_EXPORT_RESOLUTION_PACKAGE_NAME,
						workspacePath: 'packages/rph-contracts'
					});
					expect(resolution.exactKeyOutcome).toEqual({
						declarationOrdinal: 7,
						exportSubpath: '.',
						keySpan: {
							coordinateSystem: 'UTF16_CODE_UNIT_ZERO_BASED_HALF_OPEN',
							length: 3,
							start: 317
						},
						matchKind: 'EXPLICIT_SUBPATH_KEY',
						state: 'MATCHED',
						valueSpan: {
							coordinateSystem: 'UTF16_CODE_UNIT_ZERO_BASED_HALF_OPEN',
							length: 147,
							start: 322
						}
					});
					const selectedConditionalExportBranchIndex =
						SMOKE_PROJECTION_PLAN.runModuleResolutionTrace ? 1 : 0;
					expect(
						resolution.branches.map(
							({
								condition,
								conditionMatch,
								conditionPath,
								declarationOrdinal,
								depth,
								evaluation,
								exclusionReason,
								ordinal,
								target,
								valueKind
							}) => ({
								condition,
								conditionMatch,
								conditionPath,
								declarationOrdinal,
								depth,
								evaluation,
								exclusionReason,
								ordinal,
								target,
								valueKind
							})
						)
					).toEqual(
						(['source', 'types', 'import', 'default'] as const).map((condition, index) => ({
							condition,
							conditionMatch:
								condition === 'default'
									? 'DEFAULT'
									: condition === 'import'
										? 'MODULE_MODE'
										: condition === 'source' && selectedConditionalExportBranchIndex !== 0
											? 'INACTIVE'
											: 'EXPLICIT',
							conditionPath: [condition],
							declarationOrdinal: 8 + index,
							depth: 0,
							evaluation: index === selectedConditionalExportBranchIndex ? 'SELECTED' : 'EXCLUDED',
							exclusionReason:
								index === selectedConditionalExportBranchIndex
									? null
									: index < selectedConditionalExportBranchIndex
										? 'CONDITION_INACTIVE'
										: 'PRIOR_BRANCH_TERMINATED_EVALUATION',
							ordinal: index,
							target:
								condition === 'source'
									? './src/index.ts'
									: condition === 'types'
										? './dist/index.d.ts'
										: './dist/index.js',
							valueKind: 'STRING'
						}))
					);
					expect(
						resolution.branches.map(({ keySpan, valueSpan }) => ({
							key: { length: keySpan.length, start: keySpan.start },
							value: { length: valueSpan.length, start: valueSpan.start }
						}))
					).toEqual([
						{ key: { length: 8, start: 330 }, value: { length: 16, start: 340 } },
						{ key: { length: 7, start: 364 }, value: { length: 19, start: 373 } },
						{ key: { length: 8, start: 400 }, value: { length: 17, start: 410 } },
						{ key: { length: 9, start: 435 }, value: { length: 17, start: 446 } }
					]);
					expect(resolution.decision).toMatchObject({
						basis: 'RAW_MANIFEST_DECLARATION_ORDER_FOR_EXACT_CONSUMER_ENVIRONMENT',
						ordinal: 0,
						selectedBranchId: resolution.branches[selectedConditionalExportBranchIndex]?.id,
						state: 'SELECTED_TARGET',
						target:
							selectedConditionalExportBranchIndex === 0 ? './src/index.ts' : './dist/index.d.ts'
					});
					expect(resolution.frontiers).toEqual([]);
					expect(resolution.coverage).toEqual({
						astNodes: 111,
						blockedByNullDecisions: 0,
						branchPopulationReconciles: true,
						branchRecords: 4,
						candidateBranches: 0,
						chargedTraversalSteps: 117,
						conditionChecks: 4,
						decisionPopulationReconciles: true,
						decisionRecords: 1,
						exactExportKeyComparisons: 2,
						exactExportKeyMatches: 1,
						exactExportKeyMisses: 0,
						excludedBranches: 3,
						frontierPopulationReconciles: true,
						frontierRecords: 0,
						manifestBytes: 1_467,
						noExactExportKeyDecisions: 0,
						noMatchingConditionDecisions: 0,
						outputRecords: 5,
						selectedBranches: 1,
						selectedConsumerPrograms: 1,
						selectedConsumerSources: 1,
						selectedManifests: 1,
						selectedTargetDecisions: 1,
						selectedWorkspacePackages: 1,
						unsupportedDecisions: 0
					});
					expect(resolution.canonicalProfile).toBe(CONDITIONAL_EXPORT_RESOLUTION_CANONICAL_PROFILE);
					expect(resolution.capability).toBe(CONDITIONAL_EXPORT_RESOLUTION_CAPABILITY);
					expect(resolution.capabilityStatus).toBe(CONDITIONAL_EXPORT_RESOLUTION_CAPABILITY_STATUS);
					expect(resolution.method).toBe(CONDITIONAL_EXPORT_RESOLUTION_METHOD);
					expect(resolution.operationVersion).toBe(CONDITIONAL_EXPORT_RESOLUTION_OPERATION_VERSION);
					expect(resolution.schemaVersion).toBe(CONDITIONAL_EXPORT_RESOLUTION_SCHEMA_VERSION);
					expect(resolution.selection).toEqual(CONDITIONAL_EXPORT_RESOLUTION_SELECTION);
					expect(resolution.subjectId).toBe(subject.descriptor.subjectId);
					expect(resolution.semanticSnapshotId).toBe(snapshot.id);
					expect(resolution.projectContextGraph).toEqual({
						contentDigest: projectContextGraph.contentDigest,
						graphId: projectContextGraph.id,
						inputDigest: projectContextGraph.inputDigest
					});
					expect(resolution.health).toBe('PARTIAL');
					expect(resolution.closure).toBe('CLOSED_FOR_SELECTED_EXACT_EXPORT_DECISION');
					expect(resolution.resultCompleteness).toBe(
						'COMPLETE_FOR_SELECTED_SUPPORTED_EXACT_EXPORT_CRITERION'
					);
					expect(resolution.resolutionAuthority).toBe(CONDITIONAL_EXPORT_RESOLUTION_AUTHORITY);
					expect(resolution.authorityTransfer).toBe(
						CONDITIONAL_EXPORT_RESOLUTION_AUTHORITY_TRANSFER
					);
					expect(resolution.gateEffect).toBe(CONDITIONAL_EXPORT_RESOLUTION_GATE_EFFECT);
					expect(resolution.freshness).toBe(CONDITIONAL_EXPORT_RESOLUTION_FRESHNESS);
					expect(resolution.currentness).toBe(CONDITIONAL_EXPORT_RESOLUTION_CURRENTNESS);
					expect(resolution.fullJanCsaa012Conformance).toBe(
						CONDITIONAL_EXPORT_RESOLUTION_FULL_JAN_CSAA_012_CONFORMANCE
					);
					expect(resolution.nonclaims).toEqual(CONDITIONAL_EXPORT_RESOLUTION_NONCLAIMS);
					expect(resolution.truncation).toEqual({ reason: null, state: 'NOT_TRUNCATED' });
					const conditionalExportWitness = canonicalSemanticJsonWitness(resolution);
					telemetry.complete({
						branches: resolution.branches.length,
						bytes: conditionalExportWitness.bytes,
						decisionState: resolution.decision.state,
						frontiers: resolution.frontiers.length,
						manifestBytes: resolution.manifestWitness.manifestBytes,
						validationState: 'VALID'
					});
					conditionalExportResolutionResult = {
						authorityTransfer: resolution.authorityTransfer,
						branches: resolution.branches.length,
						bytes: conditionalExportWitness.bytes,
						capability: resolution.capability,
						capabilityStatus: resolution.capabilityStatus,
						chargedTraversalSteps: resolution.coverage.chargedTraversalSteps,
						closure: resolution.closure,
						conditionChecks: resolution.coverage.conditionChecks,
						contentDigest: resolution.contentDigest,
						currentness: resolution.currentness,
						decisionState: resolution.decision.state,
						durationMs: Math.max(0, Math.round(performance.now() - conditionalExportStartedAt)),
						exactExportKeyComparisons: resolution.coverage.exactExportKeyComparisons,
						freshness: resolution.freshness,
						frontiers: resolution.frontiers.length,
						fullJanCsaa012Conformance: resolution.fullJanCsaa012Conformance,
						gateEffect: resolution.gateEffect,
						inputDigest: resolution.inputDigest,
						manifestBytes: resolution.manifestWitness.manifestBytes,
						nonclaims: resolution.nonclaims,
						resolution,
						resolutionAuthority: resolution.resolutionAuthority,
						resolutionId: resolution.id,
						resultCompleteness: resolution.resultCompleteness,
						selectedTarget: resolution.decision.target,
						sha256: conditionalExportWitness.sha256
					};
				} else if (!SMOKE_PROJECTION_PLAN.terminateAfterProjectContextGraph)
					telemetry.skip('CONDITIONAL_EXPORT_RESOLUTION', {
						reason: 'The selected smoke suite does not request conditional-export resolution.',
						reasonCode: 'SUITE_PHASE_NOT_REQUESTED'
					});
				if (SMOKE_PROJECTION_PLAN.terminateAfterConditionalExportResolution) {
					if (projectContextGraphResult === null || conditionalExportResolutionResult === null)
						throw new Error(
							'CONDITIONAL_EXPORT_RESOLUTION_ONLY cannot complete without validated CAP-010 and CAP-012 evidence.'
						);
					for (const phase of CONDITIONAL_EXPORT_RESOLUTION_ONLY_DOWNSTREAM_SKIPPED_PHASES)
						telemetry.skip(phase, {
							reason:
								'The conditional-export-only suite terminates after one exact validated frozen-package decision.',
							reasonCode: 'SUITE_PHASE_NOT_REQUESTED'
						});
					const phaseDurationsMs = telemetry.phaseDurationsMs();
					const skippedPhases = telemetry.skippedPhases();
					const completedPhases = Object.keys(phaseDurationsMs);
					expect(completedPhases).toEqual(CONDITIONAL_EXPORT_RESOLUTION_ONLY_COMPLETED_PHASES);
					expect(skippedPhases).toEqual(CONDITIONAL_EXPORT_RESOLUTION_ONLY_EXPECTED_SKIPPED_PHASES);
					telemetry.finish({
						completedPhases,
						conditionalExportResolved: true,
						logicalGraphComposed: false,
						moduleResolutionTraced: false,
						projectContextProjected: true,
						projects: snapshot.projects.length,
						semanticSnapshotOutcome: outcome.outcome,
						semanticProfile: SMOKE_PROFILE,
						skippedPhases,
						smokeSuite: SMOKE_SUITE,
						sources: snapshot.sources.length,
						terminalPhase: 'CONDITIONAL_EXPORT_RESOLUTION'
					});
					process.stdout.write(
						`${JSON.stringify({
							arrowCommandCensus: null,
							callGraph: null,
							completedPhases,
							commandEventContractStaticOverlay: null,
							commandDispatchStaticTopology: null,
							commandHandlerStaticProjection: null,
							conditionalExportResolution: conditionalExportResolutionResult,
							declarationContextAnalysis: declarationContextAnalysisResult,
							dependencyProviderComparison: null,
							event: 'CSAA_REPOSITORY_SMOKE_RESULT',
							exactSubjectReuse: null,
							guardClassificationStaticOverlay: null,
							guardEnforcementLedger: null,
							logicalGraphComposition: null,
							moduleDependencyGraph: null,
							moduleResolutionTrace: null,
							phaseDurationsMs,
							projectContextGraph: projectContextGraphResult,
							projectCount: snapshot.projects.length,
							readWriteAccessGraph: null,
							selectedSubjectArtifactBytes: subjectArtifactBytes,
							selectedSubjectArtifactCount: subject.artifacts.length,
							selectedSubjectId: subject.descriptor.subjectId,
							selector: SMOKE_SELECTOR ?? null,
							semanticPipelineDurationMs,
							semanticProfile: SMOKE_PROFILE,
							semanticSnapshotMemoryHighWaterBytes: semanticMemoryHighWaterBytes,
							semanticSnapshotOutcome: outcome.outcome,
							semanticSnapshotPhaseDurationsMs: semanticPhaseDurationsMs,
							semanticSnapshotProgressEvents: semanticProgressEvents.length,
							semanticSnapshotWitness,
							skippedPhases,
							smokeSuite: SMOKE_SUITE,
							sourceCount: snapshot.sources.length,
							stateMachine: null,
							structuralModuleReachabilityAnalysis: null,
							structuralSccAnalysis: null,
							terminalPhase: 'CONDITIONAL_EXPORT_RESOLUTION'
						})}\n`
					);
					return;
				}
				if (SMOKE_PROJECTION_PLAN.runModuleResolutionTrace) {
					if (
						projectContextGraph === null ||
						projectContextGraphResult === null ||
						conditionalExportInputs === null ||
						conditionalExportResolutionResult === null
					)
						throw new Error(
							'MODULE_RESOLUTION_TRACE_ONLY requires validated CAP-010 and CAP-012 evidence.'
						);
					const importerSources = snapshot.sources.filter(
						(source) => source.logicalPath === CONDITIONAL_EXPORT_RESOLUTION_CONSUMER_LOGICAL_PATH
					);
					expect(importerSources).toHaveLength(1);
					const importerSource = importerSources[0];
					if (importerSource === undefined)
						throw new Error('The selected CAP-011 importer source is absent.');
					const importerResolutions = snapshot.moduleResolutions.filter(
						(resolution) =>
							resolution.sourceId === importerSource.id &&
							resolution.occurrenceKind === 'IMPORT' &&
							resolution.specifier === CONDITIONAL_EXPORT_RESOLUTION_PACKAGE_NAME &&
							!resolution.typeOnly &&
							resolution.resolutionState === 'RESOLVED_SOURCE'
					);
					expect(importerResolutions).toHaveLength(1);
					const importerResolution = importerResolutions[0];
					if (importerResolution === undefined)
						throw new Error('The selected CAP-011 semantic module resolution is absent.');
					const importerContextSources = projectContextGraph.sources.filter(
						(source) => source.semanticSourceId === importerSource.id
					);
					expect(importerContextSources).toHaveLength(1);
					const importerContextSource = importerContextSources[0];
					if (importerContextSource === undefined)
						throw new Error('The selected CAP-011 project-context source is absent.');
					const importerContextPrograms = projectContextGraph.programs.filter(
						(program) => program.semanticProgramId === importerSource.programId
					);
					expect(importerContextPrograms).toHaveLength(1);
					const importerContextProgram = importerContextPrograms[0];
					if (importerContextProgram === undefined)
						throw new Error('The selected CAP-011 project-context Program is absent.');
					const moduleResolutionTraceBudgets = {
						maxAstNodes: 100_000,
						maxAttempts: 100_000,
						maxCandidates: 100_000,
						maxDiagnostics: 100_000,
						maxInputRecords: 50_000_000,
						maxInputStringCharacters: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES,
						maxOutputRecords: 200_001,
						maxReadBytes: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES,
						maxTraversalSteps: 300_000
					};
					moduleResolutionTraceInputs = {
						conditionalExportRequest: conditionalExportInputs.request,
						conditionalExportResolution: conditionalExportResolutionResult.resolution,
						frozenSubject: subject,
						projectContextGraph,
						request: {
							budgets: moduleResolutionTraceBudgets,
							conditionalExportResolution: {
								contentDigest: conditionalExportResolutionResult.resolution.contentDigest,
								id: conditionalExportResolutionResult.resolution.id,
								inputDigest: conditionalExportResolutionResult.resolution.inputDigest
							},
							importer: {
								projectContextProgramId: importerContextProgram.id,
								projectContextSourceId: importerContextSource.id,
								semanticModuleResolutionId: importerResolution.id,
								semanticProgramId: importerSource.programId,
								semanticSourceId: importerSource.id,
								specifierNodeId: importerResolution.nodeId
							},
							operationVersion: MODULE_RESOLUTION_TRACE_OPERATION_VERSION,
							packageName: CONDITIONAL_EXPORT_RESOLUTION_PACKAGE_NAME,
							projectContextGraph: {
								contentDigest: projectContextGraph.contentDigest,
								graphId: projectContextGraph.id,
								inputDigest: projectContextGraph.inputDigest
							},
							schemaVersion: MODULE_RESOLUTION_TRACE_REQUEST_SCHEMA_VERSION,
							selection: MODULE_RESOLUTION_TRACE_SELECTION,
							semanticSnapshotId: snapshot.id,
							specifier: CONDITIONAL_EXPORT_RESOLUTION_PACKAGE_NAME,
							subjectId: subject.descriptor.subjectId
						},
						semanticSnapshot: snapshot
					};
					const moduleResolutionProgressEvents: ModuleResolutionTraceProgressEvent[] = [];
					const moduleResolutionStartedAt = performance.now();
					telemetry.start('MODULE_RESOLUTION_TRACE', {
						budgetClassification: 'PROVISIONAL_CALLER_OPERATION_BUDGETS_NOT_PRODUCT_CEILINGS',
						importerLogicalPath: importerSource.logicalPath,
						packageName: CONDITIONAL_EXPORT_RESOLUTION_PACKAGE_NAME,
						semanticModuleResolutionId: importerResolution.id
					});
					const moduleResolutionOutcome = buildModuleResolutionTrace(moduleResolutionTraceInputs, {
						onProgress(event) {
							moduleResolutionProgressEvents.push(event);
							process.stdout.write(`${JSON.stringify(event)}\n`);
						}
					});
					await Promise.resolve();
					expect(
						moduleResolutionProgressEvents
							.filter((event) => event.state === 'COMPLETED')
							.map((event) => event.phase)
					).toEqual([
						'REQUEST_BIND',
						'INPUT_BUDGET',
						'SEMANTIC_SNAPSHOT_VALIDATE',
						'PROJECT_CONTEXT_GRAPH_VALIDATE',
						'CONDITIONAL_EXPORT_RESOLUTION_VALIDATE',
						'IMPORTER_BIND',
						'IMPLIED_NODE_FORMAT_RESOLVE',
						'MODULE_RESOLVE',
						'TARGET_BIND',
						'MATERIALIZE',
						'SERIALIZE',
						'TRACE_VALIDATE'
					]);
					expect(moduleResolutionOutcome.outcome, JSON.stringify(moduleResolutionOutcome)).toBe(
						'partial'
					);
					if (moduleResolutionOutcome.outcome !== 'partial')
						throw new Error(JSON.stringify(moduleResolutionOutcome));
					const trace = moduleResolutionOutcome.trace;
					expect(
						validateModuleResolutionTrace(trace, moduleResolutionTraceInputs, {
							maxDepth: 4_096,
							maxInputRecords: moduleResolutionTraceBudgets.maxInputRecords,
							maxInputStringCharacters: moduleResolutionTraceBudgets.maxInputStringCharacters,
							maxIssues: moduleResolutionTraceBudgets.maxDiagnostics,
							maxRecords: moduleResolutionTraceBudgets.maxInputRecords,
							maxStringCharacters: moduleResolutionTraceBudgets.maxInputStringCharacters
						})
					).toEqual({ issues: [], state: 'VALID' });
					expect(trace.budgets).toEqual(moduleResolutionTraceBudgets);
					expect(trace.attempts.map((attempt) => attempt.ordinal)).toEqual(
						trace.attempts.map((_, index) => index)
					);
					expect(trace.candidates).toHaveLength(trace.coverage.moduleResolutionFileExistsAttempts);
					expect(
						trace.candidates.filter((candidate) => candidate.disposition === 'SELECTED')
					).toHaveLength(1);
					expect(trace.coverage).toEqual({
						astNodes: 2_192,
						attemptPopulationReconciles: true,
						attemptRecords: 22,
						candidatePopulationReconciles: true,
						candidateRecords: 4,
						chargedTraversalSteps: 2_218,
						excludedCandidates: 3,
						impliedNodeFormatAttempts: 5,
						inputRecords: 23,
						moduleResolutionAttempts: 17,
						moduleResolutionFileExistsAttempts: 4,
						outputRecords: 27,
						readBytes: 34_463,
						relationPopulationReconciles: true,
						relationRecords: 1,
						selectedCandidates: 1,
						selectedImporterPrograms: 1,
						selectedImporterSources: 1,
						selectedTargets: 1,
						selectedWorkspacePackages: 1
					});
					expect(trace.importerWitness).toMatchObject({
						bytes: 30_355,
						contentSha256: 'ea7e5fda9b23211c971aca97d6394c9e9e3863f2319eda13a7db4d67d56b1170',
						logicalPath: CONDITIONAL_EXPORT_RESOLUTION_CONSUMER_LOGICAL_PATH,
						occurrenceKind: 'IMPORT',
						specifier: CONDITIONAL_EXPORT_RESOLUTION_PACKAGE_NAME,
						typeOnly: false
					});
					expect(trace.targetWitness).toMatchObject({
						artifactClass: 'CONTEXT_ONLY',
						bytes: 325,
						contentSha256: 'ec320112b3cf6e5ebae8e439d7d63201b86577f11143e729f9cb2b19c60e4209',
						declarationFile: true,
						extension: '.d.ts',
						logicalPath: 'packages/rph-contracts/dist/index.d.ts',
						originalResolvedLogicalPath: 'node_modules/@janumipwb/rph-contracts/dist/index.d.ts',
						origin: 'WORKSPACE_BUILD_DECLARATION',
						packageExportTarget: './dist/index.d.ts',
						packageName: CONDITIONAL_EXPORT_RESOLUTION_PACKAGE_NAME,
						packageWorkspacePath: 'packages/rph-contracts'
					});
					expect(trace.resolverEnvironment).toMatchObject({
						compilerVersion: '5.9.3',
						customConditions: [],
						impliedNodeFormatName: 'ESNext',
						moduleName: 'NodeNext',
						moduleResolutionName: 'NodeNext',
						packageJsonType: 'module',
						publicConditionMembership: { import: true, node: true, types: true },
						publicConditionOrder: 'NOT_CLAIMED',
						resolutionModeName: 'ESNext'
					});
					expect(trace.canonicalProfile).toBe(MODULE_RESOLUTION_TRACE_CANONICAL_PROFILE);
					expect(trace.capability).toBe(MODULE_RESOLUTION_TRACE_CAPABILITY);
					expect(trace.capabilityStatus).toBe(MODULE_RESOLUTION_TRACE_CAPABILITY_STATUS);
					expect(trace.method).toBe(MODULE_RESOLUTION_TRACE_METHOD);
					expect(trace.operationVersion).toBe(MODULE_RESOLUTION_TRACE_OPERATION_VERSION);
					expect(trace.schemaVersion).toBe(MODULE_RESOLUTION_TRACE_SCHEMA_VERSION);
					expect(trace.selection).toEqual(MODULE_RESOLUTION_TRACE_SELECTION);
					expect(trace.subjectId).toBe(subject.descriptor.subjectId);
					expect(trace.semanticSnapshotId).toBe(snapshot.id);
					expect(trace.health).toBe('PARTIAL');
					expect(trace.closure).toBe('CLOSED_FOR_SELECTED_SUPPORTED_EXACT_RESOLVED_REQUEST');
					expect(trace.resultCompleteness).toBe(
						'COMPLETE_FOR_SELECTED_SUPPORTED_EXACT_RESOLVED_REQUEST'
					);
					expect(trace.resolutionAuthority).toBe(MODULE_RESOLUTION_TRACE_AUTHORITY);
					expect(trace.authorityTransfer).toBe(MODULE_RESOLUTION_TRACE_AUTHORITY_TRANSFER);
					expect(trace.gateEffect).toBe(MODULE_RESOLUTION_TRACE_GATE_EFFECT);
					expect(trace.freshness).toBe(MODULE_RESOLUTION_TRACE_FRESHNESS);
					expect(trace.currentness).toBe(MODULE_RESOLUTION_TRACE_CURRENTNESS);
					expect(trace.fullJanCsaa011Conformance).toBe(
						MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_011_CONFORMANCE
					);
					expect(trace.fullJanCsaa007Conformance).toBe(
						MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_007_CONFORMANCE
					);
					expect(trace.fullJanCsaa008Conformance).toBe(
						MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_008_CONFORMANCE
					);
					expect(trace.nonclaims).toEqual(MODULE_RESOLUTION_TRACE_NONCLAIMS);
					expect(trace.truncation).toEqual({ reason: null, state: 'NOT_TRUNCATED' });
					const moduleResolutionWitness = canonicalSemanticJsonWitness(trace);
					telemetry.complete({
						attempts: trace.attempts.length,
						bytes: moduleResolutionWitness.bytes,
						candidates: trace.candidates.length,
						readBytes: trace.coverage.readBytes,
						targetLogicalPath: trace.targetWitness.logicalPath,
						validationState: 'VALID'
					});
					moduleResolutionTraceResult = {
						attempts: trace.attempts.length,
						authorityTransfer: trace.authorityTransfer,
						bytes: moduleResolutionWitness.bytes,
						candidates: trace.candidates.length,
						capability: trace.capability,
						capabilityStatus: trace.capabilityStatus,
						chargedTraversalSteps: trace.coverage.chargedTraversalSteps,
						closure: trace.closure,
						contentDigest: trace.contentDigest,
						currentness: trace.currentness,
						durationMs: Math.max(0, Math.round(performance.now() - moduleResolutionStartedAt)),
						freshness: trace.freshness,
						fullJanCsaa007Conformance: trace.fullJanCsaa007Conformance,
						fullJanCsaa008Conformance: trace.fullJanCsaa008Conformance,
						fullJanCsaa011Conformance: trace.fullJanCsaa011Conformance,
						gateEffect: trace.gateEffect,
						health: trace.health,
						inputDigest: trace.inputDigest,
						nonclaims: trace.nonclaims,
						readBytes: trace.coverage.readBytes,
						resolutionAuthority: trace.resolutionAuthority,
						resultCompleteness: trace.resultCompleteness,
						sha256: moduleResolutionWitness.sha256,
						targetLogicalPath: trace.targetWitness.logicalPath,
						trace,
						traceId: trace.id
					};
				} else if (
					!SMOKE_PROJECTION_PLAN.terminateAfterConditionalExportResolution &&
					!SMOKE_PROJECTION_PLAN.terminateAfterProjectContextGraph
				)
					telemetry.skip('MODULE_RESOLUTION_TRACE', {
						reason: 'The selected smoke suite does not request a module-resolution trace.',
						reasonCode: 'SUITE_PHASE_NOT_REQUESTED'
					});
				if (SMOKE_PROJECTION_PLAN.terminateAfterModuleResolutionTrace) {
					if (
						projectContextGraphResult === null ||
						conditionalExportResolutionResult === null ||
						moduleResolutionTraceResult === null
					)
						throw new Error(
							'MODULE_RESOLUTION_TRACE_ONLY cannot complete without validated CAP-010, CAP-012, and CAP-011 evidence.'
						);
					for (const phase of MODULE_RESOLUTION_TRACE_ONLY_DOWNSTREAM_SKIPPED_PHASES)
						telemetry.skip(phase, {
							reason:
								'The module-resolution-trace-only suite terminates after one exact verified-capture TypeScript resolution.',
							reasonCode: 'SUITE_PHASE_NOT_REQUESTED'
						});
					const phaseDurationsMs = telemetry.phaseDurationsMs();
					const skippedPhases = telemetry.skippedPhases();
					const completedPhases = Object.keys(phaseDurationsMs);
					expect(completedPhases).toEqual(MODULE_RESOLUTION_TRACE_ONLY_COMPLETED_PHASES);
					expect(skippedPhases).toEqual(MODULE_RESOLUTION_TRACE_ONLY_EXPECTED_SKIPPED_PHASES);
					telemetry.finish({
						completedPhases,
						conditionalExportResolved: true,
						logicalGraphComposed: false,
						moduleResolutionTraced: true,
						projectContextProjected: true,
						projects: snapshot.projects.length,
						semanticSnapshotOutcome: outcome.outcome,
						semanticProfile: SMOKE_PROFILE,
						skippedPhases,
						smokeSuite: SMOKE_SUITE,
						sources: snapshot.sources.length,
						terminalPhase: 'MODULE_RESOLUTION_TRACE'
					});
					process.stdout.write(
						`${JSON.stringify({
							arrowCommandCensus: null,
							callGraph: null,
							completedPhases,
							commandEventContractStaticOverlay: null,
							commandDispatchStaticTopology: null,
							commandHandlerStaticProjection: null,
							conditionalExportResolution: conditionalExportResolutionResult,
							declarationContextAnalysis: declarationContextAnalysisResult,
							dependencyProviderComparison: null,
							event: 'CSAA_REPOSITORY_SMOKE_RESULT',
							exactSubjectReuse: null,
							guardClassificationStaticOverlay: null,
							guardEnforcementLedger: null,
							logicalGraphComposition: null,
							moduleDependencyGraph: null,
							moduleResolutionTrace: moduleResolutionTraceResult,
							phaseDurationsMs,
							projectContextGraph: projectContextGraphResult,
							projectCount: snapshot.projects.length,
							readWriteAccessGraph: null,
							selectedSubjectArtifactBytes: subjectArtifactBytes,
							selectedSubjectArtifactCount: subject.artifacts.length,
							selectedSubjectId: subject.descriptor.subjectId,
							selector: SMOKE_SELECTOR ?? null,
							semanticPipelineDurationMs,
							semanticProfile: SMOKE_PROFILE,
							semanticSnapshotMemoryHighWaterBytes: semanticMemoryHighWaterBytes,
							semanticSnapshotOutcome: outcome.outcome,
							semanticSnapshotPhaseDurationsMs: semanticPhaseDurationsMs,
							semanticSnapshotProgressEvents: semanticProgressEvents.length,
							semanticSnapshotWitness,
							skippedPhases,
							smokeSuite: SMOKE_SUITE,
							sourceCount: snapshot.sources.length,
							stateMachine: null,
							structuralModuleReachabilityAnalysis: null,
							structuralSccAnalysis: null,
							terminalPhase: 'MODULE_RESOLUTION_TRACE'
						})}\n`
					);
					return;
				}
				if (SMOKE_PROJECTION_PLAN.runDeclarationContextAnalysis) {
					if (
						projectContextGraph === null ||
						projectContextGraphResult === null ||
						conditionalExportInputs === null ||
						conditionalExportResolutionResult === null ||
						moduleResolutionTraceInputs === null ||
						moduleResolutionTraceResult === null
					)
						throw new Error(
							'DECLARATION_CONTEXT_ANALYSIS_ONLY requires validated CAP-010, CAP-012, and CAP-011 evidence.'
						);
					const declarationContextStartedAt = performance.now();
					const declarationContextBudgets = {
						maxAliasHops: 10_000,
						maxArtifacts: 100,
						maxCompilerInputAttempts: 1_000_000,
						maxDeclarations: 10_000,
						maxDiagnostics: 100_000,
						maxDurationMs: REPOSITORY_SMOKE_FAILSAFE_SEMANTIC_DURATION_MS,
						maxExportSymbols: 100_000,
						maxInputRecords: 50_000_000,
						maxInputStringCharacters: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES,
						maxOutputRecords: 2_000_000,
						maxParsedArtifactAstNodes: 100_000,
						maxProgramAstNodes: 10_000_000,
						maxProgramReadBytes: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES,
						maxProgramSourceFiles: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_FILES,
						maxReadBytes: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES,
						maxRelations: 30_000,
						maxTraversalSteps: 20_000_000
					};
					const declarationContextInputs: DeclarationContextAnalysisBuildInputs = {
						conditionalExportRequest: conditionalExportInputs.request,
						conditionalExportResolution: conditionalExportResolutionResult.resolution,
						frozenSubject: subject,
						moduleResolutionRequest: moduleResolutionTraceInputs.request,
						moduleResolutionTrace: moduleResolutionTraceResult.trace,
						projectContextGraph,
						request: {
							budgets: declarationContextBudgets,
							conditionalExportResolution: {
								contentDigest: conditionalExportResolutionResult.resolution.contentDigest,
								id: conditionalExportResolutionResult.resolution.id,
								inputDigest: conditionalExportResolutionResult.resolution.inputDigest
							},
							exportName: DECLARATION_CONTEXT_ANALYSIS_EXPORT_NAME,
							moduleResolutionTrace: {
								contentDigest: moduleResolutionTraceResult.trace.contentDigest,
								id: moduleResolutionTraceResult.trace.id,
								inputDigest: moduleResolutionTraceResult.trace.inputDigest
							},
							operationVersion: DECLARATION_CONTEXT_ANALYSIS_OPERATION_VERSION,
							projectContextGraph: {
								contentDigest: projectContextGraph.contentDigest,
								graphId: projectContextGraph.id,
								inputDigest: projectContextGraph.inputDigest
							},
							schemaVersion: DECLARATION_CONTEXT_ANALYSIS_REQUEST_SCHEMA_VERSION,
							selection: DECLARATION_CONTEXT_ANALYSIS_SELECTION,
							semanticSnapshotId: snapshot.id,
							subjectId: subject.descriptor.subjectId
						},
						semanticSnapshot: snapshot
					};
					const declarationContextProgressEvents: DeclarationContextAnalysisProgressEvent[] = [];
					telemetry.start('DECLARATION_CONTEXT_ANALYSIS', {
						budgetClassification: 'PROVISIONAL_CALLER_OPERATION_BUDGETS_NOT_PRODUCT_CEILINGS',
						exportName: DECLARATION_CONTEXT_ANALYSIS_EXPORT_NAME,
						importerLogicalPath: CONDITIONAL_EXPORT_RESOLUTION_CONSUMER_LOGICAL_PATH,
						packageName: CONDITIONAL_EXPORT_RESOLUTION_PACKAGE_NAME,
						targetLogicalPath: moduleResolutionTraceResult.trace.targetWitness.logicalPath
					});
					const declarationContextOutcome = buildDeclarationContextAnalysis(
						declarationContextInputs,
						{
							onProgress(event) {
								declarationContextProgressEvents.push(event);
								process.stdout.write(`${JSON.stringify(event)}\n`);
							}
						}
					);
					await Promise.resolve();
					expect(
						declarationContextProgressEvents
							.filter((event) => event.state === 'COMPLETED')
							.map((event) => event.phase)
					).toEqual([
						'REQUEST_BIND',
						'INPUT_BUDGET',
						'SEMANTIC_SNAPSHOT_VALIDATE',
						'PROJECT_CONTEXT_GRAPH_VALIDATE',
						'CONDITIONAL_EXPORT_RESOLUTION_VALIDATE',
						'MODULE_RESOLUTION_TRACE_VALIDATE',
						'PROGRAM_CONSTRUCT',
						'PROGRAM_SOURCE_ACCOUNT',
						'ROOT_EXPORT_ENUMERATE',
						'ALIAS_RESOLVE',
						'TERMINAL_DECLARATION_BIND',
						'ARTIFACT_BIND',
						'ARTIFACT_PARSE_ACCOUNT',
						'MATERIALIZE',
						'SERIALIZE',
						'ANALYSIS_VALIDATE'
					]);
					expect(
						declarationContextOutcome.outcome,
						JSON.stringify(declarationContextOutcome.diagnostics)
					).toBe('partial');
					if (declarationContextOutcome.outcome !== 'partial')
						throw new Error(JSON.stringify(declarationContextOutcome));
					const analysis = declarationContextOutcome.analysis;
					expect(
						validateDeclarationContextAnalysis(analysis, declarationContextInputs, {
							maxDepth: 4_096,
							maxInputRecords: declarationContextBudgets.maxInputRecords,
							maxInputStringCharacters: declarationContextBudgets.maxInputStringCharacters,
							maxIssues: declarationContextBudgets.maxDiagnostics,
							maxRecords: declarationContextBudgets.maxInputRecords,
							maxStringCharacters: declarationContextBudgets.maxInputStringCharacters
						})
					).toEqual({ issues: [], state: 'VALID' });
					expect(analysis.budgets).toEqual(declarationContextBudgets);
					expect(analysis.programInputAttempts).toHaveLength(16_775);
					expect(analysis.programInputAttempts.map((attempt) => attempt.ordinal)).toEqual(
						analysis.programInputAttempts.map((_, index) => index)
					);
					expect(analysis.programWitness.programInputAttemptIds).toEqual(
						analysis.programInputAttempts.map((attempt) => attempt.id)
					);
					expect({
						callerAnalysis: analysis.programInputAttempts.filter(
							(attempt) => attempt.stage === 'CALLER_ANALYSIS'
						).length,
						programConstruction: analysis.programInputAttempts.filter(
							(attempt) => attempt.stage === 'PROGRAM_CONSTRUCTION'
						).length,
						typeCheckerCreate: analysis.programInputAttempts.filter(
							(attempt) => attempt.stage === 'TYPE_CHECKER_CREATE'
						).length
					}).toEqual({ callerAnalysis: 8, programConstruction: 16_760, typeCheckerCreate: 7 });
					expect({
						currentDirectory: analysis.programInputAttempts.filter(
							(attempt) => attempt.query.operation === 'CURRENT_DIRECTORY'
						).length,
						directoryExists: analysis.programInputAttempts.filter(
							(attempt) => attempt.query.operation === 'DIRECTORY_EXISTS'
						).length,
						fileExists: analysis.programInputAttempts.filter(
							(attempt) => attempt.query.operation === 'FILE_EXISTS'
						).length,
						readFile: analysis.programInputAttempts.filter(
							(attempt) => attempt.query.operation === 'READ_FILE'
						).length,
						realpath: analysis.programInputAttempts.filter(
							(attempt) => attempt.query.operation === 'REALPATH'
						).length,
						useCaseSensitiveFileNames: analysis.programInputAttempts.filter(
							(attempt) => attempt.query.operation === 'USE_CASE_SENSITIVE_FILE_NAMES'
						).length
					}).toEqual({
						currentDirectory: 257,
						directoryExists: 3_408,
						fileExists: 1_036,
						readFile: 524,
						realpath: 41,
						useCaseSensitiveFileNames: 11_509
					});
					expect(analysis.programWitness).toMatchObject({
						attributedCompilerInputAttempts: 23_985,
						attributedProgramReadBytes: 6_963_595,
						attributedUniqueQueries: 1_940,
						captureContextDigest:
							'35f4e217b3cf8389d821a6346c5113d1ea2d1d31e8c4ead486ba8c20ac087818',
						compilerOptionsDigest:
							'3c262e7d941acabef403ed565a893d29664f98f8593cbaa45f8be6cde5425faa',
						compilerVersion: '5.9.3',
						configPath: 'packages/rph-application/tsconfig.json',
						materializedRecipeDigest:
							'b8dfd2b35d385872944c760b5d82cb014f0f59bafafd283c138563556eb66fd0',
						programParsedAstNodes: 510_213,
						programSourceFiles: 484,
						programSourcePopulationDigest:
							'852646a944d6593427a637be03ddb887297b6f5db92426db47bc101498e940e1',
						projectResolutionDigest:
							'9354d2331a5ac1c286786c39140cb598adc24a5065975727d0bea3086240d25f',
						state: 'FRESH_PUBLIC_TYPESCRIPT_PROGRAM_OVER_VERIFIED_PROJECT_SCOPED_CAPTURE'
					});
					expect(analysis.parseWitnesses).toHaveLength(1);
					const parseWitness = analysis.parseWitnesses[0];
					if (parseWitness === undefined)
						throw new Error('The selected CAP-013 declaration-artifact parse witness is absent.');
					expect(parseWitness).toMatchObject({
						astNodes: 25,
						bytes: 325,
						compilerVersion: '5.9.3',
						contentSha256: 'ec320112b3cf6e5ebae8e439d7d63201b86577f11143e729f9cb2b19c60e4209',
						decodedUtf16CodeUnits: 325,
						externalModule: true,
						languageVersion: { nativeCode: 9, nativeName: 'ES2022' },
						logicalPath: 'packages/rph-contracts/dist/index.d.ts',
						parseDiagnostics: [],
						parseHealth: 'VALID',
						parseMethod: 'TYPESCRIPT_PUBLIC_CREATE_SOURCE_FILE_OVER_EXACT_CAPTURED_BYTES',
						programSourceReconciliation: 'EXACT_LOGICAL_PATH_CONTENT_SHA256_AND_SEMANTIC_SOURCE_ID',
						scriptKind: { nativeCode: 3, nativeName: 'TS' },
						sourceEncoding: 'UTF8',
						sourceRead: {
							attributedInvocationCount: 1,
							inputRecordOrdinal: 16_775,
							invocationOrdinal: 1,
							observation: {
								byteBudgetClass: 'LIVE_COMPILER_CONTEXT',
								contentBytes: 325,
								contentSha256: 'ec320112b3cf6e5ebae8e439d7d63201b86577f11143e729f9cb2b19c60e4209',
								invocationCount: 6,
								logicalPath: 'packages/rph-contracts/dist/index.d.ts',
								operation: 'READ_FILE',
								origin: 'WORKSPACE_BUILD_DECLARATION',
								result: 'PRESENT'
							},
							query: {
								logicalPath: 'packages/rph-contracts/dist/index.d.ts',
								operation: 'READ_FILE'
							},
							stage: 'DECLARATION_ARTIFACT_PARSE'
						},
						statements: 9
					});
					expect(analysis.exportBinding).toMatchObject({
						aliasHops: [],
						exportSymbolsExamined: 859,
						exportName: DECLARATION_CONTEXT_ANALYSIS_EXPORT_NAME,
						ordinal: 0,
						resolutionKind: 'DIRECT_TERMINAL_SYMBOL',
						rootExportSymbolFlags: {
							compilerVersion: '5.9.3',
							nativeMask: 2,
							nativeNames: ['BlockScopedVariable']
						},
						selectionApi: 'TYPESCRIPT_PUBLIC_TYPE_CHECKER_GET_EXPORTS_OF_MODULE'
					});
					expect(analysis.terminalSymbol).toMatchObject({
						declarationSetClosure: 'COMPLETE_PUBLIC_CHECKER_DECLARATION_SET_SAME_ARTIFACT',
						flags: {
							compilerVersion: '5.9.3',
							nativeMask: 2,
							nativeNames: ['BlockScopedVariable']
						},
						mergeState: 'SINGLE',
						name: DECLARATION_CONTEXT_ANALYSIS_EXPORT_NAME,
						ordinal: 0,
						symbolMeaning: 'TERMINAL_CHECKER_SYMBOL_FOR_SELECTED_PACKAGE_ROOT_EXPORT'
					});
					expect(analysis.declarations).toHaveLength(1);
					expect(analysis.exportBinding.aliasHops).toEqual([]);
					expect(analysis.artifacts).toHaveLength(1);
					const terminalDeclaration = analysis.declarations[0];
					if (terminalDeclaration === undefined)
						throw new Error('The selected CAP-013 terminal declaration is absent.');
					expect(terminalDeclaration).toMatchObject({
						ambientContext: 'DECLARATION_FILE',
						end: 52,
						kind: 'VARIABLE',
						name: DECLARATION_CONTEXT_ANALYSIS_EXPORT_NAME,
						nameEnd: 42,
						nameStart: 21,
						nativeKind: {
							compilerVersion: '5.9.3',
							nativeCode: 261,
							nativeName: 'VariableDeclaration'
						},
						ordinal: 0,
						role: 'SELECTED_TERMINAL_SYMBOL_DECLARATION',
						start: 21
					});
					const rootArtifact = analysis.artifacts.find(
						(artifact) => artifact.id === analysis.exportBinding.rootArtifactId
					);
					if (rootArtifact === undefined)
						throw new Error('The selected CAP-013 root declaration artifact is absent.');
					expect(rootArtifact).toMatchObject({
						artifactClass: 'CONTEXT_ONLY',
						bytes: 325,
						contentSha256: 'ec320112b3cf6e5ebae8e439d7d63201b86577f11143e729f9cb2b19c60e4209',
						declarationFile: true,
						declarationRole: 'EMITTED_DECLARATION',
						extension: '.d.ts',
						logicalPath: 'packages/rph-contracts/dist/index.d.ts',
						ordinal: 0,
						origin: 'WORKSPACE_BUILD_DECLARATION'
					});
					expect(rootArtifact.roles).toEqual([
						'CAP011_SELECTED_DECLARATION_TARGET',
						'SELECTED_EXPORT_BINDING_CARRIER',
						'TERMINAL_DECLARATION_CONTAINER'
					]);
					const terminalArtifact = analysis.artifacts.find(
						(artifact) => artifact.id === analysis.terminalSymbol.declarationArtifactId
					);
					if (terminalArtifact === undefined)
						throw new Error('The selected CAP-013 terminal declaration artifact is absent.');
					expect(terminalArtifact).toMatchObject({
						artifactClass: 'CONTEXT_ONLY',
						declarationFile: true,
						logicalPath: moduleResolutionTraceResult.trace.targetWitness.logicalPath,
						origin: 'WORKSPACE_BUILD_DECLARATION'
					});
					expect(terminalArtifact.id).toBe(rootArtifact.id);
					expect(analysis.augmentationRecords).toEqual([]);
					expect(analysis.ambientEffectRecords).toEqual([]);
					expect(analysis.merges).toEqual([]);
					expect(
						analysis.relations.map((relation) => ({
							kind: relation.kind,
							ordinal: relation.ordinal
						}))
					).toEqual([
						{ kind: 'DECLARES', ordinal: 0 },
						{ kind: 'CONTRIBUTES_TO', ordinal: 1 }
					]);
					expect(analysis.coverage).toEqual({
						aliasHops: 0,
						ambientEffectRecords: 0,
						artifactPopulationReconciles: true,
						artifactReadBytes: 325,
						artifactReadWitnesses: 1,
						artifacts: 1,
						augmentationRecords: 0,
						chargedTraversalSteps: 528_360,
						contributesToRelations: 1,
						declarationPopulationReconciles: true,
						declarations: 1,
						declaresRelations: 1,
						diagnosticRecords: 0,
						exportBindings: 1,
						exportSymbolsExamined: 859,
						inputRecords: 16_776,
						mergePopulationReconciles: true,
						mergeRecords: 0,
						mergesWithRelations: 0,
						outputRecords: 16_783,
						parseWitnessPopulationReconciles: true,
						parseWitnesses: 1,
						programCompilerInputAttemptPopulationReconciles: true,
						programCompilerInputAttempts: 16_775,
						programParsedAstNodePopulationReconciles: true,
						programParsedAstNodes: 510_213,
						programPresentReadFileAttempts: 524,
						programReadBytes: 6_961_515,
						programSourceFilePopulationReconciles: true,
						programSourceFiles: 484,
						readBytes: 6_961_840,
						readOperations: 525,
						relationPopulationReconciles: true,
						relationRecords: 2,
						selectedAstNodePopulationReconciles: true,
						selectedAstNodes: 25,
						selectedExportBindings: 1,
						selectedPackageRootTargets: 1,
						terminalSymbols: 1
					});
					expect(analysis.canonicalProfile).toBe(DECLARATION_CONTEXT_ANALYSIS_CANONICAL_PROFILE);
					expect(analysis.capability).toBe(DECLARATION_CONTEXT_ANALYSIS_CAPABILITY);
					expect(analysis.capabilityStatus).toBe(DECLARATION_CONTEXT_ANALYSIS_CAPABILITY_STATUS);
					expect(analysis.method).toBe(DECLARATION_CONTEXT_ANALYSIS_METHOD);
					expect(analysis.operationVersion).toBe(DECLARATION_CONTEXT_ANALYSIS_OPERATION_VERSION);
					expect(analysis.schemaVersion).toBe(DECLARATION_CONTEXT_ANALYSIS_SCHEMA_VERSION);
					expect(analysis.selection).toEqual(DECLARATION_CONTEXT_ANALYSIS_SELECTION);
					expect(analysis.subjectId).toBe(subject.descriptor.subjectId);
					expect(analysis.semanticSnapshotId).toBe(snapshot.id);
					expect(analysis.health).toBe('PARTIAL');
					expect(analysis.closure).toBe(
						'CLOSED_FOR_SELECTED_SUPPORTED_EXACT_EXPORT_DECLARATION_BINDING'
					);
					expect(analysis.resultCompleteness).toBe(
						'COMPLETE_FOR_SELECTED_SUPPORTED_EXACT_EXPORT_DECLARATION_BINDING'
					);
					expect(analysis.analysisAuthority).toBe(DECLARATION_CONTEXT_ANALYSIS_AUTHORITY);
					expect(analysis.authorityTransfer).toBe(DECLARATION_CONTEXT_ANALYSIS_AUTHORITY_TRANSFER);
					expect(analysis.gateEffect).toBe(DECLARATION_CONTEXT_ANALYSIS_GATE_EFFECT);
					expect(analysis.freshness).toBe(DECLARATION_CONTEXT_ANALYSIS_FRESHNESS);
					expect(analysis.currentness).toBe(DECLARATION_CONTEXT_ANALYSIS_CURRENTNESS);
					expect(analysis.fullJanCsaa013Conformance).toBe(
						DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_013_CONFORMANCE
					);
					expect(analysis.fullJanCsaa007Conformance).toBe(
						DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_007_CONFORMANCE
					);
					expect(analysis.fullJanCsaa008Conformance).toBe(
						DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_008_CONFORMANCE
					);
					expect(analysis.nonclaims).toEqual(DECLARATION_CONTEXT_ANALYSIS_NONCLAIMS);
					expect(analysis.truncation).toEqual({ reason: null, state: 'NOT_TRUNCATED' });
					const declarationContextWitness = canonicalSemanticJsonWitness(analysis);
					telemetry.complete({
						aliasHops: analysis.coverage.aliasHops,
						artifacts: analysis.artifacts.length,
						bytes: declarationContextWitness.bytes,
						declarations: analysis.declarations.length,
						exportName: analysis.exportBinding.exportName,
						readBytes: analysis.coverage.readBytes,
						terminalArtifactLogicalPath: terminalArtifact.logicalPath,
						terminalMergeState: analysis.terminalSymbol.mergeState,
						validationState: 'VALID'
					});
					declarationContextAnalysisResult = {
						aliasHops: analysis.coverage.aliasHops,
						analysis,
						analysisAuthority: analysis.analysisAuthority,
						analysisId: analysis.id,
						artifacts: analysis.artifacts.length,
						authorityTransfer: analysis.authorityTransfer,
						bytes: declarationContextWitness.bytes,
						capability: analysis.capability,
						capabilityStatus: analysis.capabilityStatus,
						chargedTraversalSteps: analysis.coverage.chargedTraversalSteps,
						closure: analysis.closure,
						contentDigest: analysis.contentDigest,
						currentness: analysis.currentness,
						declarations: analysis.declarations.length,
						durationMs: Math.max(0, Math.round(performance.now() - declarationContextStartedAt)),
						freshness: analysis.freshness,
						fullJanCsaa007Conformance: analysis.fullJanCsaa007Conformance,
						fullJanCsaa008Conformance: analysis.fullJanCsaa008Conformance,
						fullJanCsaa013Conformance: analysis.fullJanCsaa013Conformance,
						gateEffect: analysis.gateEffect,
						health: analysis.health,
						inputDigest: analysis.inputDigest,
						mergeState: analysis.terminalSymbol.mergeState,
						nonclaims: analysis.nonclaims,
						readBytes: analysis.coverage.readBytes,
						resultCompleteness: analysis.resultCompleteness,
						sha256: declarationContextWitness.sha256,
						terminalArtifactLogicalPath: terminalArtifact.logicalPath,
						terminalDeclarationKind: terminalDeclaration.kind,
						terminalSymbolName: analysis.terminalSymbol.name
					};
				} else if (!SMOKE_PROJECTION_PLAN.terminateAfterProjectContextGraph)
					telemetry.skip('DECLARATION_CONTEXT_ANALYSIS', {
						reason: 'The selected smoke suite does not request declaration-context analysis.',
						reasonCode: 'SUITE_PHASE_NOT_REQUESTED'
					});
				if (SMOKE_PROJECTION_PLAN.terminateAfterDeclarationContextAnalysis) {
					if (declarationContextAnalysisResult === null)
						throw new Error(
							'DECLARATION_CONTEXT_ANALYSIS_ONLY cannot complete without validated CAP-013 evidence.'
						);
					for (const phase of DECLARATION_CONTEXT_ANALYSIS_ONLY_DOWNSTREAM_SKIPPED_PHASES)
						telemetry.skip(phase, {
							reason:
								'The declaration-context-analysis-only suite terminates after one exact package-root export declaration binding.',
							reasonCode: 'SUITE_PHASE_NOT_REQUESTED'
						});
					const phaseDurationsMs = telemetry.phaseDurationsMs();
					const skippedPhases = telemetry.skippedPhases();
					const completedPhases = Object.keys(phaseDurationsMs);
					expect(completedPhases).toEqual(DECLARATION_CONTEXT_ANALYSIS_ONLY_COMPLETED_PHASES);
					expect(skippedPhases).toEqual(DECLARATION_CONTEXT_ANALYSIS_ONLY_EXPECTED_SKIPPED_PHASES);
					telemetry.finish({
						completedPhases,
						conditionalExportResolved: true,
						declarationContextAnalyzed: true,
						logicalGraphComposed: false,
						moduleResolutionTraced: true,
						projectContextProjected: true,
						projects: snapshot.projects.length,
						semanticSnapshotOutcome: outcome.outcome,
						semanticProfile: SMOKE_PROFILE,
						skippedPhases,
						smokeSuite: SMOKE_SUITE,
						sources: snapshot.sources.length,
						terminalPhase: 'DECLARATION_CONTEXT_ANALYSIS'
					});
					process.stdout.write(
						`${JSON.stringify({
							arrowCommandCensus: null,
							callGraph: null,
							completedPhases,
							commandEventContractStaticOverlay: null,
							commandDispatchStaticTopology: null,
							commandHandlerStaticProjection: null,
							conditionalExportResolution: conditionalExportResolutionResult,
							declarationContextAnalysis: declarationContextAnalysisResult,
							dependencyProviderComparison: null,
							event: 'CSAA_REPOSITORY_SMOKE_RESULT',
							exactSubjectReuse: null,
							guardClassificationStaticOverlay: null,
							guardEnforcementLedger: null,
							logicalGraphComposition: null,
							moduleDependencyGraph: null,
							moduleResolutionTrace: moduleResolutionTraceResult,
							phaseDurationsMs,
							projectContextGraph: projectContextGraphResult,
							projectCount: snapshot.projects.length,
							readWriteAccessGraph: null,
							selectedSubjectArtifactBytes: subjectArtifactBytes,
							selectedSubjectArtifactCount: subject.artifacts.length,
							selectedSubjectId: subject.descriptor.subjectId,
							selector: SMOKE_SELECTOR ?? null,
							semanticPipelineDurationMs,
							semanticProfile: SMOKE_PROFILE,
							semanticSnapshotMemoryHighWaterBytes: semanticMemoryHighWaterBytes,
							semanticSnapshotOutcome: outcome.outcome,
							semanticSnapshotPhaseDurationsMs: semanticPhaseDurationsMs,
							semanticSnapshotProgressEvents: semanticProgressEvents.length,
							semanticSnapshotWitness,
							skippedPhases,
							smokeSuite: SMOKE_SUITE,
							sourceCount: snapshot.sources.length,
							stateMachine: null,
							structuralModuleReachabilityAnalysis: null,
							structuralSccAnalysis: null,
							terminalPhase: 'DECLARATION_CONTEXT_ANALYSIS'
						})}\n`
					);
					return;
				}
				if (SMOKE_PROJECTION_PLAN.terminateAfterProjectContextGraph) {
					if (projectContextGraphResult === null)
						throw new Error(
							'PROJECT_CONTEXT_GRAPH_ONLY cannot complete without validated project-context evidence.'
						);
					for (const phase of PROJECT_CONTEXT_GRAPH_ONLY_DOWNSTREAM_SKIPPED_PHASES)
						telemetry.skip(phase, {
							reason:
								'The project-context-only suite terminates after validated FrozenSubject-bound project context evidence.',
							reasonCode: 'SUITE_PHASE_NOT_REQUESTED'
						});
					const phaseDurationsMs = telemetry.phaseDurationsMs();
					const skippedPhases = telemetry.skippedPhases();
					const completedPhases = Object.keys(phaseDurationsMs);
					expect(completedPhases).toEqual(PROJECT_CONTEXT_GRAPH_ONLY_COMPLETED_PHASES);
					expect(skippedPhases).toEqual(PROJECT_CONTEXT_GRAPH_ONLY_EXPECTED_SKIPPED_PHASES);
					telemetry.finish({
						completedPhases,
						conditionalExportResolved: false,
						logicalGraphComposed: false,
						moduleResolutionTraced: false,
						projectContextProjected: true,
						projects: snapshot.projects.length,
						semanticSnapshotOutcome: outcome.outcome,
						semanticProfile: SMOKE_PROFILE,
						skippedPhases,
						smokeSuite: SMOKE_SUITE,
						sources: snapshot.sources.length,
						terminalPhase: 'PROJECT_CONTEXT_GRAPH'
					});
					process.stdout.write(
						`${JSON.stringify({
							arrowCommandCensus: null,
							callGraph: null,
							completedPhases,
							commandEventContractStaticOverlay: null,
							commandDispatchStaticTopology: null,
							commandHandlerStaticProjection: null,
							conditionalExportResolution: null,
							declarationContextAnalysis: declarationContextAnalysisResult,
							dependencyProviderComparison: null,
							event: 'CSAA_REPOSITORY_SMOKE_RESULT',
							exactSubjectReuse: null,
							guardClassificationStaticOverlay: null,
							guardEnforcementLedger: null,
							logicalGraphComposition: null,
							moduleDependencyGraph: null,
							moduleResolutionTrace: null,
							phaseDurationsMs,
							projectContextGraph: projectContextGraphResult,
							projectCount: snapshot.projects.length,
							readWriteAccessGraph: null,
							selectedSubjectArtifactBytes: subjectArtifactBytes,
							selectedSubjectArtifactCount: subject.artifacts.length,
							selectedSubjectId: subject.descriptor.subjectId,
							selector: SMOKE_SELECTOR ?? null,
							semanticPipelineDurationMs,
							semanticProfile: SMOKE_PROFILE,
							semanticSnapshotMemoryHighWaterBytes: semanticMemoryHighWaterBytes,
							semanticSnapshotOutcome: outcome.outcome,
							semanticSnapshotPhaseDurationsMs: semanticPhaseDurationsMs,
							semanticSnapshotProgressEvents: semanticProgressEvents.length,
							semanticSnapshotWitness,
							skippedPhases,
							smokeSuite: SMOKE_SUITE,
							sourceCount: snapshot.sources.length,
							stateMachine: null,
							structuralModuleReachabilityAnalysis: null,
							structuralSccAnalysis: null,
							terminalPhase: 'PROJECT_CONTEXT_GRAPH'
						})}\n`
					);
					return;
				}
				let moduleDependencyGraph: ModuleDependencyGraphSnapshot | null = null;
				let moduleDependencyGraphResult: null | {
					readonly bytes: number;
					readonly contentDigest: string;
					readonly durationMs: number;
					readonly edges: number;
					readonly graphId: string;
					readonly graphInputDigest: string;
					readonly health: string;
					readonly nodes: number;
					readonly semanticSnapshotId: string;
					readonly sha256: string;
					readonly subjectId: string;
				} = null;
				let structuralSccAnalysisResult: null | {
					readonly analysisId: string;
					readonly authorityTransfer: string;
					readonly bytes: number;
					readonly capability: string;
					readonly capabilityStatus: string;
					readonly components: number;
					readonly contentDigest: string;
					readonly cyclicComponents: number;
					readonly durationMs: number;
					readonly fullJanCsaa007Conformance: string;
					readonly fullJanCsaa008Conformance: string;
					readonly gateEffect: string;
					readonly graphAuthority: string;
					readonly health: string;
					readonly inputEdges: number;
					readonly inputDigest: string;
					readonly inputNodes: number;
					readonly multiNodeComponents: number;
					readonly nonclaims: readonly string[];
					readonly outcome: string;
					readonly selfLoopSingletons: number;
					readonly sha256: string;
					readonly structuralClosure: string;
					readonly subjectId: string;
					readonly upstreamClosure: string;
				} = null;
				let structuralModuleReachabilityAnalysisResult: null | {
					readonly analysisId: string;
					readonly authorityTransfer: string;
					readonly bytes: number;
					readonly capability: string;
					readonly capabilityStatus: string;
					readonly contentDigest: string;
					readonly criterionLogicalPath: string;
					readonly criterionNodeId: string;
					readonly chargedTraversalSteps: number;
					readonly direction: string;
					readonly durationMs: number;
					readonly encounteredFrontiers: number;
					readonly examinedEdges: number;
					readonly fullJanCsaa007Conformance: string;
					readonly fullJanCsaa008Conformance: string;
					readonly gateEffect: string;
					readonly graphAuthority: string;
					readonly health: string;
					readonly inputDigest: string;
					readonly inputEdges: number;
					readonly inputNodes: number;
					readonly maxDistance: number;
					readonly nonclaims: readonly string[];
					readonly outcome: string;
					readonly reachedNodes: number;
					readonly resolutionTargetMembers: number;
					readonly sha256: string;
					readonly sourceMembers: number;
					readonly structuralClosure: string;
					readonly subjectId: string;
					readonly unvisitedNodes: number;
					readonly upstreamClosure: string;
					readonly witnessEdges: number;
				} = null;
				if (SMOKE_PROJECTION_PLAN.runModuleDependencyGraph) {
					const graphStartedAt = performance.now();
					telemetry.start('MODULE_DEPENDENCY_GRAPH', {
						moduleResolutions: snapshot.moduleResolutions.length,
						sources: snapshot.sources.length
					});
					const graphOutcome = buildModuleDependencyGraph(
						{
							operationVersion: MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
							schemaVersion: MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
							semanticSnapshotId: snapshot.id,
							subjectId: snapshot.subjectId
						},
						snapshot
					);
					expect(['complete', 'partial'], JSON.stringify(graphOutcome)).toContain(
						graphOutcome.outcome
					);
					if (graphOutcome.outcome === 'unavailable') throw new Error(JSON.stringify(graphOutcome));
					const graph = graphOutcome.graph;
					expect(validateModuleDependencyGraph(graph, snapshot)).toEqual({
						issues: [],
						state: 'VALID'
					});
					expect(graph.coverage.reconciles).toBe(true);
					expect(graph.coverage.representedSources).toBe(snapshot.sources.length);
					expect(graph.coverage.representedModuleResolutions).toBe(
						snapshot.moduleResolutions.length
					);
					expect(graph.edges).toHaveLength(snapshot.moduleResolutions.length);
					const graphWitness = canonicalSemanticJsonWitness(graph);
					telemetry.complete({
						bytes: graphWitness.bytes,
						edges: graph.edges.length,
						health: graph.health,
						nodes: graph.nodes.length,
						outcome: graphOutcome.outcome,
						validationState: 'VALID'
					});
					moduleDependencyGraph = graph;
					moduleDependencyGraphResult = {
						bytes: graphWitness.bytes,
						contentDigest: graph.contentDigest,
						durationMs: Math.max(0, Math.round(performance.now() - graphStartedAt)),
						edges: graph.edges.length,
						graphId: graph.id,
						graphInputDigest: graph.graphInputDigest,
						health: graph.health,
						nodes: graph.nodes.length,
						semanticSnapshotId: graph.semanticSnapshotId,
						sha256: graphWitness.sha256,
						subjectId: graph.subjectId
					};
				} else
					telemetry.skip('MODULE_DEPENDENCY_GRAPH', {
						reason: 'The selected smoke suite does not request the module-dependency projection.',
						reasonCode: 'SUITE_PHASE_NOT_REQUESTED'
					});
				if (SMOKE_PROJECTION_PLAN.runStructuralModuleReachabilityAnalysis) {
					if (moduleDependencyGraph === null)
						throw new Error('Structural module reachability requires the validated module graph.');
					const reachabilityStartedAt = performance.now();
					const criterionNodes = moduleDependencyGraph.nodes.filter(
						(node) =>
							node.kind === 'SOURCE' &&
							node.logicalPath === STRUCTURAL_MODULE_REACHABILITY_CRITERION_LOGICAL_PATH
					);
					expect(criterionNodes).toHaveLength(1);
					const criterionNode = criterionNodes[0];
					if (criterionNode === undefined)
						throw new Error(
							`Structural module reachability criterion is absent: ${STRUCTURAL_MODULE_REACHABILITY_CRITERION_LOGICAL_PATH}`
						);
					telemetry.start('STRUCTURAL_MODULE_REACHABILITY_ANALYSIS', {
						criterionLogicalPath: STRUCTURAL_MODULE_REACHABILITY_CRITERION_LOGICAL_PATH,
						criterionNodeId: criterionNode.id,
						direction: 'FORWARD',
						edges: moduleDependencyGraph.edges.length,
						nodes: moduleDependencyGraph.nodes.length
					});
					const reachabilityInputs = {
						graph: moduleDependencyGraph,
						request: {
							budgets: {
								maxDiagnostics: 100_000,
								maxEdges: moduleDependencyGraph.edges.length,
								maxFrontierRecords: moduleDependencyGraph.nodes.length,
								maxInputRecords: 10_000_000,
								maxInputStringCharacters: 1_000_000_000,
								maxNodes: moduleDependencyGraph.nodes.length,
								maxReachableNodes: moduleDependencyGraph.nodes.length,
								maxTraversalSteps:
									moduleDependencyGraph.nodes.length + moduleDependencyGraph.edges.length,
								maxWitnessEdges: moduleDependencyGraph.nodes.length
							},
							criterion: { nodeId: criterionNode.id },
							direction: 'FORWARD' as const,
							operationVersion: STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_OPERATION_VERSION,
							schemaVersion: STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_REQUEST_SCHEMA_VERSION,
							selection: STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION,
							semanticSnapshotId: snapshot.id,
							sourceGraph: {
								contentDigest: moduleDependencyGraph.contentDigest,
								graphId: moduleDependencyGraph.id,
								graphInputDigest: moduleDependencyGraph.graphInputDigest,
								graphKind: 'TYPESCRIPT_MODULE_DEPENDENCY' as const
							},
							subjectId: snapshot.subjectId
						},
						semanticSnapshot: snapshot
					};
					const reachabilityOutcome = buildStructuralModuleReachabilityAnalysis(reachabilityInputs);
					expect(reachabilityOutcome.outcome, JSON.stringify(reachabilityOutcome.diagnostics)).toBe(
						'partial'
					);
					if (reachabilityOutcome.outcome !== 'partial')
						throw new Error(JSON.stringify(reachabilityOutcome));
					const analysis = reachabilityOutcome.analysis;
					expect(
						validateStructuralModuleReachabilityAnalysis(analysis, reachabilityInputs, {
							maxDepth: 64,
							maxInputRecords: 10_000_000,
							maxInputStringCharacters: 1_000_000_000,
							maxIssues: 100_000,
							maxRecords: Math.max(1, analysis.coverage.chargedTraversalSteps * 64),
							maxStringCharacters: Math.max(1, analysis.coverage.chargedTraversalSteps * 4_096)
						})
					).toEqual({ issues: [], state: 'VALID' });
					expect(analysis.criterion).toEqual({ nodeId: criterionNode.id });
					expect(analysis.direction).toBe('FORWARD');
					expect(analysis.coverage.criterionReconciles).toBe(true);
					expect(analysis.coverage.memberAccountingReconciles).toBe(true);
					expect(analysis.coverage.traversalReconciles).toBe(true);
					expect(analysis.coverage.witnessAccountingReconciles).toBe(true);
					expect(analysis.coverage).toMatchObject({
						encounteredFrontiers: 1,
						inputEdges: 1_157,
						inputNodes: 2_591,
						maxDistance: 3,
						reachedNodes: 30,
						resolutionTargetMembers: 1,
						sourceMembers: 29,
						unvisitedNodes: 2_561,
						witnessEdges: 29
					});
					expect(analysis.coverage.reachedNodes + analysis.coverage.unvisitedNodes).toBe(
						moduleDependencyGraph.nodes.length
					);
					expect(analysis.nonclaims).toEqual(STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_NONCLAIMS);
					expect(analysis.graphAuthority).toBe(
						STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_GRAPH_AUTHORITY
					);
					expect(analysis.authorityTransfer).toBe(
						STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_AUTHORITY_TRANSFER
					);
					expect(analysis.gateEffect).toBe(STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_GATE_EFFECT);
					expect(analysis.structuralClosure).toBe(
						'EXACT_FOR_SELECTED_VALIDATED_GRAPH_AND_CRITERION'
					);
					expect(analysis.truncation).toEqual({ reason: null, state: 'NOT_TRUNCATED' });
					expect(analysis.upstreamClosure).toBe(moduleDependencyGraph.coverage.closure);
					expect(analysis.upstreamLimitations).toEqual(moduleDependencyGraph.limitations);
					expect(analysis.health).toBe('PARTIAL');
					expect(analysis.fullJanCsaa007Conformance).toBe(
						STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_FULL_JAN_CSAA_007_CONFORMANCE
					);
					expect(analysis.fullJanCsaa008Conformance).toBe(
						STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_FULL_JAN_CSAA_008_CONFORMANCE
					);
					const witness = canonicalSemanticJsonWitness(analysis);
					telemetry.complete({
						bytes: witness.bytes,
						chargedTraversalSteps: analysis.coverage.chargedTraversalSteps,
						criterionNodeId: criterionNode.id,
						encounteredFrontiers: analysis.coverage.encounteredFrontiers,
						examinedEdges: analysis.coverage.examinedEdges,
						maxDistance: analysis.coverage.maxDistance,
						reachedNodes: analysis.coverage.reachedNodes,
						validationState: 'VALID',
						witnessEdges: analysis.coverage.witnessEdges
					});
					structuralModuleReachabilityAnalysisResult = {
						analysisId: analysis.id,
						authorityTransfer: analysis.authorityTransfer,
						bytes: witness.bytes,
						capability: analysis.capability,
						capabilityStatus: analysis.capabilityStatus,
						contentDigest: analysis.contentDigest,
						criterionLogicalPath: STRUCTURAL_MODULE_REACHABILITY_CRITERION_LOGICAL_PATH,
						criterionNodeId: criterionNode.id,
						chargedTraversalSteps: analysis.coverage.chargedTraversalSteps,
						direction: analysis.direction,
						durationMs: Math.max(0, Math.round(performance.now() - reachabilityStartedAt)),
						encounteredFrontiers: analysis.coverage.encounteredFrontiers,
						examinedEdges: analysis.coverage.examinedEdges,
						fullJanCsaa007Conformance: analysis.fullJanCsaa007Conformance,
						fullJanCsaa008Conformance: analysis.fullJanCsaa008Conformance,
						gateEffect: analysis.gateEffect,
						graphAuthority: analysis.graphAuthority,
						health: analysis.health,
						inputDigest: analysis.inputDigest,
						inputEdges: analysis.coverage.inputEdges,
						inputNodes: analysis.coverage.inputNodes,
						maxDistance: analysis.coverage.maxDistance,
						nonclaims: analysis.nonclaims,
						outcome: reachabilityOutcome.outcome,
						reachedNodes: analysis.coverage.reachedNodes,
						resolutionTargetMembers: analysis.coverage.resolutionTargetMembers,
						sha256: witness.sha256,
						sourceMembers: analysis.coverage.sourceMembers,
						structuralClosure: analysis.structuralClosure,
						subjectId: analysis.subjectId,
						unvisitedNodes: analysis.coverage.unvisitedNodes,
						upstreamClosure: analysis.upstreamClosure,
						witnessEdges: analysis.coverage.witnessEdges
					};
				} else
					telemetry.skip('STRUCTURAL_MODULE_REACHABILITY_ANALYSIS', {
						reason:
							'The selected smoke suite does not request structural module reachability analysis.',
						reasonCode: 'SUITE_PHASE_NOT_REQUESTED'
					});
				if (SMOKE_PROJECTION_PLAN.terminateAfterStructuralModuleReachabilityAnalysis) {
					if (
						moduleDependencyGraphResult === null ||
						structuralModuleReachabilityAnalysisResult === null
					)
						throw new Error(
							'STRUCTURAL_MODULE_REACHABILITY_ONLY cannot complete without validated module-graph and reachability evidence.'
						);
					for (const phase of STRUCTURAL_MODULE_REACHABILITY_ONLY_SKIPPED_PHASES)
						telemetry.skip(phase, {
							reason:
								'The structural module reachability-only suite terminates after validated reachability evidence.',
							reasonCode: 'SUITE_PHASE_NOT_REQUESTED'
						});
					const phaseDurationsMs = telemetry.phaseDurationsMs();
					const skippedPhases = telemetry.skippedPhases();
					const completedPhases = Object.keys(phaseDurationsMs);
					expect(completedPhases).toEqual(STRUCTURAL_MODULE_REACHABILITY_ONLY_COMPLETED_PHASES);
					expect(skippedPhases).toEqual(
						STRUCTURAL_MODULE_REACHABILITY_ONLY_EXPECTED_SKIPPED_PHASES
					);
					telemetry.finish({
						completedPhases,
						commandEventContractStaticOverlay: false,
						commandDispatchStaticTopology: false,
						commandHandlerStaticProjection: false,
						conditionalExportResolved: false,
						guardClassificationStaticOverlay: false,
						guardEnforcementLedgerObserved: false,
						logicalGraphComposed: false,
						moduleResolutionTraced: false,
						projectContextProjected: projectContextGraphResult !== null,
						projects: snapshot.projects.length,
						semanticSnapshotOutcome: outcome.outcome,
						semanticProfile: SMOKE_PROFILE,
						skippedPhases,
						smokeSuite: SMOKE_SUITE,
						sources: snapshot.sources.length,
						stateMachineProjected: false,
						structuralModuleReachabilityAnalyzed: true,
						structuralSccAnalyzed: false,
						terminalPhase: 'STRUCTURAL_MODULE_REACHABILITY_ANALYSIS'
					});
					process.stdout.write(
						`${JSON.stringify({
							arrowCommandCensus: null,
							callGraph: null,
							completedPhases,
							commandEventContractStaticOverlay: null,
							commandDispatchStaticTopology: null,
							commandHandlerStaticProjection: null,
							conditionalExportResolution: null,
							declarationContextAnalysis: declarationContextAnalysisResult,
							dependencyProviderComparison: null,
							event: 'CSAA_REPOSITORY_SMOKE_RESULT',
							exactSubjectReuse: null,
							guardClassificationStaticOverlay: null,
							guardEnforcementLedger: null,
							logicalGraphComposition: null,
							projectContextGraph: projectContextGraphResult,
							moduleDependencyGraph: moduleDependencyGraphResult,
							moduleResolutionTrace: null,
							phaseDurationsMs,
							projectCount: snapshot.projects.length,
							readWriteAccessGraph: null,
							selectedSubjectArtifactBytes: subjectArtifactBytes,
							selectedSubjectArtifactCount: subject.artifacts.length,
							selectedSubjectId: subject.descriptor.subjectId,
							selector: SMOKE_SELECTOR ?? null,
							semanticPipelineDurationMs,
							semanticProfile: SMOKE_PROFILE,
							semanticSnapshotOutcome: outcome.outcome,
							semanticSnapshotMemoryHighWaterBytes: semanticMemoryHighWaterBytes,
							semanticSnapshotPhaseDurationsMs: semanticPhaseDurationsMs,
							semanticSnapshotProgressEvents: semanticProgressEvents.length,
							semanticSnapshotWitness,
							skippedPhases,
							smokeSuite: SMOKE_SUITE,
							sourceCount: snapshot.sources.length,
							stateMachine: null,
							structuralModuleReachabilityAnalysis: structuralModuleReachabilityAnalysisResult,
							structuralSccAnalysis: null,
							terminalPhase: 'STRUCTURAL_MODULE_REACHABILITY_ANALYSIS'
						})}\n`
					);
					return;
				}
				if (SMOKE_PROJECTION_PLAN.runStructuralSccAnalysis) {
					if (moduleDependencyGraph === null)
						throw new Error('Structural SCC analysis requires the validated module graph.');
					const sccStartedAt = performance.now();
					telemetry.start('STRUCTURAL_SCC_ANALYSIS', {
						edges: moduleDependencyGraph.edges.length,
						nodes: moduleDependencyGraph.nodes.length
					});
					const sccInputs = {
						graph: moduleDependencyGraph,
						request: {
							budgets: {
								maxComponents: moduleDependencyGraph.nodes.length,
								maxDiagnostics: 100_000,
								maxEdges: moduleDependencyGraph.edges.length,
								maxInputRecords: 10_000_000,
								maxInputStringCharacters: 1_000_000_000,
								maxNodes: moduleDependencyGraph.nodes.length,
								maxTraversalSteps:
									moduleDependencyGraph.nodes.length + moduleDependencyGraph.edges.length
							},
							operationVersion: STRUCTURAL_SCC_ANALYSIS_OPERATION_VERSION,
							schemaVersion: STRUCTURAL_SCC_ANALYSIS_REQUEST_SCHEMA_VERSION,
							selection: STRUCTURAL_SCC_ANALYSIS_SELECTION,
							semanticSnapshotId: snapshot.id,
							sourceGraph: {
								contentDigest: moduleDependencyGraph.contentDigest,
								graphId: moduleDependencyGraph.id,
								graphInputDigest: moduleDependencyGraph.graphInputDigest,
								graphKind: 'TYPESCRIPT_MODULE_DEPENDENCY' as const
							},
							subjectId: snapshot.subjectId
						},
						semanticSnapshot: snapshot
					};
					const sccOutcome = buildStructuralSccAnalysis(sccInputs);
					expect(sccOutcome.outcome, JSON.stringify(sccOutcome.diagnostics)).toBe('partial');
					if (sccOutcome.outcome !== 'partial') throw new Error(JSON.stringify(sccOutcome));
					const analysis = sccOutcome.analysis;
					expect(
						validateStructuralSccAnalysis(analysis, sccInputs, {
							maxDepth: 64,
							maxInputRecords: 10_000_000,
							maxInputStringCharacters: 1_000_000_000,
							maxIssues: 100_000,
							maxRecords: Math.max(1, analysis.coverage.chargedTraversalSteps * 64),
							maxStringCharacters: Math.max(1, analysis.coverage.chargedTraversalSteps * 4_096)
						})
					).toEqual({ issues: [], state: 'VALID' });
					expect(analysis.coverage.partitionReconciles).toBe(true);
					expect(analysis.coverage.edgeAccountingReconciles).toBe(true);
					expect(analysis.coverage).toMatchObject({
						components: 2_591,
						cyclicComponents: 0,
						inputEdges: 1_157,
						inputNodes: 2_591,
						multiNodeComponents: 0,
						selfLoopSingletons: 0
					});
					expect(analysis.nonclaims).toEqual(STRUCTURAL_SCC_ANALYSIS_NONCLAIMS);
					expect(analysis.graphAuthority).toBe(STRUCTURAL_SCC_ANALYSIS_GRAPH_AUTHORITY);
					expect(analysis.authorityTransfer).toBe(STRUCTURAL_SCC_ANALYSIS_AUTHORITY_TRANSFER);
					expect(analysis.gateEffect).toBe(STRUCTURAL_SCC_ANALYSIS_GATE_EFFECT);
					expect(analysis.structuralClosure).toBe('EXACT_FOR_SELECTED_VALIDATED_GRAPH');
					expect(analysis.upstreamClosure).toBe('OPEN');
					expect(analysis.health).toBe('PARTIAL');
					expect(analysis.fullJanCsaa007Conformance).toBe(
						STRUCTURAL_SCC_ANALYSIS_FULL_JAN_CSAA_007_CONFORMANCE
					);
					expect(analysis.fullJanCsaa008Conformance).toBe(
						STRUCTURAL_SCC_ANALYSIS_FULL_JAN_CSAA_008_CONFORMANCE
					);
					expect(moduleDependencyGraph.nodes).toHaveLength(2_591);
					expect(moduleDependencyGraph.edges).toHaveLength(1_157);
					const witness = canonicalSemanticJsonWitness(analysis);
					telemetry.complete({
						bytes: witness.bytes,
						components: analysis.coverage.components,
						cyclicComponents: analysis.coverage.cyclicComponents,
						inputEdges: analysis.coverage.inputEdges,
						inputNodes: analysis.coverage.inputNodes,
						validationState: 'VALID'
					});
					structuralSccAnalysisResult = {
						analysisId: analysis.id,
						authorityTransfer: analysis.authorityTransfer,
						bytes: witness.bytes,
						capability: analysis.capability,
						capabilityStatus: analysis.capabilityStatus,
						components: analysis.coverage.components,
						contentDigest: analysis.contentDigest,
						cyclicComponents: analysis.coverage.cyclicComponents,
						durationMs: Math.max(0, Math.round(performance.now() - sccStartedAt)),
						fullJanCsaa007Conformance: analysis.fullJanCsaa007Conformance,
						fullJanCsaa008Conformance: analysis.fullJanCsaa008Conformance,
						gateEffect: analysis.gateEffect,
						graphAuthority: analysis.graphAuthority,
						health: analysis.health,
						inputEdges: analysis.coverage.inputEdges,
						inputDigest: analysis.inputDigest,
						inputNodes: analysis.coverage.inputNodes,
						multiNodeComponents: analysis.coverage.multiNodeComponents,
						nonclaims: analysis.nonclaims,
						outcome: sccOutcome.outcome,
						selfLoopSingletons: analysis.coverage.selfLoopSingletons,
						sha256: witness.sha256,
						structuralClosure: analysis.structuralClosure,
						subjectId: analysis.subjectId,
						upstreamClosure: analysis.upstreamClosure
					};
				} else
					telemetry.skip('STRUCTURAL_SCC_ANALYSIS', {
						reason: 'The selected smoke suite does not request structural SCC analysis.',
						reasonCode: 'SUITE_PHASE_NOT_REQUESTED'
					});
				if (SMOKE_PROJECTION_PLAN.terminateAfterStructuralSccAnalysis) {
					if (moduleDependencyGraphResult === null || structuralSccAnalysisResult === null)
						throw new Error(
							'STRUCTURAL_SCC_ONLY cannot complete without validated module-graph and SCC evidence.'
						);
					for (const phase of STRUCTURAL_SCC_ONLY_SKIPPED_PHASES)
						telemetry.skip(phase, {
							reason: 'The structural SCC-only suite terminates after validated SCC evidence.',
							reasonCode: 'SUITE_PHASE_NOT_REQUESTED'
						});
					const phaseDurationsMs = telemetry.phaseDurationsMs();
					const skippedPhases = telemetry.skippedPhases();
					const completedPhases = Object.keys(phaseDurationsMs);
					expect(completedPhases).toEqual(STRUCTURAL_SCC_ONLY_COMPLETED_PHASES);
					expect(skippedPhases).toEqual(STRUCTURAL_SCC_ONLY_EXPECTED_SKIPPED_PHASES);
					telemetry.finish({
						completedPhases,
						commandEventContractStaticOverlay: false,
						commandDispatchStaticTopology: false,
						commandHandlerStaticProjection: false,
						conditionalExportResolved: false,
						guardClassificationStaticOverlay: false,
						guardEnforcementLedgerObserved: false,
						logicalGraphComposed: false,
						moduleResolutionTraced: false,
						projects: snapshot.projects.length,
						semanticSnapshotOutcome: outcome.outcome,
						semanticProfile: SMOKE_PROFILE,
						skippedPhases,
						smokeSuite: SMOKE_SUITE,
						sources: snapshot.sources.length,
						stateMachineProjected: false,
						structuralModuleReachabilityAnalyzed: false,
						structuralSccAnalyzed: true,
						terminalPhase: 'STRUCTURAL_SCC_ANALYSIS'
					});
					process.stdout.write(
						`${JSON.stringify({
							arrowCommandCensus: null,
							callGraph: null,
							completedPhases,
							commandEventContractStaticOverlay: null,
							commandDispatchStaticTopology: null,
							commandHandlerStaticProjection: null,
							conditionalExportResolution: null,
							declarationContextAnalysis: declarationContextAnalysisResult,
							dependencyProviderComparison: null,
							event: 'CSAA_REPOSITORY_SMOKE_RESULT',
							exactSubjectReuse: null,
							guardClassificationStaticOverlay: null,
							guardEnforcementLedger: null,
							logicalGraphComposition: null,
							moduleDependencyGraph: moduleDependencyGraphResult,
							moduleResolutionTrace: null,
							phaseDurationsMs,
							projectCount: snapshot.projects.length,
							readWriteAccessGraph: null,
							selectedSubjectArtifactBytes: subjectArtifactBytes,
							selectedSubjectArtifactCount: subject.artifacts.length,
							selectedSubjectId: subject.descriptor.subjectId,
							selector: SMOKE_SELECTOR ?? null,
							semanticPipelineDurationMs,
							semanticProfile: SMOKE_PROFILE,
							semanticSnapshotOutcome: outcome.outcome,
							semanticSnapshotMemoryHighWaterBytes: semanticMemoryHighWaterBytes,
							semanticSnapshotPhaseDurationsMs: semanticPhaseDurationsMs,
							semanticSnapshotProgressEvents: semanticProgressEvents.length,
							semanticSnapshotWitness,
							skippedPhases,
							smokeSuite: SMOKE_SUITE,
							sourceCount: snapshot.sources.length,
							stateMachine: null,
							structuralModuleReachabilityAnalysis: null,
							structuralSccAnalysis: structuralSccAnalysisResult,
							terminalPhase: 'STRUCTURAL_SCC_ANALYSIS'
						})}\n`
					);
					return;
				}
				let callGraph: CallGraphSnapshot | null = null;
				let callGraphResult: null | {
					readonly bytes: number;
					readonly candidateSetCallSites: number;
					readonly durationMs: number;
					readonly externalDispatchCallSites: number;
					readonly nodes: number;
					readonly targetEdges: number;
					readonly unresolvedCallSites: number;
					readonly unsupportedCallSites: number;
				} = null;
				if (SMOKE_PROJECTION_PLAN.runCallGraph && SEMANTIC_CAPABILITIES.includes('TS_TYPE')) {
					const callGraphStartedAt = performance.now();
					telemetry.start('CALL_GRAPH', { callSites: snapshot.invocations.length });
					const callGraphOutcome = buildCallGraph(
						{
							operationVersion: CALL_GRAPH_OPERATION_VERSION,
							schemaVersion: CALL_GRAPH_REQUEST_SCHEMA_VERSION,
							semanticSnapshotId: snapshot.id,
							subjectId: snapshot.subjectId
						},
						snapshot
					);
					expect(callGraphOutcome.outcome, JSON.stringify(callGraphOutcome.diagnostics)).toBe(
						'partial'
					);
					if (callGraphOutcome.outcome === 'unavailable')
						throw new Error(JSON.stringify(callGraphOutcome));
					callGraph = callGraphOutcome.graph;
					expect(callGraph.coverage.reconciles).toBe(true);
					expect(callGraph.coverage.representedCallSites).toBe(snapshot.invocations.length);
					expect(callGraph.coverage.closure).toBe('OPEN');
					expect(callGraph.coverage.wholeProgramReachability).toBe('NOT_CLAIMED');
					const callGraphWitness = canonicalSemanticJsonWitness(callGraph);
					telemetry.complete({
						bytes: callGraphWitness.bytes,
						candidateSetCallSites: callGraph.coverage.candidateSetCallSites,
						edges: callGraph.coverage.targetEdges,
						externalDispatchCallSites: callGraph.coverage.externalDispatchCallSites,
						nodes: callGraph.nodes.length,
						outcome: callGraphOutcome.outcome,
						unsupportedCallSites: callGraph.coverage.unsupportedCallSites,
						unresolvedCallSites: callGraph.coverage.unresolvedCallSites
					});
					callGraphResult = {
						bytes: callGraphWitness.bytes,
						candidateSetCallSites: callGraph.coverage.candidateSetCallSites,
						durationMs: Math.max(0, Math.round(performance.now() - callGraphStartedAt)),
						externalDispatchCallSites: callGraph.coverage.externalDispatchCallSites,
						nodes: callGraph.nodes.length,
						targetEdges: callGraph.coverage.targetEdges,
						unresolvedCallSites: callGraph.coverage.unresolvedCallSites,
						unsupportedCallSites: callGraph.coverage.unsupportedCallSites
					};
				} else
					telemetry.skip('CALL_GRAPH', {
						reason: SMOKE_PROJECTION_PLAN.runCallGraph
							? 'The structural profile does not request TS_TYPE; the current call-graph contract requires it.'
							: 'The selected smoke suite does not request the call-graph projection.',
						reasonCode: SMOKE_PROJECTION_PLAN.runCallGraph
							? 'TS_TYPE_NOT_REQUESTED'
							: 'SUITE_PHASE_NOT_REQUESTED'
					});
				let logicalGraphCompositionResult: null | {
					readonly bytes: number;
					readonly callInputEdges: number;
					readonly callInputNodes: number;
					readonly closure: string;
					readonly conflicts: number;
					readonly contentDigest: string;
					readonly crossLinks: number;
					readonly durationMs: number;
					readonly id: string;
					readonly inheritedLimitations: number;
					readonly inputDigest: string;
					readonly moduleInputEdges: number;
					readonly moduleInputNodes: number;
					readonly sha256: string;
					readonly unmatchedSources: number;
				} = null;
				if (SMOKE_PROJECTION_PLAN.runLogicalGraphComposition) {
					if (moduleDependencyGraph === null || callGraph === null)
						throw new Error(
							'Logical graph composition requires validated module-dependency and call graphs.'
						);
					const logicalCompositionStartedAt = performance.now();
					const logicalCompositionBudgets = {
						maxCallEdges: callGraph.edges.length,
						maxCallNodes: callGraph.nodes.length,
						maxConflictRecords: 0 as const,
						maxDiagnostics: 100_000,
						maxEligibleSourceNodes: snapshot.sources.length * 2,
						maxInputRecords: 50_000_000,
						maxInputStringCharacters: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES,
						maxLinks: snapshot.sources.length,
						maxModuleDependencyEdges: moduleDependencyGraph.edges.length,
						maxModuleDependencyNodes: moduleDependencyGraph.nodes.length,
						maxOutputRecords:
							3 +
							moduleDependencyGraph.limitations.length +
							callGraph.limitations.length +
							snapshot.sources.length,
						maxTraversalSteps:
							moduleDependencyGraph.nodes.length +
							moduleDependencyGraph.edges.length +
							callGraph.nodes.length +
							callGraph.edges.length +
							snapshot.sources.length * 2,
						maxUnmatchedRecords: 0 as const
					};
					const logicalCompositionInputs = {
						callGraph,
						moduleDependencyGraph,
						request: {
							budgets: logicalCompositionBudgets,
							operationVersion: LOGICAL_GRAPH_COMPOSITION_OPERATION_VERSION,
							schemaVersion: LOGICAL_GRAPH_COMPOSITION_REQUEST_SCHEMA_VERSION,
							selection: LOGICAL_GRAPH_COMPOSITION_SELECTION,
							semanticSnapshotId: snapshot.id,
							sourceLayers: [
								{
									canonicalProfile: moduleDependencyGraph.canonicalProfile,
									contentDigest: moduleDependencyGraph.contentDigest,
									graphId: moduleDependencyGraph.id,
									graphInputDigest: moduleDependencyGraph.graphInputDigest,
									graphKind: moduleDependencyGraph.graphKind,
									layerId: moduleDependencyGraph.layers[0].id,
									method: moduleDependencyGraph.method,
									operationVersion: moduleDependencyGraph.operationVersion,
									ordinal: 0 as const,
									producer: moduleDependencyGraph.producer,
									role: 'MODULE_DEPENDENCY' as const,
									schemaVersion: moduleDependencyGraph.schemaVersion,
									semanticExtractionVersion: moduleDependencyGraph.semanticExtractionVersion,
									semanticSchemaVersion: moduleDependencyGraph.semanticSchemaVersion,
									semanticSnapshotId: moduleDependencyGraph.semanticSnapshotId,
									subjectId: moduleDependencyGraph.subjectId
								},
								{
									canonicalProfile: callGraph.canonicalProfile,
									contentDigest: callGraph.contentDigest,
									graphId: callGraph.id,
									graphInputDigest: callGraph.graphInputDigest,
									graphKind: callGraph.graphKind,
									layerId: callGraph.layers[0].id,
									method: callGraph.method,
									operationVersion: callGraph.operationVersion,
									ordinal: 1 as const,
									producer: callGraph.producer,
									role: 'CALL' as const,
									schemaVersion: callGraph.schemaVersion,
									semanticExtractionVersion: callGraph.semanticExtractionVersion,
									semanticSchemaVersion: callGraph.semanticSchemaVersion,
									semanticSnapshotId: callGraph.semanticSnapshotId,
									subjectId: callGraph.subjectId
								}
							] as const,
							subjectId: snapshot.subjectId
						},
						semanticSnapshot: snapshot
					};
					telemetry.start('LOGICAL_GRAPH_COMPOSITION', {
						budgetClassification: 'PROVISIONAL_CALLER_OPERATION_BUDGETS_NOT_PRODUCT_CEILINGS',
						budgets: logicalCompositionBudgets,
						callGraphId: callGraph.id,
						moduleDependencyGraphId: moduleDependencyGraph.id
					});
					const compositionOutcome = buildLogicalGraphComposition(logicalCompositionInputs, {
						onProgress(event) {
							process.stdout.write(`${JSON.stringify(event)}\n`);
						}
					});
					expect(compositionOutcome.outcome, JSON.stringify(compositionOutcome.diagnostics)).toBe(
						'partial'
					);
					if (compositionOutcome.outcome !== 'partial')
						throw new Error(JSON.stringify(compositionOutcome));
					const composition = compositionOutcome.composition;
					if (SMOKE_SUITE === 'LOGICAL_GRAPH_COMPOSITION_ONLY') {
						expect(snapshot.sources).toHaveLength(2_532);
						expect(snapshot.invocations).toHaveLength(26_214);
						expect(moduleDependencyGraph.nodes).toHaveLength(2_591);
						expect(moduleDependencyGraph.edges).toHaveLength(1_157);
						expect(callGraph.nodes).toHaveLength(51_319);
						expect(callGraph.edges).toHaveLength(52_428);
						expect(callGraph.coverage).toMatchObject({
							candidateSetCallSites: 8_625,
							externalDispatchCallSites: 11_538,
							representedCallSites: 26_214,
							targetEdges: 26_214,
							unresolvedCallSites: 0,
							unsupportedCallSites: 6_051
						});
						expect(composition.coverage).toEqual({
							callEligibleSourceRegions: 2_532,
							callInputEdges: 52_428,
							callInputNodes: 51_319,
							callPopulationReconciles: true,
							chargedInputTraversalSteps: 112_559,
							conflictingSemanticSources: 0,
							crossLinks: 2_532,
							exactSemanticSourceIdCandidates: 2_532,
							linkedSemanticSources: 2_532,
							linkPopulationReconciles: true,
							moduleEligibleSourceNodes: 2_532,
							moduleInputEdges: 1_157,
							moduleInputNodes: 2_591,
							modulePopulationReconciles: true,
							sourceIdentityPopulationReconciles: true,
							unmatchedCallSources: 0,
							unmatchedModuleSources: 0
						});
						expect(composition.inheritedLimitations).toHaveLength(26_907);
					}
					expect(
						validateLogicalGraphComposition(composition, logicalCompositionInputs, {
							maxDepth: 4_096,
							maxInputRecords: logicalCompositionBudgets.maxInputRecords,
							maxInputStringCharacters: logicalCompositionBudgets.maxInputStringCharacters,
							maxIssues: logicalCompositionBudgets.maxDiagnostics,
							maxRecords: logicalCompositionBudgets.maxInputRecords,
							maxStringCharacters: logicalCompositionBudgets.maxInputStringCharacters
						})
					).toEqual({ issues: [], state: 'VALID' });
					expect(composition.coverage).toMatchObject({
						callEligibleSourceRegions: snapshot.sources.length,
						callPopulationReconciles: true,
						conflictingSemanticSources: 0,
						crossLinks: snapshot.sources.length,
						exactSemanticSourceIdCandidates: snapshot.sources.length,
						linkedSemanticSources: snapshot.sources.length,
						linkPopulationReconciles: true,
						moduleEligibleSourceNodes: snapshot.sources.length,
						modulePopulationReconciles: true,
						sourceIdentityPopulationReconciles: true,
						unmatchedCallSources: 0,
						unmatchedModuleSources: 0
					});
					expect(composition.conflicts).toEqual([]);
					expect(composition.unmatchedSources).toEqual([]);
					expect(composition.layers).toHaveLength(2);
					expect(composition.health).toBe('PARTIAL');
					expect(composition.closure).toBe('OPEN');
					expect(composition.graphAuthority).toBe(LOGICAL_GRAPH_COMPOSITION_GRAPH_AUTHORITY);
					expect(composition.authorityTransfer).toBe(LOGICAL_GRAPH_COMPOSITION_AUTHORITY_TRANSFER);
					expect(composition.gateEffect).toBe(LOGICAL_GRAPH_COMPOSITION_GATE_EFFECT);
					expect(composition.freshness).toBe(LOGICAL_GRAPH_COMPOSITION_FRESHNESS);
					expect(composition.currentness).toBe(LOGICAL_GRAPH_COMPOSITION_CURRENTNESS);
					expect(composition.fullJanCsaa009Conformance).toBe(
						LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_009_CONFORMANCE
					);
					expect(composition.fullJanCsaa007Conformance).toBe(
						LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_007_CONFORMANCE
					);
					expect(composition.fullJanCsaa008Conformance).toBe(
						LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_008_CONFORMANCE
					);
					expect(composition.nonclaims).toEqual(LOGICAL_GRAPH_COMPOSITION_NONCLAIMS);
					const compositionWitness = canonicalSemanticJsonWitness(composition);
					telemetry.complete({
						bytes: compositionWitness.bytes,
						conflicts: composition.conflicts.length,
						crossLinks: composition.crossLinks.length,
						inheritedLimitations: composition.inheritedLimitations.length,
						unmatchedSources: composition.unmatchedSources.length,
						validationState: 'VALID'
					});
					logicalGraphCompositionResult = {
						bytes: compositionWitness.bytes,
						callInputEdges: composition.coverage.callInputEdges,
						callInputNodes: composition.coverage.callInputNodes,
						closure: composition.closure,
						conflicts: composition.conflicts.length,
						contentDigest: composition.contentDigest,
						crossLinks: composition.crossLinks.length,
						durationMs: Math.max(0, Math.round(performance.now() - logicalCompositionStartedAt)),
						id: composition.id,
						inheritedLimitations: composition.inheritedLimitations.length,
						inputDigest: composition.inputDigest,
						moduleInputEdges: composition.coverage.moduleInputEdges,
						moduleInputNodes: composition.coverage.moduleInputNodes,
						sha256: compositionWitness.sha256,
						unmatchedSources: composition.unmatchedSources.length
					};
				} else
					telemetry.skip('LOGICAL_GRAPH_COMPOSITION', {
						reason: 'The selected smoke suite does not request logical graph composition.',
						reasonCode: 'SUITE_PHASE_NOT_REQUESTED'
					});
				if (SMOKE_PROJECTION_PLAN.terminateAfterLogicalGraphComposition) {
					if (
						moduleDependencyGraphResult === null ||
						callGraphResult === null ||
						logicalGraphCompositionResult === null
					)
						throw new Error(
							'LOGICAL_GRAPH_COMPOSITION_ONLY cannot complete without validated module, call, and composition evidence.'
						);
					for (const phase of LOGICAL_GRAPH_COMPOSITION_ONLY_DOWNSTREAM_SKIPPED_PHASES)
						telemetry.skip(phase, {
							reason:
								'The logical-graph-composition-only suite terminates after validated two-layer composition evidence.',
							reasonCode: 'SUITE_PHASE_NOT_REQUESTED'
						});
					const phaseDurationsMs = telemetry.phaseDurationsMs();
					const skippedPhases = telemetry.skippedPhases();
					const completedPhases = Object.keys(phaseDurationsMs);
					expect(completedPhases).toEqual(LOGICAL_GRAPH_COMPOSITION_ONLY_COMPLETED_PHASES);
					expect(skippedPhases).toEqual(LOGICAL_GRAPH_COMPOSITION_ONLY_EXPECTED_SKIPPED_PHASES);
					telemetry.finish({
						completedPhases,
						commandEventContractStaticOverlay: false,
						commandDispatchStaticTopology: false,
						commandHandlerStaticProjection: false,
						conditionalExportResolved: false,
						guardClassificationStaticOverlay: false,
						guardEnforcementLedgerObserved: false,
						logicalGraphComposed: true,
						moduleResolutionTraced: false,
						projectContextProjected: projectContextGraphResult !== null,
						projects: snapshot.projects.length,
						semanticSnapshotOutcome: outcome.outcome,
						semanticProfile: SMOKE_PROFILE,
						skippedPhases,
						smokeSuite: SMOKE_SUITE,
						sources: snapshot.sources.length,
						stateMachineProjected: false,
						structuralModuleReachabilityAnalyzed: false,
						structuralSccAnalyzed: false,
						terminalPhase: 'LOGICAL_GRAPH_COMPOSITION'
					});
					process.stdout.write(
						`${JSON.stringify({
							arrowCommandCensus: null,
							callGraph: callGraphResult,
							completedPhases,
							commandEventContractStaticOverlay: null,
							commandDispatchStaticTopology: null,
							commandHandlerStaticProjection: null,
							conditionalExportResolution: null,
							declarationContextAnalysis: declarationContextAnalysisResult,
							dependencyProviderComparison: null,
							event: 'CSAA_REPOSITORY_SMOKE_RESULT',
							exactSubjectReuse: null,
							guardClassificationStaticOverlay: null,
							guardEnforcementLedger: null,
							logicalGraphComposition: logicalGraphCompositionResult,
							projectContextGraph: projectContextGraphResult,
							moduleDependencyGraph: moduleDependencyGraphResult,
							moduleResolutionTrace: null,
							phaseDurationsMs,
							projectCount: snapshot.projects.length,
							readWriteAccessGraph: null,
							selectedSubjectArtifactBytes: subjectArtifactBytes,
							selectedSubjectArtifactCount: subject.artifacts.length,
							selectedSubjectId: subject.descriptor.subjectId,
							selector: SMOKE_SELECTOR ?? null,
							semanticPipelineDurationMs,
							semanticProfile: SMOKE_PROFILE,
							semanticSnapshotMemoryHighWaterBytes: semanticMemoryHighWaterBytes,
							semanticSnapshotOutcome: outcome.outcome,
							semanticSnapshotPhaseDurationsMs: semanticPhaseDurationsMs,
							semanticSnapshotProgressEvents: semanticProgressEvents.length,
							semanticSnapshotWitness,
							skippedPhases,
							smokeSuite: SMOKE_SUITE,
							sourceCount: snapshot.sources.length,
							stateMachine: null,
							structuralModuleReachabilityAnalysis: null,
							structuralSccAnalysis: null,
							terminalPhase: 'LOGICAL_GRAPH_COMPOSITION'
						})}\n`
					);
					return;
				}
				let readWriteAccessGraphResult: null | {
					readonly accesses: number;
					readonly bytes: number;
					readonly durationMs: number;
					readonly edges: number;
					readonly frontiers: number;
					readonly id: string;
					readonly nodes: number;
					readonly reads: number;
					readonly readWrites: number;
					readonly sha256: string;
					readonly symbolSlots: number;
					readonly writes: number;
				} = null;
				if (SMOKE_PROJECTION_PLAN.runReadWriteAccessGraph) {
					const readWriteAccessGraphStartedAt = performance.now();
					const readWriteAccessMaxAccesses = Math.max(
						1,
						snapshot.references.length + snapshot.declarations.length
					);
					const readWriteAccessMaxFrontiers = Math.max(
						1,
						snapshot.references.length + snapshot.assignments.length
					);
					const readWriteAccessBudgets = {
						maxAccesses: readWriteAccessMaxAccesses,
						maxEdges: Math.max(1, readWriteAccessMaxAccesses * 2),
						maxFrontiers: readWriteAccessMaxFrontiers,
						maxNodes: Math.max(1, readWriteAccessMaxAccesses * 2 + readWriteAccessMaxFrontiers)
					};
					telemetry.start('READ_WRITE_ACCESS_GRAPH', {
						assignments: snapshot.assignments.length,
						budgets: readWriteAccessBudgets,
						declarations: snapshot.declarations.length,
						references: snapshot.references.length,
						symbols: snapshot.symbols.length
					});
					const readWriteAccessOutcome = buildReadWriteAccessGraph(
						{
							budgets: readWriteAccessBudgets,
							operationVersion: READ_WRITE_ACCESS_GRAPH_OPERATION_VERSION,
							schemaVersion: READ_WRITE_ACCESS_GRAPH_REQUEST_SCHEMA_VERSION,
							semanticSnapshotId: snapshot.id,
							subjectId: snapshot.subjectId
						},
						snapshot
					);
					expect(
						readWriteAccessOutcome.outcome,
						JSON.stringify(readWriteAccessOutcome.diagnostics)
					).toBe('partial');
					if (readWriteAccessOutcome.outcome === 'unavailable')
						throw new Error(JSON.stringify(readWriteAccessOutcome));
					const readWriteAccessGraph = readWriteAccessOutcome.graph;
					expect(
						validateReadWriteAccessGraph(readWriteAccessGraph, snapshot, {
							maxIssues: 100_000,
							maxRecords: snapshot.budgets.maxSnapshotBytes,
							maxStringCharacters: snapshot.budgets.maxSnapshotBytes
						})
					).toEqual({
						issues: [],
						state: 'VALID'
					});
					expect(readWriteAccessGraph.coverage.reconciles).toBe(true);
					expect(readWriteAccessGraph.coverage.closure).toBe('OPEN');
					expect(readWriteAccessGraph.fullJanCsaaCapability007DataFlow).toBe(
						FULL_JAN_CSAA_CAPABILITY_007_DATA_FLOW
					);
					const readWriteAccessGraphWitness = canonicalSemanticJsonWitness(readWriteAccessGraph);
					telemetry.complete({
						accesses: readWriteAccessGraph.coverage.accessOccurrences,
						bytes: readWriteAccessGraphWitness.bytes,
						edges: readWriteAccessGraph.edges.length,
						frontiers: readWriteAccessGraph.coverage.frontierNodes,
						nodes: readWriteAccessGraph.nodes.length,
						outcome: readWriteAccessOutcome.outcome,
						reads: readWriteAccessGraph.coverage.readAccesses,
						readWrites: readWriteAccessGraph.coverage.readWriteAccesses,
						symbolSlots: readWriteAccessGraph.coverage.symbolSlots,
						validationState: 'VALID',
						writes: readWriteAccessGraph.coverage.writeAccesses
					});
					readWriteAccessGraphResult = {
						accesses: readWriteAccessGraph.coverage.accessOccurrences,
						bytes: readWriteAccessGraphWitness.bytes,
						durationMs: Math.max(0, Math.round(performance.now() - readWriteAccessGraphStartedAt)),
						edges: readWriteAccessGraph.edges.length,
						frontiers: readWriteAccessGraph.coverage.frontierNodes,
						id: readWriteAccessGraph.id,
						nodes: readWriteAccessGraph.nodes.length,
						reads: readWriteAccessGraph.coverage.readAccesses,
						readWrites: readWriteAccessGraph.coverage.readWriteAccesses,
						sha256: readWriteAccessGraphWitness.sha256,
						symbolSlots: readWriteAccessGraph.coverage.symbolSlots,
						writes: readWriteAccessGraph.coverage.writeAccesses
					};
				} else
					telemetry.skip('READ_WRITE_ACCESS_GRAPH', {
						reason: 'The selected smoke suite does not request the read/write-access projection.',
						reasonCode: 'SUITE_PHASE_NOT_REQUESTED'
					});
				const stateMachineArtifact = subject.artifacts.find(
					(artifact) => artifact.path === 'packages/rph-domain/src/transitions.data.ts'
				);
				let stateMachineResult: null | {
					readonly bytes: number;
					readonly crossAxisRules: number;
					readonly durationMs: number;
					readonly edges: number;
					readonly machines: number;
					readonly nodes: number;
					readonly states: number;
					readonly transitions: number;
				} = null;
				let stateMachineProjection: null | {
					readonly graph: StateMachineGraphSnapshot;
					readonly observation: StateMachineTopologyObservation;
					readonly request: BuildStateMachineGraphRequest;
				} = null;
				if (!SMOKE_PROJECTION_PLAN.runStateMachineProjection) {
					const skipDetails = {
						reason: 'The selected smoke suite does not request state-machine projection.',
						reasonCode: 'SUITE_PHASE_NOT_REQUESTED'
					};
					telemetry.skip('STATE_MACHINE_TOPOLOGY_OBSERVATION', skipDetails);
					telemetry.skip('STATE_MACHINE_GRAPH_PROJECTION', skipDetails);
				} else if (stateMachineArtifact !== undefined) {
					const stateMachineStartedAt = performance.now();
					const populationBudget = Math.max(1, stateMachineArtifact.bytes);
					telemetry.start('STATE_MACHINE_TOPOLOGY_OBSERVATION', {
						artifactBytes: stateMachineArtifact.bytes,
						artifactPath: stateMachineArtifact.path
					});
					const observationOutcome = observeStateMachineTopology(
						{
							artifact: {
								bytes: stateMachineArtifact.bytes,
								canonicalPathKey: stateMachineArtifact.canonicalPathKey,
								disposition: 'ANALYZED',
								path: stateMachineArtifact.path,
								primaryClass: stateMachineArtifact.primaryClass,
								roles: stateMachineArtifact.roles,
								sha256: stateMachineArtifact.sha256
							},
							budgets: {
								maxAstNodes: Math.max(1, stateMachineArtifact.bytes * 2),
								maxCrossAxisRules: populationBudget,
								maxDiagnostics: populationBudget,
								maxMachines: populationBudget,
								maxSourceBytes: populationBudget,
								maxStates: populationBudget,
								maxTextCharacters: Math.max(1, stateMachineArtifact.bytes * 2),
								maxTransitions: populationBudget
							},
							operationVersion: STATE_MACHINE_TOPOLOGY_OBSERVATION_OPERATION_VERSION,
							schemaVersion: STATE_MACHINE_TOPOLOGY_OBSERVATION_REQUEST_SCHEMA_VERSION,
							subjectId: subject.descriptor.subjectId
						},
						{ subject }
					);
					expect(observationOutcome.outcome, JSON.stringify(observationOutcome)).toBe('complete');
					if (observationOutcome.outcome !== 'complete')
						throw new Error(JSON.stringify(observationOutcome));
					const observation = observationOutcome.observation;
					expect(validateStateMachineTopologyObservation(observation, subject)).toEqual({
						issues: [],
						state: 'VALID'
					});
					telemetry.complete({
						crossAxisRules: observation.crossAxisRules.length,
						explicitlyIllegalTransitions: observation.explicitlyIllegalTransitions.length,
						guardedDeclarations: observation.guardedTransitions.length,
						legalTransitions: observation.legalTransitions.length,
						machines: observation.machines.length,
						states: observation.states.length,
						validationState: 'VALID'
					});
					const matchingSources = snapshot.sources.filter(
						(source) =>
							source.logicalPath === stateMachineArtifact.path &&
							snapshot.projects.find((project) => project.id === source.projectId)?.configPath ===
								'packages/rph-domain/tsconfig.json'
					);
					expect(matchingSources).toHaveLength(1);
					const stateMachineSource = matchingSources[0]!;
					const guardedLegalTransitionCount = new Set(
						observation.guardedTransitions.map((item) => item.legalTransitionId)
					).size;
					const graphRequest = {
						budgets: {
							maxEdges:
								observation.states.length +
								observation.legalTransitions.length +
								observation.guardedTransitions.length -
								guardedLegalTransitionCount +
								observation.explicitlyIllegalTransitions.length +
								observation.crossAxisRules.length,
							maxNodes:
								observation.machines.length +
								observation.states.length +
								observation.crossAxisRules.length
						},
						observationId: observation.id,
						operationVersion: STATE_MACHINE_GRAPH_OPERATION_VERSION,
						schemaVersion: STATE_MACHINE_GRAPH_REQUEST_SCHEMA_VERSION,
						semanticSnapshotId: snapshot.id,
						source: {
							logicalPath: stateMachineSource.logicalPath,
							programId: stateMachineSource.programId,
							projectId: stateMachineSource.projectId,
							semanticSourceId: stateMachineSource.id
						},
						subjectId: snapshot.subjectId
					};
					telemetry.start('STATE_MACHINE_GRAPH_PROJECTION', {
						maxEdges: graphRequest.budgets.maxEdges,
						maxNodes: graphRequest.budgets.maxNodes,
						uniqueGuardedLegalTransitions: guardedLegalTransitionCount
					});
					const stateMachineOutcome = buildStateMachineGraph(graphRequest, snapshot, observation);
					expect(stateMachineOutcome.outcome, JSON.stringify(stateMachineOutcome)).toBe('partial');
					if (stateMachineOutcome.outcome !== 'partial')
						throw new Error(JSON.stringify(stateMachineOutcome));
					const stateMachineGraph = stateMachineOutcome.graph;
					expect(
						validateStateMachineGraph(stateMachineGraph, graphRequest, snapshot, observation)
					).toEqual({ issues: [], state: 'VALID' });
					expect(stateMachineGraph.coverage.reconciles).toBe(true);
					expect(stateMachineGraph.fullJanCsaa007Conformance).toBe('NOT_CLAIMED');
					expect(stateMachineGraph.fullJanCsaa008Conformance).toBe('NOT_CLAIMED');
					expect(stateMachineGraph.registryStatus).toBe('IMPLEMENTATION_LOCAL_UNREGISTERED');
					expect(stateMachineGraph.verifierAuthority).toBe('RETAINED_DELEGATED');
					const stateMachineWitness = canonicalSemanticJsonWitness(stateMachineGraph);
					telemetry.complete({
						bytes: stateMachineWitness.bytes,
						edges: stateMachineGraph.edges.length,
						nodes: stateMachineGraph.nodes.length,
						outcome: stateMachineOutcome.outcome,
						validationState: 'VALID'
					});
					stateMachineResult = {
						bytes: stateMachineWitness.bytes,
						crossAxisRules: observation.crossAxisRules.length,
						durationMs: Math.max(0, Math.round(performance.now() - stateMachineStartedAt)),
						edges: stateMachineGraph.edges.length,
						machines: observation.machines.length,
						nodes: stateMachineGraph.nodes.length,
						states: observation.states.length,
						transitions:
							observation.legalTransitions.length + observation.explicitlyIllegalTransitions.length
					};
					stateMachineProjection = {
						graph: stateMachineGraph,
						observation,
						request: graphRequest
					};
				} else {
					const skipDetails = {
						reason:
							'Selected subject does not contain packages/rph-domain/src/transitions.data.ts.',
						reasonCode: 'STATE_MACHINE_ARTIFACT_ABSENT'
					};
					telemetry.skip('STATE_MACHINE_TOPOLOGY_OBSERVATION', skipDetails);
					telemetry.skip('STATE_MACHINE_GRAPH_PROJECTION', skipDetails);
				}

				telemetry.start('ARROW_COMMAND_CENSUS_SUBJECT_SELECTION', {
					reusedRepositoryPreflight:
						SELECTED_PROJECTS !== null && !USE_COMMON_COMMAND_HANDLER_SUBJECT,
					reusedSelectedSubject: SELECTED_PROJECTS === null || USE_COMMON_COMMAND_HANDLER_SUBJECT,
					scope: USE_COMMON_COMMAND_HANDLER_SUBJECT
						? 'EXPLICIT_PROJECTS_WITH_AUXILIARY_EVIDENCE'
						: 'REPOSITORY'
				});
				let arrowSubject = subject;
				if (SELECTED_PROJECTS !== null && !USE_COMMON_COMMAND_HANDLER_SUBJECT) {
					if (repositorySubjectOutcome?.outcome !== 'resolved')
						throw new Error(
							'Repository preflight subject is unavailable for arrow-command census.'
						);
					arrowSubject = repositorySubjectOutcome.subject;
				}
				if (SMOKE_SUITE === 'COMMAND_HANDLER_ONLY') {
					expect(arrowSubject).toBe(subject);
					expect(arrowSubject.descriptor.subjectId).toBe(snapshot.subjectId);
				}
				const arrowSubjectBytes = arrowSubject.artifacts.reduce(
					(total, artifact) => total + artifact.bytes,
					0
				);
				telemetry.complete({
					artifactBytes: arrowSubjectBytes,
					artifacts: arrowSubject.artifacts.length,
					projects: arrowSubject.projects.length,
					reusedSelectedSubject: SELECTED_PROJECTS === null || USE_COMMON_COMMAND_HANDLER_SUBJECT,
					reusedRepositoryPreflight:
						SELECTED_PROJECTS !== null && !USE_COMMON_COMMAND_HANDLER_SUBJECT,
					subjectId: arrowSubject.descriptor.subjectId
				});

				const artifactSetBudgets = {
					maxArtifacts: arrowSubject.artifacts.length,
					maxDiagnostics: 100_000,
					maxTotalBytes: arrowSubjectBytes
				};
				telemetry.start('ARROW_COMMAND_CENSUS_ARTIFACT_SET_BINDING', {
					budgetClassification: 'CALLER_OPERATION_BUDGETS_NOT_PRODUCT_CEILINGS',
					budgets: artifactSetBudgets,
					operationVersion: ARROW_COMMAND_CENSUS_ARTIFACT_SET_OPERATION_VERSION,
					schemaVersion: ARROW_COMMAND_CENSUS_ARTIFACT_SET_REQUEST_SCHEMA_VERSION
				});
				const artifactSetOutcome = buildArrowCommandCensusArtifactSet(
					{
						budgets: artifactSetBudgets,
						operationVersion: ARROW_COMMAND_CENSUS_ARTIFACT_SET_OPERATION_VERSION,
						schemaVersion: ARROW_COMMAND_CENSUS_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
						subjectId: arrowSubject.descriptor.subjectId
					},
					{ subject: arrowSubject }
				);
				expect(artifactSetOutcome.outcome, JSON.stringify(artifactSetOutcome)).toBe('complete');
				if (artifactSetOutcome.outcome !== 'complete')
					throw new Error(JSON.stringify(artifactSetOutcome));
				const arrowArtifactSet = artifactSetOutcome.artifactSet;
				expect(arrowArtifactSet.subjectId).toBe(arrowSubject.descriptor.subjectId);
				const arrowArtifactBytes = arrowArtifactSet.artifacts.reduce(
					(total, artifact) => total + artifact.bytes,
					0
				);
				telemetry.complete({
					artifactBytes: arrowArtifactBytes,
					artifacts: arrowArtifactSet.coverage.artifacts,
					commandDeclarationArtifacts: arrowArtifactSet.coverage.commandDeclarationArtifacts,
					handlerSourceArtifacts: arrowArtifactSet.coverage.handlerSourceArtifacts,
					packageSourceArtifacts: arrowArtifactSet.coverage.packageSourceArtifacts,
					reconciles: arrowArtifactSet.coverage.reconciles
				});

				const arrowObservationBudgets = {
					maxArtifacts: arrowArtifactSet.artifacts.length,
					maxBirthStates: 1_000_000,
					maxDeclaredArrowOccurrences: 1_000_000,
					maxDeclaredSites: 1_000_000,
					maxDiagnostics: 100_000,
					maxExecutorDurationMs: REPOSITORY_SMOKE_FAILSAFE_PROVIDER_DURATION_MS,
					maxExternalModuleBytes: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES,
					maxExternalModuleFiles: 100_000,
					maxMachines: 100_000,
					maxMapStates: 1_000_000,
					maxMaterializedBytes: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES,
					maxOutputStringCharacters: 100_000_000,
					maxRawArrayEntries: 10_000_000,
					maxRawJsonDepth: 64,
					maxStderrBytes: 100_000_000,
					maxStdoutBytes: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES
				};
				const arrowAdapterPhaseDurationsMs: Record<string, number> = {};
				telemetry.start('ARROW_COMMAND_CENSUS_OBSERVATION', {
					budgetClassification: 'PROVISIONAL_CALLER_OPERATION_BUDGETS_NOT_PRODUCT_CEILINGS',
					budgets: arrowObservationBudgets,
					operationVersion: ARROW_COMMAND_CENSUS_OPERATION_VERSION,
					schemaVersion: ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION
				});
				const arrowOutcome = await observeArrowCommandCensus(
					{
						artifactSetId: arrowArtifactSet.id,
						budgets: arrowObservationBudgets,
						operationVersion: ARROW_COMMAND_CENSUS_OPERATION_VERSION,
						schemaVersion: ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION,
						subjectId: arrowSubject.descriptor.subjectId
					},
					{ artifactSet: arrowArtifactSet, subject: arrowSubject },
					{
						onProgress(event) {
							if (event.durationMs !== undefined && event.state !== 'STARTED')
								arrowAdapterPhaseDurationsMs[event.phase] = event.durationMs;
							process.stdout.write(`${JSON.stringify(event)}\n`);
						}
					}
				);
				expect(['complete', 'partial'], JSON.stringify(arrowOutcome)).toContain(
					arrowOutcome.outcome
				);
				if (arrowOutcome.outcome !== 'complete' && arrowOutcome.outcome !== 'partial')
					throw new Error(JSON.stringify(arrowOutcome));
				const arrowObservation = arrowOutcome.observation;
				expect(arrowObservation.subjectId).toBe(arrowSubject.descriptor.subjectId);
				expect(arrowObservation.artifactSet.id).toBe(arrowArtifactSet.id);
				const externalModuleBytes = arrowObservation.executor.externalModules.reduce(
					(total, module) => total + module.bytes,
					0
				);
				const externalModuleFiles = arrowObservation.executor.externalModules.reduce(
					(total, module) => total + module.files,
					0
				);
				telemetry.complete({
					adapterPhaseDurationsMs: arrowAdapterPhaseDurationsMs,
					baselineMatches: arrowObservation.coverage.baselineMatches,
					coveredInScopeTopologyArrows: arrowObservation.coverage.coveredInScopeTopologyArrows,
					deadCoveredArrows: arrowObservation.coverage.deadCoveredArrows,
					declaredArrowOccurrences: arrowObservation.coverage.declaredArrowOccurrences,
					declaredSites: arrowObservation.coverage.declaredSites,
					diagnostics: arrowOutcome.diagnostics.length,
					externalModuleBytes,
					externalModuleFiles,
					externalModules: arrowObservation.executor.externalModules.length,
					orphanMachines: arrowObservation.coverage.orphanMachines,
					outcome: arrowOutcome.outcome,
					rawOutputBytes: arrowObservation.rawOutput.bytes,
					totalInScopeTopologyArrows: arrowObservation.coverage.totalInScopeTopologyArrows,
					unanalysedMachines: arrowObservation.coverage.unanalysedMachines,
					uncoveredArrows: arrowObservation.coverage.uncoveredArrows
				});

				telemetry.start('ARROW_COMMAND_CENSUS_VALIDATE_AND_SERIALIZE', {
					observationId: arrowObservation.id,
					subjectBound: true
				});
				expect(validateArrowCommandCensusObservation(arrowObservation, arrowSubject)).toEqual({
					issues: [],
					state: 'VALID'
				});
				const arrowObservationWitness = canonicalSemanticJsonWitness(arrowObservation);
				telemetry.complete({
					authorityTransfer: arrowObservation.authorityTransfer,
					bytes: arrowObservationWitness.bytes,
					contentDigest: arrowObservation.contentDigest,
					gateEffect: arrowObservation.gateEffect,
					limitations: arrowObservation.limitations.length,
					oracleChange: arrowObservation.oracleChange,
					replacementEquivalence: arrowObservation.replacementEquivalence,
					sha256: arrowObservationWitness.sha256,
					verifierAuthority: arrowObservation.verifierAuthority,
					validationState: 'VALID'
				});

				let guardObservation: GuardEnforcementLedgerObservation | null = null;
				let guardEnforcementLedgerResult: null | {
					readonly artifactBytes: number;
					readonly artifacts: number;
					readonly arrowOccurrences: number;
					readonly classifiedGuardTexts: number;
					readonly durationMs: number;
					readonly ledgerRows: number;
					readonly observationBytes: number;
				} = null;
				if (SMOKE_PROJECTION_PLAN.runGuardClassificationOverlay) {
					const guardLedgerStartedAt = performance.now();
					const guardArtifactSetBudgets = {
						maxArtifacts: subject.artifacts.length,
						maxDiagnostics: 100_000,
						maxTotalBytes: subjectArtifactBytes
					};
					telemetry.start('GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_BINDING', {
						budgetClassification: 'CALLER_OPERATION_BUDGETS_NOT_PRODUCT_CEILINGS',
						budgets: guardArtifactSetBudgets
					});
					const guardArtifactSetOutcome = buildGuardEnforcementLedgerArtifactSet(
						{
							budgets: guardArtifactSetBudgets,
							operationVersion: GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_OPERATION_VERSION,
							schemaVersion: GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
							subjectId: subject.descriptor.subjectId
						},
						{ subject }
					);
					expect(guardArtifactSetOutcome.outcome, JSON.stringify(guardArtifactSetOutcome)).toBe(
						'complete'
					);
					if (guardArtifactSetOutcome.outcome !== 'complete')
						throw new Error(JSON.stringify(guardArtifactSetOutcome));
					const guardArtifactSet = guardArtifactSetOutcome.artifactSet;
					const guardArtifactBytes = guardArtifactSet.artifacts.reduce(
						(total, artifact) => total + artifact.bytes,
						0
					);
					telemetry.complete({
						artifactBytes: guardArtifactBytes,
						artifacts: guardArtifactSet.artifacts.length,
						reconciles: guardArtifactSet.coverage.reconciles
					});
					const guardObservationBudgets = {
						maxArtifacts: guardArtifactSet.artifacts.length,
						maxAuditEntries: 1_000_000,
						maxDiagnostics: 100_000,
						maxExecutorDurationMs: REPOSITORY_SMOKE_FAILSAFE_PROVIDER_DURATION_MS,
						maxExternalModuleBytes: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES,
						maxExternalModuleFiles: 100_000,
						maxGuardedArrows: 1_000_000,
						maxGuardTexts: 1_000_000,
						maxLedgerRows: 1_000_000,
						maxMaterializedBytes: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES,
						maxOutputStringCharacters: 100_000_000,
						maxRawArrayEntries: 10_000_000,
						maxRawJsonDepth: 64,
						maxStderrBytes: 100_000_000,
						maxStdoutBytes: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES
					};
					const guardAdapterPhaseDurationsMs: Record<string, number> = {};
					telemetry.start('GUARD_ENFORCEMENT_LEDGER_OBSERVATION', {
						budgetClassification: 'PROVISIONAL_CALLER_OPERATION_BUDGETS_NOT_PRODUCT_CEILINGS',
						budgets: guardObservationBudgets
					});
					const guardOutcome = await observeGuardEnforcementLedger(
						{
							artifactSetId: guardArtifactSet.id,
							budgets: guardObservationBudgets,
							operationVersion: GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
							schemaVersion: GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
							subjectId: subject.descriptor.subjectId
						},
						{ artifactSet: guardArtifactSet, subject },
						{
							onProgress(event) {
								if (event.durationMs !== undefined && event.state !== 'STARTED')
									guardAdapterPhaseDurationsMs[event.phase] = event.durationMs;
								process.stdout.write(`${JSON.stringify(event)}\n`);
							}
						}
					);
					expect(['complete', 'partial'], JSON.stringify(guardOutcome)).toContain(
						guardOutcome.outcome
					);
					if (guardOutcome.outcome === 'unavailable') throw new Error(JSON.stringify(guardOutcome));
					guardObservation = guardOutcome.observation;
					telemetry.complete({
						adapterPhaseDurationsMs: guardAdapterPhaseDurationsMs,
						arrowOccurrences: guardObservation.coverage.arrowOccurrences,
						classifiedGuardTexts: guardObservation.coverage.classifiedGuardTexts,
						ledgerRows: guardObservation.coverage.ledgerRows,
						outcome: guardOutcome.outcome
					});
					telemetry.start('GUARD_ENFORCEMENT_LEDGER_VALIDATE_AND_SERIALIZE', {
						observationId: guardObservation.id,
						subjectBound: true
					});
					expect(validateGuardEnforcementLedgerObservation(guardObservation, subject)).toEqual({
						issues: [],
						state: 'VALID'
					});
					const guardObservationWitness = canonicalSemanticJsonWitness(guardObservation);
					telemetry.complete({
						bytes: guardObservationWitness.bytes,
						contentDigest: guardObservation.contentDigest,
						runtimeEnforcement: guardObservation.runtimeEnforcement,
						validationState: 'VALID',
						verifierAuthority: guardObservation.verifierAuthority
					});
					guardEnforcementLedgerResult = {
						artifactBytes: guardArtifactBytes,
						artifacts: guardArtifactSet.artifacts.length,
						arrowOccurrences: guardObservation.coverage.arrowOccurrences,
						classifiedGuardTexts: guardObservation.coverage.classifiedGuardTexts,
						durationMs: Math.max(0, Math.round(performance.now() - guardLedgerStartedAt)),
						ledgerRows: guardObservation.coverage.ledgerRows,
						observationBytes: guardObservationWitness.bytes
					};
				} else {
					const skipDetails = {
						reason: 'The selected smoke suite does not request the guard-classification overlay.',
						reasonCode: 'SUITE_PHASE_NOT_REQUESTED'
					};
					telemetry.skip('GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_BINDING', skipDetails);
					telemetry.skip('GUARD_ENFORCEMENT_LEDGER_OBSERVATION', skipDetails);
					telemetry.skip('GUARD_ENFORCEMENT_LEDGER_VALIDATE_AND_SERIALIZE', skipDetails);
				}

				let commandHandlerResult: null | {
					readonly bytes: number;
					readonly candidateEdges: number;
					readonly commandRegistryEntries: number;
					readonly durationMs: number;
					readonly edges: number;
					readonly frontiers: number;
					readonly handlerRegistryEntries: number;
					readonly nodes: number;
				} = null;
				let commandEventContractOverlayResult: null | {
					readonly additionalDeclaredLinks: number;
					readonly boundContributions: number;
					readonly boundDistinctEvents: number;
					readonly bytes: number;
					readonly commands: number;
					readonly declaredLinks: number;
					readonly durationMs: number;
					readonly eventContracts: number;
					readonly frontiers: number;
					readonly pinnedEmissions: number;
					readonly primaryDeclaredLinks: number;
					readonly retainedCensusBytes: number;
				} = null;
				let commandDispatchTopologyResult: null | {
					readonly bytes: number;
					readonly candidateEdges: number;
					readonly durationMs: number;
					readonly nodes: number;
					readonly pipelineFacts: number;
					readonly retainedCensusBytes: number;
				} = null;
				let guardClassificationOverlayResult: null | {
					readonly anchorSites: number;
					readonly bytes: number;
					readonly candidateHandlerLinks: number;
					readonly classifications: number;
					readonly commandEvidenceLinks: number;
					readonly directHandlerLinks: number;
					readonly durationMs: number;
					readonly frontiers: number;
					readonly occurrences: number;
					readonly stateEvidenceRefs: number;
				} = null;
				if (snapshot.subjectId === arrowObservation.subjectId) {
					const commandHandlerStartedAt = performance.now();
					const registrySelectors = selectJpwbCommandHandlerRegistries(snapshot);
					const commandHandlerBudgets = {
						maxAstNodes: Math.max(1, snapshot.astNodes.length),
						maxCommandRegistryEntries: Math.max(1, snapshot.declarations.length),
						maxEdges: Math.max(
							1,
							snapshot.declarations.length * 4 + arrowObservation.declaredArrows.length
						),
						maxFrontiers: Math.max(
							1,
							snapshot.declarations.length + arrowObservation.declaredSites.length
						),
						maxHandlerRegistryEntries: Math.max(1, snapshot.declarations.length),
						maxNodes: Math.max(
							1,
							snapshot.declarations.length * 4 +
								arrowObservation.declaredSites.length +
								arrowObservation.declaredArrows.length
						),
						maxSourceBytes: Math.max(1, subjectArtifactBytes)
					};
					const commandHandlerRequest = {
						arrowObservationId: arrowObservation.id,
						budgets: commandHandlerBudgets,
						commandRegistry: registrySelectors.commandRegistry,
						handlerRegistry: registrySelectors.handlerRegistry,
						operationVersion: COMMAND_HANDLER_GRAPH_OPERATION_VERSION,
						schemaVersion: COMMAND_HANDLER_GRAPH_REQUEST_SCHEMA_VERSION,
						semanticSnapshotId: snapshot.id,
						subjectId: snapshot.subjectId
					};
					const commandHandlerPhaseDurationsMs: Record<string, number> = {};
					telemetry.start('COMMAND_HANDLER_STATIC_PROJECTION', {
						budgetClassification: 'PROVISIONAL_CALLER_OPERATION_BUDGETS_NOT_PRODUCT_CEILINGS',
						budgets: commandHandlerBudgets,
						declaredArrowOccurrences: arrowObservation.declaredArrows.length,
						declaredSites: arrowObservation.declaredSites.length
					});
					const commandHandlerOutcome = buildCommandHandlerGraph(
						commandHandlerRequest,
						snapshot,
						arrowObservation,
						arrowSubject,
						{
							onProgress(event) {
								if (event.state !== 'STARTED')
									commandHandlerPhaseDurationsMs[event.phase] = event.durationMs;
								process.stdout.write(`${JSON.stringify(event)}\n`);
							}
						}
					);
					expect(
						commandHandlerOutcome.outcome,
						JSON.stringify(commandHandlerOutcome.diagnostics)
					).toBe('partial');
					if (commandHandlerOutcome.outcome !== 'partial')
						throw new Error(JSON.stringify(commandHandlerOutcome));
					const commandHandlerGraph = commandHandlerOutcome.graph;
					const commandHandlerWitness = canonicalSemanticJsonWitness(commandHandlerGraph);
					expect(
						validateCommandHandlerGraph(
							commandHandlerGraph,
							snapshot,
							arrowObservation,
							arrowSubject,
							{
								maxIssues: 100_000,
								maxRecords: Math.max(1, commandHandlerWitness.bytes),
								maxStringCharacters: Math.max(1, commandHandlerWitness.bytes)
							}
						)
					).toEqual({ issues: [], state: 'VALID' });
					expect(commandHandlerGraph.coverage.reconciles).toBe(true);
					expect(commandHandlerGraph.coverage.commandRegistryClosure).toBe('CLOSED');
					expect(commandHandlerGraph.coverage.discoveredCommandRegistryEntries).toBeGreaterThan(0);
					expect(commandHandlerGraph.coverage.discoveredHandlerRegistryEntries).toBeGreaterThan(0);
					expect(commandHandlerGraph.coverage.missingHandlerRegistrations).toBe(0);
					expect(commandHandlerGraph.coverage.undeclaredHandlerRegistrations).toBe(0);
					expect(commandHandlerGraph.coverage.representedCommandRegistryEntries).toBe(
						commandHandlerGraph.coverage.discoveredCommandRegistryEntries
					);
					expect(commandHandlerGraph.coverage.representedHandlerRegistryEntries).toBe(
						commandHandlerGraph.coverage.discoveredHandlerRegistryEntries
					);
					expect(commandHandlerGraph.coverage.representedArrowSites).toBe(
						commandHandlerGraph.coverage.discoveredArrowSites
					);
					expect(commandHandlerGraph.coverage.representedArrowOccurrences).toBe(
						commandHandlerGraph.coverage.discoveredArrowOccurrences
					);
					expect(commandHandlerGraph.runtimeDispatchClosure).toBe('NOT_CLAIMED');
					expect(commandHandlerGraph.runtimePerformability).toBe('NOT_CLAIMED');
					telemetry.complete({
						adapterPhaseDurationsMs: commandHandlerPhaseDurationsMs,
						bytes: commandHandlerWitness.bytes,
						candidateEdges: commandHandlerGraph.coverage.candidateEdges,
						commandRegistryClosure: commandHandlerGraph.coverage.commandRegistryClosure,
						commandRegistryEntries: commandHandlerGraph.coverage.discoveredCommandRegistryEntries,
						edges: commandHandlerGraph.edges.length,
						frontiers: commandHandlerGraph.coverage.frontierNodes,
						handlerRegistryEntries: commandHandlerGraph.coverage.discoveredHandlerRegistryEntries,
						nodes: commandHandlerGraph.nodes.length,
						validationState: 'VALID'
					});
					commandHandlerResult = {
						bytes: commandHandlerWitness.bytes,
						candidateEdges: commandHandlerGraph.coverage.candidateEdges,
						commandRegistryEntries: commandHandlerGraph.coverage.discoveredCommandRegistryEntries,
						durationMs: Math.max(0, Math.round(performance.now() - commandHandlerStartedAt)),
						edges: commandHandlerGraph.edges.length,
						frontiers: commandHandlerGraph.coverage.frontierNodes,
						handlerRegistryEntries: commandHandlerGraph.coverage.discoveredHandlerRegistryEntries,
						nodes: commandHandlerGraph.nodes.length
					};

					if (SMOKE_PROJECTION_PLAN.runCommandEventContractOverlay) {
						const commandEventStartedAt = performance.now();
						const commandEventSelection = selectJpwbCommandEventContractOverlayInputs(
							snapshot,
							subject
						);
						const commandEventBudgets = {
							maxAstNodes: Math.max(1, snapshot.astNodes.length),
							maxBoundContributions: Math.max(1, snapshot.astNodes.length),
							maxCommands: Math.max(1, snapshot.declarations.length),
							maxDeclaredLinks: Math.max(1, snapshot.astNodes.length),
							maxDiagnostics: 100_000,
							maxEventContracts: Math.max(1, snapshot.declarations.length),
							maxFrontiers: Math.max(1, snapshot.astNodes.length),
							maxPinnedEmissions: Math.max(1, snapshot.declarations.length),
							maxSourceBytes: Math.max(1, subjectArtifactBytes)
						};
						const { retainedCensusArtifact, vocabArtifact } = commandEventSelection;
						const commandEventRequest = {
							arrowObservationId: arrowObservation.id,
							budgets: commandEventBudgets,
							commandHandlerGraphId: commandHandlerGraph.id,
							commandRegistry: commandEventSelection.commandRegistry,
							eventRegistry: commandEventSelection.eventRegistry,
							operationVersion: COMMAND_EVENT_CONTRACT_OVERLAY_OPERATION_VERSION,
							retainedCensusArtifact,
							schemaVersion: COMMAND_EVENT_CONTRACT_OVERLAY_REQUEST_SCHEMA_VERSION,
							semanticSnapshotId: snapshot.id,
							subjectId: snapshot.subjectId,
							vocabArtifact
						};
						const commandEventInputs = {
							arrowObservation,
							commandHandlerGraph,
							commandHandlerRequest,
							request: commandEventRequest,
							semanticSnapshot: snapshot,
							subject
						};
						telemetry.start('COMMAND_EVENT_CONTRACT_STATIC_OVERLAY', {
							budgetClassification: 'PROVISIONAL_CALLER_OPERATION_BUDGETS_NOT_PRODUCT_CEILINGS',
							budgets: commandEventBudgets,
							predecessorGraphId: commandHandlerGraph.id,
							retainedCensusArtifact: retainedCensusArtifact.artifactPath,
							vocabArtifact: vocabArtifact.artifactPath
						});
						const commandEventOutcome = buildCommandEventContractOverlay(commandEventInputs, {
							onProgress(event) {
								process.stdout.write(`${JSON.stringify(event)}\n`);
							}
						});
						expect(
							commandEventOutcome.outcome,
							JSON.stringify(commandEventOutcome.diagnostics)
						).toBe('partial');
						if (commandEventOutcome.outcome !== 'partial')
							throw new Error(JSON.stringify(commandEventOutcome));
						const commandEventOverlay = commandEventOutcome.overlay;
						expect(
							validateCommandEventContractOverlay(commandEventOverlay, commandEventInputs, {
								maxInputRecords: 10_000_000,
								maxInputStringCharacters: 1_000_000_000,
								maxIssues: 100_000,
								maxRecords: 10_000_000,
								maxStringCharacters: 1_000_000_000
							})
						).toEqual({ issues: [], state: 'VALID' });
						expect(commandEventOverlay.coverage).toEqual({
							additionalDeclaredLinks: 4,
							boundContributions: 179,
							boundDistinctEvents: 104,
							boundRepeatedContributions: 75,
							commandDeclaredDistinctEvents: 104,
							commandDeclaredLinks: 104,
							commands: 100,
							commandsWithoutTransitionBinding: 25,
							declaredNeitherBoundNorPinned: 33,
							eventContracts: 142,
							frontiers: 63,
							generatedBoundSetDifferences: 0,
							missingEventContracts: 0,
							pinnedEmissions: 109,
							pinnedEmittedNotBound: 5,
							primaryDeclaredLinks: 100,
							reconciles: true,
							retainedBoundNotPinnedEmitted: 0
						});
						expect(commandEventOverlay.layers[1]).toMatchObject({
							boundContributionIds: [],
							capability: 'JAN-CSAA-CAP-028',
							commandIds: [],
							declaredLinkIds: [],
							eventIds: [],
							frontierIds: [],
							kind: 'JPWB_COMMAND_EVENT_CONTRACT_INFERENCE',
							pinnedEmissionIds: []
						});
						expect(commandEventOverlay.retainedCensus).toMatchObject({
							artifactPath: COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH,
							authorityTransfer: 'NONE',
							execution: 'NOT_EXECUTED_BY_CSAA',
							gateEffect: 'NONE',
							integration: 'NOT_INTEGRATED',
							oracleChange: 'NONE',
							replacementEquivalence: 'NOT_CLAIMED',
							verifierAuthority: 'RETAINED_DELEGATED'
						});
						expect(commandEventOverlay.vocabArtifact.artifactPath).toBe(
							COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH
						);
						expect(commandEventOverlay.health).toBe('PARTIAL');
						expect(commandEventOverlay.runtimeEmission).toBe('NOT_CLAIMED');
						expect(commandEventOverlay.runtimePerformability).toBe('NOT_CLAIMED');
						expect(commandEventOverlay.fullJanCsaa007Conformance).toBe('NOT_CLAIMED');
						expect(commandEventOverlay.fullJanCsaa008Conformance).toBe('NOT_CLAIMED');
						const commandEventWitness = canonicalSemanticJsonWitness(commandEventOverlay);
						telemetry.complete({
							additionalDeclaredLinks: commandEventOverlay.coverage.additionalDeclaredLinks,
							boundContributions: commandEventOverlay.coverage.boundContributions,
							boundDistinctEvents: commandEventOverlay.coverage.boundDistinctEvents,
							bytes: commandEventWitness.bytes,
							commands: commandEventOverlay.coverage.commands,
							declaredLinks: commandEventOverlay.coverage.commandDeclaredLinks,
							eventContracts: commandEventOverlay.coverage.eventContracts,
							frontiers: commandEventOverlay.coverage.frontiers,
							pinnedEmissions: commandEventOverlay.coverage.pinnedEmissions,
							primaryDeclaredLinks: commandEventOverlay.coverage.primaryDeclaredLinks,
							retainedCensusBytes: commandEventOverlay.retainedCensus.artifactBytes,
							validationState: 'VALID'
						});
						commandEventContractOverlayResult = {
							additionalDeclaredLinks: commandEventOverlay.coverage.additionalDeclaredLinks,
							boundContributions: commandEventOverlay.coverage.boundContributions,
							boundDistinctEvents: commandEventOverlay.coverage.boundDistinctEvents,
							bytes: commandEventWitness.bytes,
							commands: commandEventOverlay.coverage.commands,
							declaredLinks: commandEventOverlay.coverage.commandDeclaredLinks,
							durationMs: Math.max(0, Math.round(performance.now() - commandEventStartedAt)),
							eventContracts: commandEventOverlay.coverage.eventContracts,
							frontiers: commandEventOverlay.coverage.frontiers,
							pinnedEmissions: commandEventOverlay.coverage.pinnedEmissions,
							primaryDeclaredLinks: commandEventOverlay.coverage.primaryDeclaredLinks,
							retainedCensusBytes: commandEventOverlay.retainedCensus.artifactBytes
						};
					} else
						telemetry.skip('COMMAND_EVENT_CONTRACT_STATIC_OVERLAY', {
							reason:
								'The selected smoke suite does not request the command-event-contract overlay.',
							reasonCode: 'SUITE_PHASE_NOT_REQUESTED'
						});

					if (SMOKE_PROJECTION_PLAN.runGuardClassificationOverlay) {
						if (guardObservation === null || stateMachineProjection === null)
							throw new Error(
								'The guard-classification overlay requires validated guard and state-machine predecessors.'
							);
						const guardOverlayStartedAt = performance.now();
						const guardOverlayBudgets = {
							maxAnchorSites: Math.max(1, guardObservation.guards.length),
							maxAstNodes: Math.max(1, snapshot.astNodes.length),
							maxCommandEvidenceLinks: Math.max(
								1,
								guardObservation.guardedArrows.length *
									Math.max(1, arrowObservation.declaredArrows.length)
							),
							maxDiagnostics: 100_000,
							maxFrontiers: Math.max(
								1,
								guardObservation.guardedArrows.length + guardObservation.guards.length * 2
							),
							maxGuardOccurrences: Math.max(1, guardObservation.guardedArrows.length),
							maxGuardRecords: Math.max(1, guardObservation.guards.length),
							maxHandlerLinks: Math.max(
								1,
								guardObservation.guards.length * Math.max(1, commandHandlerGraph.nodes.length)
							),
							maxSourceBytes: Math.max(1, subjectArtifactBytes),
							maxStateEvidenceRefs: Math.max(
								1,
								guardObservation.guardedArrows.length *
									Math.max(1, stateMachineProjection.graph.edges.length)
							)
						};
						const guardOverlayRequest = {
							arrowObservationId: arrowObservation.id,
							budgets: guardOverlayBudgets,
							commandHandlerGraphId: commandHandlerGraph.id,
							guardObservationId: guardObservation.id,
							operationVersion: GUARD_CLASSIFICATION_OVERLAY_OPERATION_VERSION,
							schemaVersion: GUARD_CLASSIFICATION_OVERLAY_REQUEST_SCHEMA_VERSION,
							semanticSnapshotId: snapshot.id,
							stateGraphId: stateMachineProjection.graph.id,
							stateObservationId: stateMachineProjection.observation.id,
							subjectId: subject.descriptor.subjectId
						};
						const guardOverlayInputs = {
							arrowObservation,
							commandHandlerGraph,
							commandHandlerRequest,
							guardObservation,
							request: guardOverlayRequest,
							semanticSnapshot: snapshot,
							stateGraph: stateMachineProjection.graph,
							stateGraphRequest: stateMachineProjection.request,
							stateObservation: stateMachineProjection.observation,
							subject
						};
						telemetry.start('GUARD_CLASSIFICATION_STATIC_OVERLAY', {
							budgetClassification: 'PROVISIONAL_CALLER_OPERATION_BUDGETS_NOT_PRODUCT_CEILINGS',
							budgets: guardOverlayBudgets,
							guardObservationId: guardObservation.id,
							stateGraphId: stateMachineProjection.graph.id
						});
						const guardOverlayOutcome = buildGuardClassificationOverlay(guardOverlayInputs, {
							onProgress(event) {
								process.stdout.write(`${JSON.stringify(event)}\n`);
							}
						});
						expect(
							guardOverlayOutcome.outcome,
							JSON.stringify(guardOverlayOutcome.diagnostics)
						).toBe('partial');
						if (guardOverlayOutcome.outcome !== 'partial')
							throw new Error(JSON.stringify(guardOverlayOutcome));
						const guardOverlay = guardOverlayOutcome.overlay;
						expect(
							validateGuardClassificationOverlay(guardOverlay, guardOverlayInputs, {
								maxInputRecords: 10_000_000,
								maxInputStringCharacters: 1_000_000_000,
								maxIssues: 100_000,
								maxRecords: 10_000_000,
								maxStringCharacters: 1_000_000_000
							})
						).toEqual({ issues: [], state: 'VALID' });
						expect(guardOverlay.coverage).toMatchObject({
							anchorSites: 12,
							candidateFactoryHandlerLinks: 1,
							classifications: 82,
							commandEvidenceLinks: 94,
							directHandlerLinks: 10,
							expectedClassifications: 82,
							expectedCommandEvidenceLinks: 94,
							expectedOccurrences: 146,
							expectedStateEvidenceRefs: 148,
							helperFrontiers: 3,
							noCommandEvidenceFrontiers: 55,
							occurrences: 146,
							reconciles: true,
							stateEvidenceRefs: 148
						});
						expect(guardOverlay.health).toBe('PARTIAL');
						expect(guardOverlay.runtimeEnforcement).toBe('NOT_CLAIMED');
						expect(guardOverlay.runtimePerformability).toBe('NOT_CLAIMED');
						expect(guardOverlay.fullJanCsaa007Conformance).toBe('NOT_CLAIMED');
						expect(guardOverlay.fullJanCsaa008Conformance).toBe('NOT_CLAIMED');
						const guardOverlayWitness = canonicalSemanticJsonWitness(guardOverlay);
						telemetry.complete({
							anchorSites: guardOverlay.coverage.anchorSites,
							bytes: guardOverlayWitness.bytes,
							candidateHandlerLinks: guardOverlay.coverage.candidateFactoryHandlerLinks,
							classifications: guardOverlay.coverage.classifications,
							commandEvidenceLinks: guardOverlay.coverage.commandEvidenceLinks,
							directHandlerLinks: guardOverlay.coverage.directHandlerLinks,
							frontiers: guardOverlay.coverage.frontiers,
							occurrences: guardOverlay.coverage.occurrences,
							stateEvidenceRefs: guardOverlay.coverage.stateEvidenceRefs,
							validationState: 'VALID'
						});
						guardClassificationOverlayResult = {
							anchorSites: guardOverlay.coverage.anchorSites,
							bytes: guardOverlayWitness.bytes,
							candidateHandlerLinks: guardOverlay.coverage.candidateFactoryHandlerLinks,
							classifications: guardOverlay.coverage.classifications,
							commandEvidenceLinks: guardOverlay.coverage.commandEvidenceLinks,
							directHandlerLinks: guardOverlay.coverage.directHandlerLinks,
							durationMs: Math.max(0, Math.round(performance.now() - guardOverlayStartedAt)),
							frontiers: guardOverlay.coverage.frontiers,
							occurrences: guardOverlay.coverage.occurrences,
							stateEvidenceRefs: guardOverlay.coverage.stateEvidenceRefs
						};
					} else
						telemetry.skip('GUARD_CLASSIFICATION_STATIC_OVERLAY', {
							reason: 'The selected smoke suite does not request the guard-classification overlay.',
							reasonCode: 'SUITE_PHASE_NOT_REQUESTED'
						});

					const commandDispatchStartedAt = performance.now();
					const commandBusSelector = selectJpwbCommandDispatchTopology(snapshot);
					const commandBusSource = snapshot.sources.find(
						(source) => source.id === commandBusSelector.sourceId
					);
					if (commandBusSource === undefined)
						throw new Error(
							'The selected command-bus source is absent from the semantic snapshot.'
						);
					const handlerTargets = commandHandlerGraph.nodes.filter(
						(node) => node.kind === 'HANDLER_TARGET'
					).length;
					const commandDispatchBudgets = {
						maxAstNodes: Math.max(1, snapshot.astNodes.length),
						maxDiagnostics: 100_000,
						maxEdges: Math.max(1, handlerTargets),
						maxHandlerTargets: Math.max(1, handlerTargets),
						maxNodes: 1,
						maxSourceBytes: Math.max(1, commandBusSource.bytes)
					};
					const commandDispatchPhaseDurationsMs: Record<string, number> = {};
					telemetry.start('COMMAND_DISPATCH_STATIC_TOPOLOGY', {
						budgetClassification: 'PROVISIONAL_CALLER_OPERATION_BUDGETS_NOT_PRODUCT_CEILINGS',
						budgets: commandDispatchBudgets,
						predecessorGraphId: commandHandlerGraph.id,
						predecessorHandlerTargets: handlerTargets
					});
					const commandDispatchOutcome = buildCommandDispatchTopology(
						{
							budgets: commandDispatchBudgets,
							commandBus: commandBusSelector,
							commandHandlerGraphId: commandHandlerGraph.id,
							operationVersion: COMMAND_DISPATCH_TOPOLOGY_OPERATION_VERSION,
							schemaVersion: COMMAND_DISPATCH_TOPOLOGY_REQUEST_SCHEMA_VERSION,
							semanticSnapshotId: snapshot.id,
							subjectId: snapshot.subjectId
						},
						snapshot,
						commandHandlerGraph,
						arrowObservation,
						arrowSubject,
						{
							onProgress(event) {
								if (event.state !== 'STARTED')
									commandDispatchPhaseDurationsMs[event.phase] = event.monotonicDurationMs;
								process.stdout.write(`${JSON.stringify(event)}\n`);
							}
						}
					);
					expect(
						commandDispatchOutcome.outcome,
						JSON.stringify(commandDispatchOutcome.diagnostics)
					).toBe('partial');
					if (commandDispatchOutcome.outcome !== 'partial')
						throw new Error(JSON.stringify(commandDispatchOutcome));
					const commandDispatchGraph = commandDispatchOutcome.graph;
					const commandDispatchWitness = canonicalSemanticJsonWitness(commandDispatchGraph);
					expect(
						validateCommandDispatchTopology(
							commandDispatchGraph,
							{
								budgets: commandDispatchBudgets,
								commandBus: commandBusSelector,
								commandHandlerGraphId: commandHandlerGraph.id,
								operationVersion: COMMAND_DISPATCH_TOPOLOGY_OPERATION_VERSION,
								schemaVersion: COMMAND_DISPATCH_TOPOLOGY_REQUEST_SCHEMA_VERSION,
								semanticSnapshotId: snapshot.id,
								subjectId: snapshot.subjectId
							},
							snapshot,
							commandHandlerGraph,
							arrowObservation,
							arrowSubject,
							{
								maxIssues: 100_000,
								maxRecords: 10_000_000,
								maxStringCharacters: 1_000_000_000
							}
						)
					).toEqual({ issues: [], state: 'VALID' });
					expect(commandDispatchGraph.coverage.reconciles).toBe(true);
					expect(commandDispatchGraph.coverage.pipelineNodes).toBe(1);
					expect(commandDispatchGraph.coverage.representedPipelineFacts).toBe(5);
					expect(commandDispatchGraph.coverage.candidateHandlerTargetEdges).toBeGreaterThan(0);
					expect(commandDispatchGraph.edges.every((edge) => edge.attribution === 'CANDIDATE')).toBe(
						true
					);
					expect(commandDispatchGraph.retainedCommandDispatchCensus).toMatchObject({
						artifactPath: COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_PATH,
						execution: 'NOT_EXECUTED_BY_CSAA',
						integration: 'NOT_INTEGRATED',
						verifierAuthority: 'RETAIN_DELEGATED'
					});
					expect(commandDispatchGraph.runtimeDispatchClosure).toBe('NOT_CLAIMED');
					expect(commandDispatchGraph.runtimePerformability).toBe('NOT_CLAIMED');
					telemetry.complete({
						adapterPhaseDurationsMs: commandDispatchPhaseDurationsMs,
						bytes: commandDispatchWitness.bytes,
						candidateEdges: commandDispatchGraph.coverage.candidateHandlerTargetEdges,
						nodes: commandDispatchGraph.nodes.length,
						pipelineFacts: commandDispatchGraph.coverage.representedPipelineFacts,
						retainedCensusBytes: commandDispatchGraph.retainedCommandDispatchCensus.artifactBytes,
						validationState: 'VALID'
					});
					commandDispatchTopologyResult = {
						bytes: commandDispatchWitness.bytes,
						candidateEdges: commandDispatchGraph.coverage.candidateHandlerTargetEdges,
						durationMs: Math.max(0, Math.round(performance.now() - commandDispatchStartedAt)),
						nodes: commandDispatchGraph.nodes.length,
						pipelineFacts: commandDispatchGraph.coverage.representedPipelineFacts,
						retainedCensusBytes: commandDispatchGraph.retainedCommandDispatchCensus.artifactBytes
					};
				} else if (SMOKE_SUITE === 'COMMAND_HANDLER_ONLY')
					throw new Error(
						`COMMAND_HANDLER_ONLY requires one exact subject, but semantic ${snapshot.subjectId} and retained observation ${arrowObservation.subjectId} differ.`
					);
				else {
					const skipDetails = {
						reason:
							'The semantic snapshot and retained observation have distinct exact subjects; use the structural common-subject smoke profile for this projection.',
						reasonCode: 'SUBJECT_IDENTITY_MISMATCH',
						semanticSubjectId: snapshot.subjectId,
						arrowObservationSubjectId: arrowObservation.subjectId
					};
					telemetry.skip('COMMAND_HANDLER_STATIC_PROJECTION', skipDetails);
					telemetry.skip('COMMAND_EVENT_CONTRACT_STATIC_OVERLAY', skipDetails);
					telemetry.skip('COMMAND_DISPATCH_STATIC_TOPOLOGY', skipDetails);
					telemetry.skip('GUARD_CLASSIFICATION_STATIC_OVERLAY', skipDetails);
				}

				let dependencyProviderResult: null | {
					readonly agreementRecords: number;
					readonly corroborationRecords: number;
					readonly dependencies: number;
					readonly durationMs: number;
					readonly health: string;
					readonly incomparableRecords: number;
					readonly modules: number;
					readonly observedDifferenceRecords: number;
					readonly records: number;
				} = null;
				if (SMOKE_PROJECTION_PLAN.runDependencyProviderComparison) {
					if (moduleDependencyGraph === null)
						throw new Error(
							'Dependency-provider comparison requires the module-dependency graph phase.'
						);
					const graph = moduleDependencyGraph;
					const dependencyCruiserInputPaths = providerInputPaths(projectPaths);
					const dependencyCruiserArgs = [
						'depcruise',
						...dependencyCruiserInputPaths,
						'--config',
						'.dependency-cruiser.cjs',
						'--output-type',
						'json'
					];
					const providerStartedAt = new Date();
					const dependencyProviderPipelineStartedMs = performance.now();
					telemetry.start('DEPENDENCY_CRUISER_EXECUTION', {
						inputPaths: dependencyCruiserInputPaths,
						provisionalRuntimeCancellationGuardMs: REPOSITORY_SMOKE_FAILSAFE_PROVIDER_DURATION_MS
					});
					const providerProcess = spawnSync('bunx', dependencyCruiserArgs, {
						cwd: REPOSITORY_ROOT,
						encoding: 'utf8',
						maxBuffer: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES,
						timeout: REPOSITORY_SMOKE_FAILSAFE_PROVIDER_DURATION_MS,
						windowsHide: true
					});
					const providerFinishedAt = new Date();
					if (providerProcess.error) throw providerProcess.error;
					expect(providerProcess.status).not.toBeNull();
					if (providerProcess.status === null)
						throw new Error(
							`dependency-cruiser terminated without an exit status: ${providerProcess.stderr}`
						);
					const providerRaw = providerProcess.stdout;
					const providerRawForBinding = JSON.parse(providerRaw) as {
						readonly summary?: { readonly optionsUsed?: { readonly baseDir?: unknown } };
					};
					const providerReportedBaseDir = providerRawForBinding.summary?.optionsUsed?.baseDir;
					if (typeof providerReportedBaseDir !== 'string' || !isAbsolute(providerReportedBaseDir))
						throw new Error(
							'dependency-cruiser did not report the expected absolute subject root.'
						);
					expect(resolve(providerReportedBaseDir)).toBe(resolve(REPOSITORY_ROOT));
					telemetry.complete({
						exitStatus: providerProcess.status,
						reportedBaseDirState: 'MATCHED_REPOSITORY_ROOT',
						stderrBytes: Buffer.byteLength(providerProcess.stderr, 'utf8'),
						stdoutBytes: Buffer.byteLength(providerRaw, 'utf8')
					});
					telemetry.start('DEPENDENCY_CRUISER_NORMALIZATION', {
						rawBytes: Buffer.byteLength(providerRaw, 'utf8')
					});
					const configBytes = readFileSync(`${REPOSITORY_ROOT}/.dependency-cruiser.cjs`);
					const providerNormalization = normalizeDependencyCruiserOutput(providerRaw, {
						argvGrammarVersion: DEPENDENCY_CRUISER_ARGV_GRAMMAR_VERSION,
						baseDir: '.',
						budgets: {
							maxCommandArgs: 1_000,
							maxDependencies: 5_000_000,
							maxDependents: 5_000_000,
							maxInputPaths: 100_000,
							maxIssues: 100_000,
							maxJsonDepth: 256,
							maxModules: 1_000_000,
							maxPathLength: 4_096,
							maxRawBytes: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES,
							maxRules: 1_000_000,
							maxStringLength: 1_000_000,
							maxSummaryViolations: 1_000_000,
							maxTotalStringCharacters: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES
						},
						command: {
							args: dependencyCruiserArgs.slice(1),
							exitStatus: providerProcess.status,
							finishedAt: providerFinishedAt.toISOString(),
							startedAt: providerStartedAt.toISOString()
						},
						config: { path: '.dependency-cruiser.cjs', sha256: sha256(configBytes) },
						inputPaths: dependencyCruiserInputPaths,
						provider: {
							id: DEPENDENCY_CRUISER_PROVIDER_ID,
							version: DEPENDENCY_CRUISER_PROVIDER_VERSION
						},
						providerReportedBaseDir: {
							bytes: Buffer.byteLength(providerReportedBaseDir, 'utf8'),
							representation: 'ABSOLUTE',
							sha256: sha256(providerReportedBaseDir),
							state: 'PRESENT'
						},
						raw: {
							bytes: Buffer.byteLength(providerRaw, 'utf8'),
							sha256: sha256(providerRaw)
						},
						rawSchemaId: DEPENDENCY_CRUISER_RAW_SCHEMA_ID,
						schemaVersion: DEPENDENCY_CRUISER_INVOCATION_SCHEMA_VERSION,
						subjectRoot: {
							bytes: Buffer.byteLength(providerReportedBaseDir, 'utf8'),
							sha256: sha256(providerReportedBaseDir)
						},
						subjectId: snapshot.subjectId
					});
					expect(providerNormalization.outcome, JSON.stringify(providerNormalization)).toBe(
						'complete'
					);
					if (providerNormalization.outcome === 'unavailable')
						throw new Error(JSON.stringify(providerNormalization));
					const providerObservation = providerNormalization.observation;
					expect(validateDependencyCruiserObservation(providerObservation)).toEqual({
						issues: [],
						state: 'VALID'
					});
					telemetry.complete({
						dependencies: providerObservation.dependencies.length,
						health: providerObservation.health,
						modules: providerObservation.modules.length,
						outcome: providerNormalization.outcome,
						validationState: 'VALID'
					});
					telemetry.start('DEPENDENCY_PROVIDER_COMPARISON', {
						compilerEdges: graph.edges.length,
						providerDependencies: providerObservation.dependencies.length
					});
					const comparisonRequest = {
						budgets: {
							maxComparisonRecords: 5_000_000,
							maxDiagnostics: 100_000,
							maxRationaleCharacters: 100_000
						},
						dependencyCruiserObservationId: providerObservation.id,
						graphId: graph.id,
						negativeCoverage: {
							rationale:
								'The smoke invocation is intentionally bounded to selected input roots and the configured dependency-cruiser exclusions.',
							state: 'OPEN' as const
						},
						operationVersion: DEPENDENCY_PROVIDER_COMPARISON_OPERATION_VERSION,
						resolutionContext: {
							compilerContextDigest: sha256(
								canonicalSemanticJson({
									graphInputDigest: graph.graphInputDigest,
									projectIds: snapshot.projects.map((project) => project.id)
								})
							),
							providerContextDigest: sha256(
								canonicalSemanticJson({
									configDigest: providerObservation.invocation.config.sha256,
									inputPaths: providerObservation.invocation.inputPaths,
									optionsDigest: providerObservation.summary.optionsDigest
								})
							),
							rationale:
								'The compiler uses the selected project tsconfig context while dependency-cruiser uses the repository root tsconfig and its own resolver options.',
							state: 'NOT_EQUIVALENT' as const
						},
						schemaVersion: DEPENDENCY_PROVIDER_COMPARISON_REQUEST_SCHEMA_VERSION,
						semanticSnapshotId: snapshot.id,
						subjectId: snapshot.subjectId
					};
					const comparisonOutcome = compareDependencyProviders(
						comparisonRequest,
						snapshot,
						graph,
						providerObservation
					);
					expect(comparisonOutcome.outcome, JSON.stringify(comparisonOutcome)).toBe('partial');
					if (comparisonOutcome.outcome === 'unavailable')
						throw new Error(JSON.stringify(comparisonOutcome));
					const comparison = comparisonOutcome.comparison;
					expect(
						validateDependencyProviderComparison(
							comparison,
							comparisonRequest,
							snapshot,
							graph,
							providerObservation
						)
					).toEqual({ issues: [], state: 'VALID' });
					expect(comparison.coverage.reconciles).toBe(true);
					expect(comparison.coverage.recordCount).toBeGreaterThan(0);
					expect(
						comparison.limitations.some(
							(limitation) => limitation.kind === 'CONFLICT_QUALIFICATION_UNAVAILABLE'
						)
					).toBe(true);
					telemetry.complete({
						agreementRecords: comparison.coverage.agreementRecords,
						corroborationRecords: comparison.coverage.corroborationRecords,
						incomparableRecords: comparison.coverage.incomparableRecords,
						observedDifferenceRecords: comparison.coverage.observedDifferenceRecords,
						outcome: comparisonOutcome.outcome,
						records: comparison.coverage.recordCount,
						validationState: 'VALID'
					});
					dependencyProviderResult = {
						agreementRecords: comparison.coverage.agreementRecords,
						corroborationRecords: comparison.coverage.corroborationRecords,
						dependencies: providerObservation.dependencies.length,
						durationMs: Math.max(
							0,
							Math.round(performance.now() - dependencyProviderPipelineStartedMs)
						),
						health: providerObservation.health,
						incomparableRecords: comparison.coverage.incomparableRecords,
						modules: providerObservation.modules.length,
						observedDifferenceRecords: comparison.coverage.observedDifferenceRecords,
						records: comparison.coverage.recordCount
					};
				} else {
					const skipDetails = {
						reason: 'The selected smoke suite does not request dependency-provider execution.',
						reasonCode: 'SUITE_PHASE_NOT_REQUESTED'
					};
					telemetry.skip('DEPENDENCY_CRUISER_EXECUTION', skipDetails);
					telemetry.skip('DEPENDENCY_CRUISER_NORMALIZATION', skipDetails);
					telemetry.skip('DEPENDENCY_PROVIDER_COMPARISON', skipDetails);
				}
				if (SMOKE_SUITE === 'COMMAND_HANDLER_ONLY' && commandHandlerResult === null)
					throw new Error(
						'COMMAND_HANDLER_ONLY cannot complete without a validated command-handler projection.'
					);
				if (
					SMOKE_PROJECTION_PLAN.runCommandEventContractOverlay &&
					commandEventContractOverlayResult === null
				)
					throw new Error(
						'The selected smoke suite cannot complete without a validated command-event-contract overlay.'
					);
				if (SMOKE_SUITE === 'COMMAND_HANDLER_ONLY' && commandDispatchTopologyResult === null)
					throw new Error(
						'COMMAND_HANDLER_ONLY cannot complete without a validated command-dispatch static topology.'
					);
				if (
					SMOKE_PROJECTION_PLAN.runGuardClassificationOverlay &&
					(guardEnforcementLedgerResult === null || guardClassificationOverlayResult === null)
				)
					throw new Error(
						'The selected smoke suite cannot complete without validated guard-ledger and guard-classification evidence.'
					);
				if (SMOKE_PROJECTION_PLAN.runStructuralSccAnalysis && structuralSccAnalysisResult === null)
					throw new Error(
						'The selected smoke suite cannot complete without validated structural SCC analysis.'
					);
				if (
					SMOKE_PROJECTION_PLAN.runStructuralModuleReachabilityAnalysis &&
					structuralModuleReachabilityAnalysisResult === null
				)
					throw new Error(
						'The selected smoke suite cannot complete without validated structural module reachability analysis.'
					);
				if (
					SMOKE_PROJECTION_PLAN.runLogicalGraphComposition &&
					logicalGraphCompositionResult === null
				)
					throw new Error(
						'The selected smoke suite cannot complete without validated logical graph composition.'
					);
				if (
					SMOKE_PROJECTION_PLAN.runConditionalExportResolution &&
					conditionalExportResolutionResult === null
				)
					throw new Error(
						'The selected smoke suite cannot complete without validated conditional-export resolution.'
					);
				if (SMOKE_PROJECTION_PLAN.runProjectContextGraph && projectContextGraphResult === null)
					throw new Error(
						'The selected smoke suite cannot complete without validated project-context evidence.'
					);
				const exactSubjectReuse =
					arrowSubject === subject &&
					snapshot.subjectId === subject.descriptor.subjectId &&
					arrowArtifactSet.subjectId === snapshot.subjectId &&
					arrowObservation.subjectId === snapshot.subjectId;
				if (SMOKE_SUITE === 'COMMAND_HANDLER_ONLY') expect(exactSubjectReuse).toBe(true);
				const phaseDurationsMs = telemetry.phaseDurationsMs();
				const skippedPhases = telemetry.skippedPhases();
				telemetry.finish({
					arrowCommandCensusOutcome: arrowOutcome.outcome,
					commandEventContractStaticOverlay: commandEventContractOverlayResult !== null,
					commandDispatchStaticTopology: commandDispatchTopologyResult !== null,
					commandHandlerStaticProjection: commandHandlerResult !== null,
					conditionalExportResolved: conditionalExportResolutionResult !== null,
					exactSubjectReuse,
					guardClassificationStaticOverlay: guardClassificationOverlayResult !== null,
					guardEnforcementLedgerObserved: guardEnforcementLedgerResult !== null,
					logicalGraphComposed: logicalGraphCompositionResult !== null,
					moduleResolutionTraced: moduleResolutionTraceResult !== null,
					projectContextProjected: projectContextGraphResult !== null,
					semanticSnapshotOutcome: outcome.outcome,
					semanticProfile: SMOKE_PROFILE,
					skippedPhases,
					smokeSuite: SMOKE_SUITE,
					projects: snapshot.projects.length,
					sources: snapshot.sources.length,
					stateMachineProjected: stateMachineResult !== null,
					structuralModuleReachabilityAnalyzed: structuralModuleReachabilityAnalysisResult !== null,
					structuralSccAnalyzed: structuralSccAnalysisResult !== null
				});
				process.stdout.write(
					`${JSON.stringify({
						arrowCommandCensus: {
							adapterPhaseDurationsMs: arrowAdapterPhaseDurationsMs,
							artifactBytes: arrowArtifactBytes,
							artifactSetId: arrowArtifactSet.id,
							artifacts: arrowArtifactSet.artifacts.length,
							baselineMatches: arrowObservation.coverage.baselineMatches,
							declaredArrowOccurrences: arrowObservation.coverage.declaredArrowOccurrences,
							declaredSites: arrowObservation.coverage.declaredSites,
							externalModuleBytes,
							externalModuleFiles,
							outcome: arrowOutcome.outcome,
							observationBytes: arrowObservationWitness.bytes,
							observationId: arrowObservation.id,
							observationSha256: arrowObservationWitness.sha256,
							rawOutputBytes: arrowObservation.rawOutput.bytes,
							rawOutputId: arrowObservation.rawOutput.id,
							rawOutputSha256: arrowObservation.rawOutput.sha256,
							subjectId: arrowSubject.descriptor.subjectId,
							subjectScope: arrowSubject.request.scope.kind,
							subjectArtifactBytes: arrowSubjectBytes,
							subjectArtifacts: arrowSubject.artifacts.length,
							totalInScopeTopologyArrows: arrowObservation.coverage.totalInScopeTopologyArrows,
							uncoveredArrows: arrowObservation.coverage.uncoveredArrows
						},
						callGraph: callGraphResult,
						commandEventContractStaticOverlay: commandEventContractOverlayResult,
						commandDispatchStaticTopology: commandDispatchTopologyResult,
						commandHandlerStaticProjection: commandHandlerResult,
						conditionalExportResolution: conditionalExportResolutionResult,
						declarationContextAnalysis: declarationContextAnalysisResult,
						dependencyProviderComparison: dependencyProviderResult,
						event: 'CSAA_REPOSITORY_SMOKE_RESULT',
						exactSubjectReuse,
						guardClassificationStaticOverlay: guardClassificationOverlayResult,
						guardEnforcementLedger: guardEnforcementLedgerResult,
						logicalGraphComposition: logicalGraphCompositionResult,
						projectContextGraph: projectContextGraphResult,
						moduleDependencyGraph: moduleDependencyGraphResult,
						moduleResolutionTrace: moduleResolutionTraceResult,
						readWriteAccessGraph: readWriteAccessGraphResult,
						projectCount: snapshot.projects.length,
						phaseDurationsMs,
						selectedSubjectArtifactBytes: subjectArtifactBytes,
						selectedSubjectArtifactCount: subject.artifacts.length,
						selector: SMOKE_SELECTOR ?? null,
						semanticPipelineDurationMs,
						semanticProfile: SMOKE_PROFILE,
						semanticSnapshotPhaseDurationsMs: semanticPhaseDurationsMs,
						semanticSnapshotProgressEvents: semanticProgressEvents.length,
						semanticSnapshotMemoryHighWaterBytes: semanticMemoryHighWaterBytes,
						semanticSnapshotWitness,
						skippedPhases,
						smokeSuite: SMOKE_SUITE,
						stateMachine: stateMachineResult,
						structuralModuleReachabilityAnalysis: structuralModuleReachabilityAnalysisResult,
						structuralSccAnalysis: structuralSccAnalysisResult,
						sourceCount: snapshot.sources.length
					})}\n`
				);
			} catch (error) {
				telemetry.fail(error);
				throw error;
			}
		},
		REPOSITORY_SMOKE_FAILSAFE_TEST_TIMEOUT_MS
	);
});
