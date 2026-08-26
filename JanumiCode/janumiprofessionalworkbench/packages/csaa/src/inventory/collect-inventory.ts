import { basename } from 'node:path';
import ts from 'typescript';
import {
	ARROW_COMMAND_CENSUS_ADAPTER_ID,
	ARROW_COMMAND_CENSUS_INTEGRATION_STRATEGY,
	ARROW_COMMAND_CENSUS_METHOD,
	ARROW_COMMAND_CENSUS_VERIFIER_AUTHORITY
} from '../contracts/arrow-command-census.js';
import {
	ARROW_COMMAND_CENSUS_REPORT_AUTHORITY,
	ARROW_COMMAND_CENSUS_REPORT_AUTHORITY_TRANSFER,
	ARROW_COMMAND_CENSUS_REPORT_CAPABILITY_STATUS,
	ARROW_COMMAND_CENSUS_REPORT_EXECUTION_SELECTION,
	ARROW_COMMAND_CENSUS_REPORT_GATE_EFFECT,
	ARROW_COMMAND_CENSUS_REPORT_NONCLAIMS,
	ARROW_COMMAND_CENSUS_REPORT_OPERATION_VERSION,
	ARROW_COMMAND_CENSUS_REPORT_REQUEST_SCHEMA_VERSION,
	ARROW_COMMAND_CENSUS_REPORT_REGISTRY_STATUS,
	ARROW_COMMAND_CENSUS_REPORT_RESULT_SCHEMA_VERSION,
	ARROW_COMMAND_CENSUS_REPORT_SCHEMA_VERSION,
	ARROW_COMMAND_CENSUS_REPORT_SELECTION,
	ARROW_COMMAND_CENSUS_REPORT_SCOPE
} from '../contracts/arrow-command-census-report.js';
import {
	CALL_GRAPH_REPORT_AUTHORITY,
	CALL_GRAPH_REPORT_AUTHORITY_TRANSFER,
	CALL_GRAPH_REPORT_GATE_EFFECT,
	CALL_GRAPH_REPORT_NONCLAIMS,
	CALL_GRAPH_REPORT_OPERATION_VERSION,
	CALL_GRAPH_REPORT_REQUEST_SCHEMA_VERSION,
	CALL_GRAPH_REPORT_RESULT_SCHEMA_VERSION,
	CALL_GRAPH_REPORT_SCHEMA_VERSION,
	CALL_GRAPH_REPORT_SELECTION
} from '../contracts/call-graph-report.js';
import {
	COMMAND_HANDLER_GRAPH_REPORT_AUTHORITY,
	COMMAND_HANDLER_GRAPH_REPORT_AUTHORITY_TRANSFER,
	COMMAND_HANDLER_GRAPH_REPORT_EXECUTION_SELECTION,
	COMMAND_HANDLER_GRAPH_REPORT_GATE_EFFECT,
	COMMAND_HANDLER_GRAPH_REPORT_NONCLAIMS,
	COMMAND_HANDLER_GRAPH_REPORT_OPERATION_VERSION,
	COMMAND_HANDLER_GRAPH_REPORT_REQUEST_SCHEMA_VERSION,
	COMMAND_HANDLER_GRAPH_REPORT_RESULT_SCHEMA_VERSION,
	COMMAND_HANDLER_GRAPH_REPORT_SCHEMA_VERSION,
	COMMAND_HANDLER_GRAPH_REPORT_SELECTION,
	COMMAND_HANDLER_GRAPH_REPORT_SCOPE
} from '../contracts/command-handler-graph-report.js';
import {
	COMMAND_DISPATCH_TOPOLOGY_REPORT_AUTHORITY,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_AUTHORITY_TRANSFER,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_EXECUTION_SELECTION,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_GATE_EFFECT,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_NONCLAIMS,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_OPERATION_VERSION,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_REQUEST_SCHEMA_VERSION,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_RESULT_SCHEMA_VERSION,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_SCHEMA_VERSION,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_SELECTION,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_SCOPE
} from '../contracts/command-dispatch-topology-report.js';
import {
	STATE_MACHINE_GRAPH_REPORT_AUTHORITY,
	STATE_MACHINE_GRAPH_REPORT_AUTHORITY_TRANSFER,
	STATE_MACHINE_GRAPH_REPORT_GATE_EFFECT,
	STATE_MACHINE_GRAPH_REPORT_NONCLAIMS,
	STATE_MACHINE_GRAPH_REPORT_OPERATION_VERSION,
	STATE_MACHINE_GRAPH_REPORT_REQUEST_SCHEMA_VERSION,
	STATE_MACHINE_GRAPH_REPORT_RESULT_SCHEMA_VERSION,
	STATE_MACHINE_GRAPH_REPORT_SCHEMA_VERSION,
	STATE_MACHINE_GRAPH_REPORT_SELECTION
} from '../contracts/state-machine-graph-report.js';
import { STATE_MACHINE_GRAPH_VERIFIER_AUTHORITY } from '../contracts/state-machine-graph.js';
import {
	COMMAND_EVENT_CONTRACT_OVERLAY_PROJECT_CONFIG_PATH,
	COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH,
	COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH,
	COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH
} from '../contracts/command-event-contract-overlay.js';
import {
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_AUTHORITY,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_AUTHORITY_TRANSFER,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_EXECUTION_SELECTION,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_GATE_EFFECT,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_NONCLAIMS,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_OPERATION_VERSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_REQUEST_SCHEMA_VERSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_RESULT_SCHEMA_VERSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SCHEMA_VERSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SELECTION,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SCOPE
} from '../contracts/command-event-contract-overlay-report.js';
import {
	CONDITIONAL_EXPORT_RESOLUTION_AUTHORITY,
	CONDITIONAL_EXPORT_RESOLUTION_AUTHORITY_TRANSFER,
	CONDITIONAL_EXPORT_RESOLUTION_CAPABILITY,
	CONDITIONAL_EXPORT_RESOLUTION_CAPABILITY_STATUS,
	CONDITIONAL_EXPORT_RESOLUTION_CURRENTNESS,
	CONDITIONAL_EXPORT_RESOLUTION_FRESHNESS,
	CONDITIONAL_EXPORT_RESOLUTION_FULL_JAN_CSAA_012_CONFORMANCE,
	CONDITIONAL_EXPORT_RESOLUTION_GATE_EFFECT,
	CONDITIONAL_EXPORT_RESOLUTION_METHOD,
	CONDITIONAL_EXPORT_RESOLUTION_NONCLAIMS,
	CONDITIONAL_EXPORT_RESOLUTION_SELECTION
} from '../contracts/conditional-export-resolution.js';
import {
	DECLARATION_CONTEXT_ANALYSIS_AUTHORITY,
	DECLARATION_CONTEXT_ANALYSIS_AUTHORITY_TRANSFER,
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
	DECLARATION_CONTEXT_ANALYSIS_SELECTION
} from '../contracts/declaration-context-analysis.js';
import {
	DECLARATION_CONTEXT_REPORT_NONCLAIMS,
	DECLARATION_CONTEXT_REPORT_OPERATION_VERSION,
	DECLARATION_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION,
	DECLARATION_CONTEXT_REPORT_RESULT_SCHEMA_VERSION,
	DECLARATION_CONTEXT_REPORT_SCHEMA_VERSION,
	DECLARATION_CONTEXT_REPORT_SELECTION
} from '../contracts/declaration-context-report.js';
import {
	GUARD_ENFORCEMENT_LEDGER_ADAPTER_ID,
	GUARD_ENFORCEMENT_LEDGER_INTEGRATION_STRATEGY,
	GUARD_ENFORCEMENT_LEDGER_METHOD,
	GUARD_ENFORCEMENT_LEDGER_VERIFIER_AUTHORITY
} from '../contracts/guard-enforcement-ledger.js';
import {
	GUARD_ENFORCEMENT_LEDGER_REPORT_AUTHORITY,
	GUARD_ENFORCEMENT_LEDGER_REPORT_AUTHORITY_TRANSFER,
	GUARD_ENFORCEMENT_LEDGER_REPORT_ANALYZER_DEPENDENCY_PATH,
	GUARD_ENFORCEMENT_LEDGER_REPORT_CAPABILITY_STATUS,
	GUARD_ENFORCEMENT_LEDGER_REPORT_EXECUTION_SELECTION,
	GUARD_ENFORCEMENT_LEDGER_REPORT_GATE_EFFECT,
	GUARD_ENFORCEMENT_LEDGER_REPORT_NONCLAIMS,
	GUARD_ENFORCEMENT_LEDGER_REPORT_OPERATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_REPORT_REGISTRY_STATUS,
	GUARD_ENFORCEMENT_LEDGER_REPORT_REQUEST_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_REPORT_RESULT_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_REPORT_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_REPORT_SELECTION,
	GUARD_ENFORCEMENT_LEDGER_REPORT_SCOPE
} from '../contracts/guard-enforcement-ledger-report.js';
import {
	GUARD_CLASSIFICATION_OVERLAY_REPORT_AUTHORITY,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_AUTHORITY_TRANSFER,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_EXECUTION_SELECTION,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_GATE_EFFECT,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_NONCLAIMS,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_OPERATION_VERSION,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_REQUEST_SCHEMA_VERSION,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_RESULT_SCHEMA_VERSION,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_SCHEMA_VERSION,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_SELECTION,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_SCOPE,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_STATE_SOURCE
} from '../contracts/guard-classification-overlay-report.js';
import {
	LOGICAL_GRAPH_COMPOSITION_AUTHORITY_TRANSFER,
	LOGICAL_GRAPH_COMPOSITION_CAPABILITY,
	LOGICAL_GRAPH_COMPOSITION_CAPABILITY_STATUS,
	LOGICAL_GRAPH_COMPOSITION_CURRENTNESS,
	LOGICAL_GRAPH_COMPOSITION_FRESHNESS,
	LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_007_CONFORMANCE,
	LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_008_CONFORMANCE,
	LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_009_CONFORMANCE,
	LOGICAL_GRAPH_COMPOSITION_GATE_EFFECT,
	LOGICAL_GRAPH_COMPOSITION_GRAPH_AUTHORITY,
	LOGICAL_GRAPH_COMPOSITION_METHOD,
	LOGICAL_GRAPH_COMPOSITION_NONCLAIMS,
	LOGICAL_GRAPH_COMPOSITION_SELECTION
} from '../contracts/logical-graph-composition.js';
import {
	LOGICAL_GRAPH_COMPOSITION_REPORT_AUTHORITY,
	LOGICAL_GRAPH_COMPOSITION_REPORT_AUTHORITY_TRANSFER,
	LOGICAL_GRAPH_COMPOSITION_REPORT_FULL_CAPABILITY,
	LOGICAL_GRAPH_COMPOSITION_REPORT_GATE_EFFECT,
	LOGICAL_GRAPH_COMPOSITION_REPORT_NONCLAIMS,
	LOGICAL_GRAPH_COMPOSITION_REPORT_OPERATION_VERSION,
	LOGICAL_GRAPH_COMPOSITION_REPORT_REQUEST_SCHEMA_VERSION,
	LOGICAL_GRAPH_COMPOSITION_REPORT_RESULT_SCHEMA_VERSION,
	LOGICAL_GRAPH_COMPOSITION_REPORT_SCHEMA_VERSION,
	LOGICAL_GRAPH_COMPOSITION_REPORT_SELECTION
} from '../contracts/logical-graph-composition-report.js';
import {
	MODULE_DEPENDENCY_REPORT_AUTHORITY,
	MODULE_DEPENDENCY_REPORT_AUTHORITY_TRANSFER,
	MODULE_DEPENDENCY_REPORT_GATE_EFFECT,
	MODULE_DEPENDENCY_REPORT_NONCLAIMS,
	MODULE_DEPENDENCY_REPORT_OPERATION_VERSION,
	MODULE_DEPENDENCY_REPORT_REQUEST_SCHEMA_VERSION,
	MODULE_DEPENDENCY_REPORT_RESULT_SCHEMA_VERSION,
	MODULE_DEPENDENCY_REPORT_SCHEMA_VERSION,
	MODULE_DEPENDENCY_REPORT_SELECTION
} from '../contracts/module-dependency-report.js';
import {
	MODULE_RESOLUTION_TRACE_AUTHORITY,
	MODULE_RESOLUTION_TRACE_AUTHORITY_TRANSFER,
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
	MODULE_RESOLUTION_TRACE_SELECTION
} from '../contracts/module-resolution-trace.js';
import {
	MODULE_RESOLUTION_TRACE_REPORT_NONCLAIMS,
	MODULE_RESOLUTION_TRACE_REPORT_OPERATION_VERSION,
	MODULE_RESOLUTION_TRACE_REPORT_REQUEST_SCHEMA_VERSION,
	MODULE_RESOLUTION_TRACE_REPORT_RESULT_SCHEMA_VERSION,
	MODULE_RESOLUTION_TRACE_REPORT_SCHEMA_VERSION,
	MODULE_RESOLUTION_TRACE_REPORT_SELECTION
} from '../contracts/module-resolution-trace-report.js';
import {
	PROJECT_CONTEXT_GRAPH_AUTHORITY_TRANSFER,
	PROJECT_CONTEXT_GRAPH_CAPABILITY,
	PROJECT_CONTEXT_GRAPH_CAPABILITY_STATUS,
	PROJECT_CONTEXT_GRAPH_CURRENTNESS,
	PROJECT_CONTEXT_GRAPH_FRESHNESS,
	PROJECT_CONTEXT_GRAPH_FULL_JAN_CSAA_010_CONFORMANCE,
	PROJECT_CONTEXT_GRAPH_GATE_EFFECT,
	PROJECT_CONTEXT_GRAPH_GRAPH_AUTHORITY,
	PROJECT_CONTEXT_GRAPH_METHOD,
	PROJECT_CONTEXT_GRAPH_NONCLAIMS,
	PROJECT_CONTEXT_GRAPH_SELECTION
} from '../contracts/project-context-graph.js';
import {
	PROJECT_CONTEXT_REPORT_NONCLAIMS,
	PROJECT_CONTEXT_REPORT_OPERATION_VERSION,
	PROJECT_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION,
	PROJECT_CONTEXT_REPORT_RESULT_SCHEMA_VERSION,
	PROJECT_CONTEXT_REPORT_SCHEMA_VERSION
} from '../contracts/project-context-report.js';
import {
	READ_WRITE_ACCESS_REPORT_AUTHORITY,
	READ_WRITE_ACCESS_REPORT_AUTHORITY_TRANSFER,
	READ_WRITE_ACCESS_REPORT_GATE_EFFECT,
	READ_WRITE_ACCESS_REPORT_NONCLAIMS,
	READ_WRITE_ACCESS_REPORT_OPERATION_VERSION,
	READ_WRITE_ACCESS_REPORT_REQUEST_SCHEMA_VERSION,
	READ_WRITE_ACCESS_REPORT_RESULT_SCHEMA_VERSION,
	READ_WRITE_ACCESS_REPORT_SCHEMA_VERSION,
	READ_WRITE_ACCESS_REPORT_SELECTION
} from '../contracts/read-write-access-report.js';
import {
	SEMANTIC_SOURCE_QUERY_ALGEBRA_VERSION,
	SEMANTIC_SOURCE_QUERY_CAPABILITY_STATUS,
	SEMANTIC_SOURCE_QUERY_EXECUTION_MODE,
	SEMANTIC_SOURCE_QUERY_FIELDS,
	SEMANTIC_SOURCE_QUERY_NONCLAIMS,
	SEMANTIC_SOURCE_QUERY_OPERATION_VERSION,
	SEMANTIC_SOURCE_QUERY_OPERATORS,
	SEMANTIC_SOURCE_QUERY_POPULATION
} from '../contracts/semantic-source-query.js';
import {
	SEMANTIC_SOURCE_QUERY_REPORT_AUTHORITY,
	SEMANTIC_SOURCE_QUERY_REPORT_AUTHORITY_TRANSFER,
	SEMANTIC_SOURCE_QUERY_REPORT_CAPABILITY,
	SEMANTIC_SOURCE_QUERY_REPORT_CAPABILITY_STATUS,
	SEMANTIC_SOURCE_QUERY_REPORT_GATE_EFFECT,
	SEMANTIC_SOURCE_QUERY_REPORT_NONCLAIMS,
	SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
	SEMANTIC_SOURCE_QUERY_REPORT_REQUEST_SCHEMA_VERSION,
	SEMANTIC_SOURCE_QUERY_REPORT_RESULT_SCHEMA_VERSION,
	SEMANTIC_SOURCE_QUERY_REPORT_SCHEMA_VERSION
} from '../contracts/semantic-source-query-report.js';
import {
	SOURCE_ORIGIN_CORRELATION_AUTHORITY,
	SOURCE_ORIGIN_CORRELATION_AUTHORITY_TRANSFER,
	SOURCE_ORIGIN_CORRELATION_CAPABILITY,
	SOURCE_ORIGIN_CORRELATION_CAPABILITY_STATUS,
	SOURCE_ORIGIN_CORRELATION_CURRENTNESS,
	SOURCE_ORIGIN_CORRELATION_FRESHNESS,
	SOURCE_ORIGIN_CORRELATION_FULL_JAN_CSAA_007_CONFORMANCE,
	SOURCE_ORIGIN_CORRELATION_FULL_JAN_CSAA_008_CONFORMANCE,
	SOURCE_ORIGIN_CORRELATION_FULL_JAN_CSAA_014_CONFORMANCE,
	SOURCE_ORIGIN_CORRELATION_GATE_EFFECT,
	SOURCE_ORIGIN_CORRELATION_METHOD,
	SOURCE_ORIGIN_CORRELATION_NONCLAIMS,
	SOURCE_ORIGIN_CORRELATION_SELECTION
} from '../contracts/source-origin-correlation.js';
import {
	STATIC_MODULE_IMPACT_CANDIDATE_ANALYSIS_AUTHORITY,
	STATIC_MODULE_IMPACT_CANDIDATE_AUTHORITY_TRANSFER,
	STATIC_MODULE_IMPACT_CANDIDATE_CAPABILITY,
	STATIC_MODULE_IMPACT_CANDIDATE_CAPABILITY_STATUS,
	STATIC_MODULE_IMPACT_CANDIDATE_FULL_CAP_031,
	STATIC_MODULE_IMPACT_CANDIDATE_GATE_EFFECT,
	STATIC_MODULE_IMPACT_CANDIDATE_METHOD,
	STATIC_MODULE_IMPACT_CANDIDATE_NEXT_EVIDENCE,
	STATIC_MODULE_IMPACT_CANDIDATE_OUTER_RESULT_BASE_BYTE_RESERVATION,
	STATIC_MODULE_IMPACT_CANDIDATE_PROPAGATION,
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_NONCLAIMS,
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_RESULT_SCHEMA_VERSION,
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_SAFETY_CEILINGS,
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_SCHEMA_VERSION,
	STATIC_MODULE_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION,
	STATIC_MODULE_IMPACT_CANDIDATE_UNASSESSED_PROPAGATION_FAMILIES,
	STATIC_MODULE_IMPACT_CANDIDATE_WITNESS_HOP_RESULT_BYTE_RESERVATION
} from '../contracts/static-module-impact-candidate-report.js';
import {
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_AUTHORITY_TRANSFER,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_CAPABILITY,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_CAPABILITY_STATUS,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_FULL_JAN_CSAA_007_CONFORMANCE,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_FULL_JAN_CSAA_008_CONFORMANCE,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_GATE_EFFECT,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_GRAPH_AUTHORITY,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_METHOD,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_NONCLAIMS,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION
} from '../contracts/structural-module-reachability-analysis.js';
import {
	STRUCTURAL_MODULE_REACHABILITY_REPORT_NONCLAIMS,
	STRUCTURAL_MODULE_REACHABILITY_REPORT_OPERATION_VERSION,
	STRUCTURAL_MODULE_REACHABILITY_REPORT_REQUEST_SCHEMA_VERSION,
	STRUCTURAL_MODULE_REACHABILITY_REPORT_RESULT_SCHEMA_VERSION,
	STRUCTURAL_MODULE_REACHABILITY_REPORT_SCHEMA_VERSION
} from '../contracts/structural-module-reachability-report.js';
import {
	STRUCTURAL_SCC_ANALYSIS_AUTHORITY_TRANSFER,
	STRUCTURAL_SCC_ANALYSIS_CAPABILITY,
	STRUCTURAL_SCC_ANALYSIS_CAPABILITY_STATUS,
	STRUCTURAL_SCC_ANALYSIS_FULL_JAN_CSAA_007_CONFORMANCE,
	STRUCTURAL_SCC_ANALYSIS_FULL_JAN_CSAA_008_CONFORMANCE,
	STRUCTURAL_SCC_ANALYSIS_GATE_EFFECT,
	STRUCTURAL_SCC_ANALYSIS_GRAPH_AUTHORITY,
	STRUCTURAL_SCC_ANALYSIS_METHOD,
	STRUCTURAL_SCC_ANALYSIS_NONCLAIMS,
	STRUCTURAL_SCC_ANALYSIS_SELECTION
} from '../contracts/structural-scc-analysis.js';
import {
	STRUCTURAL_SCC_REPORT_NONCLAIMS,
	STRUCTURAL_SCC_REPORT_OPERATION_VERSION,
	STRUCTURAL_SCC_REPORT_REQUEST_SCHEMA_VERSION,
	STRUCTURAL_SCC_REPORT_RESULT_SCHEMA_VERSION,
	STRUCTURAL_SCC_REPORT_SCHEMA_VERSION
} from '../contracts/structural-scc-report.js';
import {
	WORKING_SOURCE_EDIT_EVIDENCE_DIGEST_METHOD,
	WORKING_SOURCE_EDIT_EVIDENCE_DIGEST_SCOPE,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_ANALYSIS_AUTHORITY,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_AUTHORITY_TRANSFER,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_CAPABILITY,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_CAPABILITY_STATUS,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_FULL_CAP_031,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_GATE_EFFECT,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_METHOD,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_NEXT_EVIDENCE,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_NONCLAIMS,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_RESULT_SCHEMA_VERSION,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_SAFETY_CEILINGS,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_SCHEMA_VERSION,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION,
	WORKING_SOURCE_EDIT_OBSERVATION_EXCLUSIONS,
	WORKING_SOURCE_EDIT_OBSERVATION_METHOD,
	WORKING_SOURCE_EDIT_OBSERVATION_SCHEMA_VERSION,
	WORKING_SOURCE_EDIT_TEXTUAL_CHANGE_METHOD
} from '../contracts/working-source-edit-impact-candidate-report.js';
import {
	INVENTORY_GENERATOR_ID,
	INVENTORY_GENERATOR_VERSION,
	INVENTORY_SCHEMA_VERSION,
	type ArtifactClass,
	type ArtifactPopulation,
	type AssuranceSurfaceInventory,
	type CapabilityInventory,
	type CommandInventory,
	type DependencyBoundaryInventory,
	type DependencyDeclaration,
	type ExclusionRecord,
	type InventoryDocument,
	type ProviderInventory,
	type SelectedFileRecord,
	type TypeScriptProjectInventory,
	type VerificationAssetInventory,
	type WorkspaceInventory
} from '../contracts/inventory.js';
import type { FrozenSubject } from '../contracts/subject.js';
import {
	WORKING_CHANGE_SET_METHOD,
	WORKING_CHANGE_SET_SCHEMA_VERSION
} from '../contracts/working-change-set.js';
import { readFrozenSubjectArtifact } from '../subject/frozen-store.js';
import { subjectConfigurationPreimage } from '../subject/manifest.js';
import {
	RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH,
	RPH_DEMO_GENERATED_CONTEXT_PATH,
	SVELTE_KIT_SYNC_GENERATOR_ID
} from '../subject/svelte-kit-generator.js';
import { canonicalJson, compareText, sortUniqueBy } from './canonical.js';
import { projectSubjectForInventory } from './project-subject-for-inventory.js';

type JsonObject = Record<string, unknown>;

const TYPESCRIPT_AST_PROVENANCE = [
	'packages/csaa/src/contracts/semantic.ts',
	'packages/csaa/src/providers/typescript/compiler-input-journal.ts',
	'packages/csaa/src/providers/typescript/extract-static-raw.ts',
	'packages/csaa/src/providers/typescript/frozen-compiler-host.ts',
	'packages/csaa/src/semantic/build-static-semantic-snapshot.ts',
	'packages/csaa/src/semantic/monotonic-operation-clock.ts'
] as const;
const WORKING_CHANGE_SET_PROVENANCE = [
	'packages/csaa/src/contracts/working-change-set.ts',
	'packages/csaa/src/subject/bind-working-change-set.ts',
	'packages/csaa/src/subject/git-readonly.ts',
	'packages/csaa/src/subject/observe-working-change-set.ts',
	'packages/csaa/src/subject/resolve-working-subject.test.ts',
	'packages/csaa/src/subject/resolve-working-subject.ts'
] as const;

const TYPESCRIPT_SYMBOL_PROVENANCE = [
	'packages/csaa/src/providers/typescript/extract-symbols.ts',
	'packages/csaa/src/semantic/raw-semantic-model.ts',
	'packages/csaa/src/semantic/normalize-semantic-snapshot.ts',
	'packages/csaa/src/semantic/validate-snapshot.ts'
] as const;

const TYPESCRIPT_TYPE_PROVENANCE = [
	'packages/csaa/src/providers/typescript/extract-types.ts'
] as const;

const TYPESCRIPT_MODULE_GRAPH_PROVENANCE = [
	'packages/csaa/src/contracts/graph.ts',
	'packages/csaa/src/graph/build-module-dependency-graph.ts',
	'packages/csaa/src/graph/ids.ts',
	'packages/csaa/src/graph/module-dependency-content.ts',
	'packages/csaa/src/graph/module-dependency-input.ts',
	'packages/csaa/src/graph/validate-graph.ts'
] as const;

const TYPESCRIPT_MODULE_DEPENDENCY_REPORT_PROVENANCE = [
	'packages/csaa/src/contracts/module-dependency-report.ts',
	'packages/csaa/src/index.test.ts',
	'packages/csaa/src/index.ts',
	'packages/csaa/src/application/module-dependency-command.test.ts',
	'packages/csaa/src/application/module-dependency-progress-jsonl.test.ts',
	'packages/csaa/src/application/module-dependency-progress-jsonl.ts',
	'packages/csaa/src/application/run-project-context-report.ts',
	'packages/csaa/src/application/run-module-dependency-command.ts',
	'packages/csaa/src/application/run-module-dependency-report.test.ts',
	'packages/csaa/src/application/run-module-dependency-report.ts',
	'scripts/csaa-module-dependency.ts'
] as const;

const TYPESCRIPT_SEMANTIC_SOURCE_QUERY_PROVENANCE = [
	'packages/csaa/src/application/run-project-context-report.ts',
	'packages/csaa/src/application/run-semantic-source-query-command.test.ts',
	'packages/csaa/src/application/run-semantic-source-query-command.ts',
	'packages/csaa/src/application/run-semantic-source-query-report.test.ts',
	'packages/csaa/src/application/run-semantic-source-query-report.ts',
	'packages/csaa/src/application/semantic-source-query-progress-jsonl.test.ts',
	'packages/csaa/src/application/semantic-source-query-progress-jsonl.ts',
	'packages/csaa/src/contracts/semantic-source-query-report.ts',
	'packages/csaa/src/contracts/semantic-source-query.ts',
	'packages/csaa/src/index.test.ts',
	'packages/csaa/src/index.ts',
	'packages/csaa/src/query/evaluate-semantic-source-query.test.ts',
	'packages/csaa/src/query/evaluate-semantic-source-query.ts',
	'scripts/csaa-semantic-source-query.ts'
] as const;

const JPWB_MODULE_DEPENDENCY_REPORT_COMMAND = 'bun scripts/csaa-module-dependency.ts';
const JPWB_SEMANTIC_SOURCE_QUERY_REPORT_COMMAND = 'bun scripts/csaa-semantic-source-query.ts';
const JPWB_LOGICAL_GRAPH_COMPOSITION_REPORT_COMMAND =
	'bun scripts/csaa-logical-graph-composition.ts';
const JPWB_ARROW_COMMAND_CENSUS_REPORT_COMMAND = 'bun scripts/csaa-arrow-command-census.ts';
const JPWB_COMMAND_HANDLER_GRAPH_REPORT_COMMAND = 'bun scripts/csaa-command-handler-graph.ts';
const JPWB_COMMAND_DISPATCH_TOPOLOGY_REPORT_COMMAND =
	'bun scripts/csaa-command-dispatch-topology.ts';
const JPWB_COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_COMMAND =
	'bun scripts/csaa-command-event-contract-overlay.ts';
const JPWB_GUARD_ENFORCEMENT_LEDGER_REPORT_COMMAND = 'bun scripts/csaa-guard-enforcement-ledger.ts';
const JPWB_GUARD_CLASSIFICATION_OVERLAY_REPORT_COMMAND =
	'bun scripts/csaa-guard-classification-overlay.ts';

const TYPESCRIPT_STRUCTURAL_SCC_ANALYSIS_PROVENANCE = [
	'packages/csaa/src/contracts/structural-scc-analysis.ts',
	'packages/csaa/src/graph/build-structural-scc-analysis.ts',
	'packages/csaa/src/graph/structural-scc-analysis-canonical.ts',
	'packages/csaa/src/graph/validate-structural-scc-analysis.ts',
	'packages/csaa/src/semantic/repository-smoke.test.ts'
] as const;

const TYPESCRIPT_STRUCTURAL_SCC_REPORT_PROVENANCE = [
	'packages/csaa/src/contracts/structural-scc-report.ts',
	'packages/csaa/src/application/run-structural-scc-report.ts',
	'packages/csaa/src/application/structural-scc-progress-jsonl.ts',
	'packages/csaa/src/application/run-structural-scc-report.test.ts',
	'packages/csaa/src/application/structural-scc-progress-jsonl.test.ts',
	'packages/csaa/src/application/structural-scc-command.test.ts',
	'packages/csaa/test-fixtures/structural-scc-command/tsconfig.json',
	'packages/csaa/test-fixtures/structural-scc-command/a.ts',
	'packages/csaa/test-fixtures/structural-scc-command/b.ts',
	'packages/csaa/test-fixtures/structural-scc-command/leaf.ts',
	'scripts/csaa-structural-scc.ts'
] as const;

const TYPESCRIPT_STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_PROVENANCE = [
	'packages/csaa/src/contracts/structural-module-reachability-analysis.ts',
	'packages/csaa/src/graph/build-structural-module-reachability-analysis.ts',
	'packages/csaa/src/graph/structural-module-reachability-analysis-canonical.ts',
	'packages/csaa/src/graph/validate-structural-module-reachability-analysis.ts',
	'packages/csaa/src/graph/build-structural-module-reachability-analysis.test.ts',
	'packages/csaa/src/graph/structural-module-reachability-analysis-coverage.test.ts',
	'packages/csaa/src/semantic/repository-smoke.test.ts'
] as const;

const TYPESCRIPT_STRUCTURAL_MODULE_REACHABILITY_REPORT_PROVENANCE = [
	'packages/csaa/src/contracts/structural-module-reachability-report.ts',
	'packages/csaa/src/index.test.ts',
	'packages/csaa/src/index.ts',
	'packages/csaa/src/application/run-structural-module-reachability-report.ts',
	'packages/csaa/src/application/structural-module-reachability-progress-jsonl.ts',
	'packages/csaa/src/application/run-structural-module-reachability-report.test.ts',
	'packages/csaa/src/application/structural-module-reachability-progress-jsonl.test.ts',
	'packages/csaa/src/application/structural-module-reachability-command.test.ts',
	'scripts/csaa-structural-module-reachability.ts'
] as const;

const TYPESCRIPT_STATIC_MODULE_IMPACT_CANDIDATE_REPORT_PROVENANCE = [
	'packages/csaa/src/contracts/static-module-impact-candidate-report.ts',
	'packages/csaa/src/index.test.ts',
	'packages/csaa/src/index.ts',
	'packages/csaa/src/application/run-static-module-impact-candidate-report.ts',
	'packages/csaa/src/application/run-static-module-impact-candidate-report.test.ts',
	'packages/csaa/src/application/static-module-impact-candidate-command.test.ts',
	'scripts/csaa-static-module-impact-candidates.ts'
] as const;

const TYPESCRIPT_WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_PROVENANCE = [
	'packages/csaa/src/contracts/working-source-edit-impact-candidate-report.ts',
	'packages/csaa/src/impact/observe-working-source-edit.ts',
	'packages/csaa/src/impact/observe-working-source-edit.test.ts',
	'packages/csaa/src/semantic/monotonic-operation-clock.ts',
	'packages/csaa/src/application/run-working-source-edit-impact-candidate-report.ts',
	'packages/csaa/src/application/run-working-source-edit-impact-candidate-report.test.ts',
	'packages/csaa/src/index.test.ts',
	'packages/csaa/src/index.ts',
	'packages/csaa/src/application/working-source-edit-impact-candidate-command.test.ts',
	'scripts/csaa-working-source-edit-impact-candidates.ts'
] as const;

const JPWB_STRUCTURAL_MODULE_REACHABILITY_ONLY_SMOKE_COMMAND =
	'CSAA_REPOSITORY_SMOKE=1 CSAA_REPOSITORY_SMOKE_PROFILE=STRUCTURAL CSAA_REPOSITORY_SMOKE_SUITE=STRUCTURAL_MODULE_REACHABILITY vitest run --disableConsoleIntercept packages/csaa/src/semantic/repository-smoke.test.ts';

const JPWB_STRUCTURAL_MODULE_REACHABILITY_REPORT_COMMAND =
	'bun run scripts/csaa-structural-module-reachability.ts';

const JPWB_STATIC_MODULE_IMPACT_CANDIDATE_REPORT_COMMAND =
	'bun run scripts/csaa-static-module-impact-candidates.ts';

const JPWB_WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_COMMAND =
	'bun run scripts/csaa-working-source-edit-impact-candidates.ts';

const JPWB_STRUCTURAL_SCC_ONLY_SMOKE_COMMAND =
	'CSAA_REPOSITORY_SMOKE=1 CSAA_REPOSITORY_SMOKE_PROFILE=STRUCTURAL CSAA_REPOSITORY_SMOKE_SUITE=STRUCTURAL_SCC vitest run --disableConsoleIntercept packages/csaa/src/semantic/repository-smoke.test.ts';

const TYPESCRIPT_CALL_GRAPH_PROVENANCE = [
	'packages/csaa/src/contracts/call-graph.ts',
	'packages/csaa/src/graph/build-call-graph.ts',
	'packages/csaa/src/graph/call-graph-content.ts',
	'packages/csaa/src/graph/call-graph-ids.ts',
	'packages/csaa/src/graph/call-graph-input.ts',
	'packages/csaa/src/graph/validate-call-graph.ts'
] as const;

const TYPESCRIPT_CALL_GRAPH_REPORT_PROVENANCE = [
	'packages/csaa/src/contracts/call-graph-report.ts',
	'packages/csaa/src/index.test.ts',
	'packages/csaa/src/index.ts',
	'packages/csaa/src/application/call-graph-command.test.ts',
	'packages/csaa/src/application/call-graph-progress-jsonl.test.ts',
	'packages/csaa/src/application/call-graph-progress-jsonl.ts',
	'packages/csaa/src/application/run-call-graph-command.ts',
	'packages/csaa/src/application/run-call-graph-report.test.ts',
	'packages/csaa/src/application/run-call-graph-report.ts',
	'packages/csaa/src/application/run-project-context-report.ts',
	'packages/csaa/src/graph/build-call-graph.test.ts',
	'scripts/csaa-call-graph.ts'
] as const;

const JPWB_CALL_GRAPH_REPORT_COMMAND = 'bun scripts/csaa-call-graph.ts';

const TYPESCRIPT_LOGICAL_GRAPH_COMPOSITION_PROVENANCE = [
	'packages/csaa/src/contracts/logical-graph-composition.ts',
	'packages/csaa/src/graph/build-logical-graph-composition.ts',
	'packages/csaa/src/graph/logical-graph-composition-canonical.ts',
	'packages/csaa/src/graph/validate-logical-graph-composition.ts',
	'packages/csaa/src/graph/build-logical-graph-composition.test.ts',
	'packages/csaa/src/graph/logical-graph-composition-coverage.test.ts',
	'packages/csaa/src/semantic/repository-smoke.test.ts'
] as const;

const TYPESCRIPT_LOGICAL_GRAPH_COMPOSITION_REPORT_PROVENANCE = [
	'packages/csaa/src/application/logical-graph-composition-progress-jsonl.test.ts',
	'packages/csaa/src/application/logical-graph-composition-progress-jsonl.ts',
	'packages/csaa/src/application/run-logical-graph-composition-command.test.ts',
	'packages/csaa/src/application/run-logical-graph-composition-command.ts',
	'packages/csaa/src/application/run-logical-graph-composition-report.test.ts',
	'packages/csaa/src/application/run-logical-graph-composition-report.ts',
	'packages/csaa/src/application/run-project-context-report.ts',
	'packages/csaa/src/contracts/logical-graph-composition-report.ts',
	'packages/csaa/src/index.test.ts',
	'packages/csaa/src/index.ts',
	'scripts/csaa-logical-graph-composition.ts'
] as const;

const JPWB_LOGICAL_GRAPH_COMPOSITION_ONLY_SMOKE_COMMAND =
	'CSAA_REPOSITORY_SMOKE=1 CSAA_REPOSITORY_SMOKE_PROFILE=FULL CSAA_REPOSITORY_SMOKE_SUITE=LOGICAL_GRAPH_COMPOSITION vitest run --disableConsoleIntercept packages/csaa/src/semantic/repository-smoke.test.ts';

const TYPESCRIPT_PROJECT_CONTEXT_GRAPH_PROVENANCE = [
	'packages/csaa/src/contracts/project-context-graph.ts',
	'packages/csaa/src/graph/build-project-context-graph.ts',
	'packages/csaa/src/graph/project-context-graph-canonical.ts',
	'packages/csaa/src/graph/validate-project-context-graph.ts',
	'packages/csaa/src/graph/project-context-graph-fixture.test-support.ts',
	'packages/csaa/src/graph/build-project-context-graph.test.ts',
	'packages/csaa/src/graph/project-context-graph-coverage.test.ts',
	'packages/csaa/src/semantic/repository-smoke.test.ts'
] as const;

const TYPESCRIPT_PROJECT_CONTEXT_REPORT_PROVENANCE = [
	'packages/csaa/src/contracts/project-context-report.ts',
	'packages/csaa/src/application/run-project-context-report.ts',
	'packages/csaa/src/application/project-context-progress-jsonl.ts',
	'packages/csaa/src/application/run-project-context-report.test.ts',
	'packages/csaa/src/application/project-context-progress-jsonl.test.ts',
	'packages/csaa/src/application/project-context-command.test.ts',
	'packages/csaa/test-fixtures/project-context-command/package.json',
	'packages/csaa/test-fixtures/project-context-command/tsconfig.json',
	'packages/csaa/test-fixtures/project-context-command/left/tsconfig.json',
	'packages/csaa/test-fixtures/project-context-command/left/src/alpha.ts',
	'packages/csaa/test-fixtures/project-context-command/left/src/middle.ts',
	'packages/csaa/test-fixtures/project-context-command/left/src/zeta.ts',
	'packages/csaa/test-fixtures/project-context-command/right/tsconfig.json',
	'packages/csaa/test-fixtures/project-context-command/right/src/index.ts',
	'scripts/csaa-project-context.ts'
] as const;

const JPWB_PROJECT_CONTEXT_GRAPH_ONLY_SMOKE_COMMAND =
	'CSAA_REPOSITORY_SMOKE=1 CSAA_REPOSITORY_SMOKE_PROFILE=STRUCTURAL CSAA_REPOSITORY_SMOKE_SUITE=PROJECT_CONTEXT_GRAPH vitest run --disableConsoleIntercept packages/csaa/src/semantic/repository-smoke.test.ts';

const JPWB_PROJECT_CONTEXT_REPORT_COMMAND = 'bun run scripts/csaa-project-context.ts';

const TYPESCRIPT_CONDITIONAL_EXPORT_RESOLUTION_PROVENANCE = [
	'packages/csaa/src/contracts/conditional-export-resolution.ts',
	'packages/csaa/src/resolution/build-conditional-export-resolution.ts',
	'packages/csaa/src/resolution/conditional-export-resolution-canonical.ts',
	'packages/csaa/src/resolution/validate-conditional-export-resolution.ts',
	'packages/csaa/src/resolution/conditional-export-resolution-fixture.test-support.ts',
	'packages/csaa/src/resolution/build-conditional-export-resolution.test.ts',
	'packages/csaa/src/resolution/conditional-export-resolution-coverage.test.ts',
	'packages/csaa/src/semantic/repository-smoke.test.ts'
] as const;

const JPWB_CONDITIONAL_EXPORT_RESOLUTION_ONLY_SMOKE_COMMAND =
	'CSAA_REPOSITORY_SMOKE=1 CSAA_REPOSITORY_SMOKE_PROFILE=STRUCTURAL CSAA_REPOSITORY_SMOKE_SUITE=CONDITIONAL_EXPORT_RESOLUTION vitest run --disableConsoleIntercept packages/csaa/src/semantic/repository-smoke.test.ts';

const TYPESCRIPT_MODULE_RESOLUTION_TRACE_PROVENANCE = [
	'packages/csaa/src/contracts/module-resolution-trace.ts',
	'packages/csaa/src/index.test.ts',
	'packages/csaa/src/index.ts',
	'packages/csaa/src/providers/typescript/compiler-input-journal.ts',
	'packages/csaa/src/resolution/build-module-resolution-trace.test.ts',
	'packages/csaa/src/resolution/build-module-resolution-trace.ts',
	'packages/csaa/src/resolution/module-resolution-trace-canonical.ts',
	'packages/csaa/src/resolution/module-resolution-trace-coverage.test.ts',
	'packages/csaa/src/resolution/module-resolution-trace-fixture.test-support.ts',
	'packages/csaa/src/resolution/validate-module-resolution-trace.ts',
	'packages/csaa/src/semantic/build-static-semantic-snapshot.ts',
	'packages/csaa/src/semantic/compiler-capture-capability.ts',
	'packages/csaa/src/semantic/repository-smoke.test.ts'
] as const;

const TYPESCRIPT_MODULE_RESOLUTION_TRACE_REPORT_PROVENANCE = [
	'packages/csaa/src/contracts/module-resolution-trace-report.ts',
	'packages/csaa/src/application/run-module-resolution-trace-report.ts',
	'packages/csaa/src/application/run-module-resolution-trace-command.ts',
	'packages/csaa/src/application/module-resolution-trace-progress-jsonl.ts',
	'packages/csaa/src/application/run-module-resolution-trace-report.test.ts',
	'packages/csaa/src/application/module-resolution-trace-progress-jsonl.test.ts',
	'packages/csaa/src/application/module-resolution-trace-command.test.ts',
	'scripts/csaa-module-resolution-trace.ts'
] as const;

const JPWB_MODULE_RESOLUTION_TRACE_ONLY_SMOKE_COMMAND =
	'CSAA_REPOSITORY_SMOKE=1 CSAA_REPOSITORY_SMOKE_PROFILE=STRUCTURAL CSAA_REPOSITORY_SMOKE_SUITE=MODULE_RESOLUTION_TRACE vitest run --disableConsoleIntercept packages/csaa/src/semantic/repository-smoke.test.ts';

const JPWB_MODULE_RESOLUTION_TRACE_REPORT_COMMAND = 'bun scripts/csaa-module-resolution-trace.ts';

const TYPESCRIPT_DECLARATION_CONTEXT_ANALYSIS_PROVENANCE = [
	'packages/csaa/src/contracts/declaration-context-analysis.ts',
	'packages/csaa/src/index.test.ts',
	'packages/csaa/src/index.ts',
	'packages/csaa/src/providers/typescript/compiler-input-journal.ts',
	'packages/csaa/src/providers/typescript/frozen-compiler-host.ts',
	'packages/csaa/src/resolution/module-resolution-trace-fixture.test-support.ts',
	'packages/csaa/src/semantic/build-declaration-context-analysis.test.ts',
	'packages/csaa/src/semantic/build-declaration-context-analysis.ts',
	'packages/csaa/src/semantic/compiler-capture-capability.ts',
	'packages/csaa/src/semantic/compiler-project-program-capability.test.ts',
	'packages/csaa/src/semantic/compiler-project-program-capability.ts',
	'packages/csaa/src/semantic/canonical.ts',
	'packages/csaa/src/semantic/declaration-context-analysis-canonical.ts',
	'packages/csaa/src/semantic/declaration-context-analysis-coverage.test.ts',
	'packages/csaa/src/semantic/declaration-context-analysis-fixture.test-support.ts',
	'packages/csaa/src/semantic/repository-smoke.test.ts',
	'packages/csaa/src/semantic/validate-declaration-context-analysis.test.ts',
	'packages/csaa/src/semantic/validate-declaration-context-analysis.ts'
] as const;

const TYPESCRIPT_DECLARATION_CONTEXT_REPORT_PROVENANCE = [
	'packages/csaa/src/contracts/declaration-context-report.ts',
	'packages/csaa/src/contracts/module-resolution-trace-report.ts',
	'packages/csaa/src/index.test.ts',
	'packages/csaa/src/index.ts',
	'packages/csaa/src/application/declaration-context-command.test.ts',
	'packages/csaa/src/application/declaration-context-progress-jsonl.test.ts',
	'packages/csaa/src/application/run-declaration-context-report.ts',
	'packages/csaa/src/application/run-declaration-context-command.ts',
	'packages/csaa/src/application/declaration-context-progress-jsonl.ts',
	'packages/csaa/src/application/run-declaration-context-report.test.ts',
	'packages/csaa/src/application/run-module-resolution-trace-report.ts',
	'scripts/csaa-declaration-context.ts'
] as const;

const JPWB_DECLARATION_CONTEXT_ANALYSIS_ONLY_SMOKE_COMMAND =
	'CSAA_REPOSITORY_SMOKE=1 CSAA_REPOSITORY_SMOKE_PROFILE=STRUCTURAL CSAA_REPOSITORY_SMOKE_SUITE=DECLARATION_CONTEXT_ANALYSIS vitest run --disableConsoleIntercept packages/csaa/src/semantic/repository-smoke.test.ts';

const JPWB_DECLARATION_CONTEXT_REPORT_COMMAND = 'bun scripts/csaa-declaration-context.ts';

const TYPESCRIPT_SOURCE_ORIGIN_CORRELATION_PROVENANCE = [
	'package.json',
	'packages/csaa/src/contracts/source-origin-correlation.ts',
	'packages/csaa/src/index.test.ts',
	'packages/csaa/src/index.ts',
	'packages/csaa/src/providers/source-map/decode-source-map-v3.test.ts',
	'packages/csaa/src/providers/source-map/decode-source-map-v3.ts',
	'packages/csaa/src/providers/typescript/compiler-project-declaration-emission.test.ts',
	'packages/csaa/src/providers/typescript/compiler-project-declaration-emission.ts',
	'packages/csaa/src/semantic/build-source-origin-correlation.test.ts',
	'packages/csaa/src/semantic/build-source-origin-correlation.ts',
	'packages/csaa/src/semantic/compiler-project-program-capability.test.ts',
	'packages/csaa/src/semantic/compiler-project-program-capability.ts',
	'packages/csaa/src/semantic/repository-smoke.test.ts',
	'packages/csaa/src/semantic/source-origin-correlation-canonical.test.ts',
	'packages/csaa/src/semantic/source-origin-correlation-canonical.ts',
	'packages/csaa/src/semantic/source-origin-correlation-fixture.test-support.ts',
	'packages/csaa/src/semantic/validate-source-origin-correlation.test.ts',
	'packages/csaa/src/semantic/validate-source-origin-correlation.ts'
] as const;

const JPWB_SOURCE_ORIGIN_CORRELATION_ONLY_SMOKE_COMMAND =
	'CSAA_REPOSITORY_SMOKE=1 CSAA_REPOSITORY_SMOKE_PROFILE=STRUCTURAL CSAA_REPOSITORY_SMOKE_SUITE=SOURCE_ORIGIN_CORRELATION vitest run --disableConsoleIntercept packages/csaa/src/semantic/repository-smoke.test.ts';

const TYPESCRIPT_READ_WRITE_ACCESS_GRAPH_PROVENANCE = [
	'packages/csaa/src/contracts/read-write-access-graph.ts',
	'packages/csaa/src/graph/build-read-write-access-graph.ts',
	'packages/csaa/src/graph/read-write-access-graph-canonical.ts',
	'packages/csaa/src/graph/validate-read-write-access-graph.ts'
] as const;

const TYPESCRIPT_READ_WRITE_ACCESS_REPORT_PROVENANCE = [
	'packages/csaa/src/contracts/read-write-access-report.ts',
	'packages/csaa/src/index.test.ts',
	'packages/csaa/src/index.ts',
	'packages/csaa/src/application/read-write-access-command.test.ts',
	'packages/csaa/src/application/read-write-access-progress-jsonl.test.ts',
	'packages/csaa/src/application/read-write-access-progress-jsonl.ts',
	'packages/csaa/src/application/run-project-context-report.ts',
	'packages/csaa/src/application/run-read-write-access-command.ts',
	'packages/csaa/src/application/run-read-write-access-report.test.ts',
	'packages/csaa/src/application/run-read-write-access-report.ts',
	'scripts/csaa-read-write-access.ts'
] as const;

const JPWB_READ_WRITE_ACCESS_REPORT_COMMAND = 'bun scripts/csaa-read-write-access.ts';

const JPWB_COMMAND_HANDLER_GRAPH_PROVENANCE = [
	'packages/csaa/src/contracts/command-handler-graph.ts',
	'packages/csaa/src/graph/build-command-handler-graph.ts',
	'packages/csaa/src/graph/command-handler-graph-canonical.ts',
	'packages/csaa/src/graph/validate-command-handler-graph.ts'
] as const;

const JPWB_COMMAND_HANDLER_GRAPH_REPORT_PROVENANCE = [
	'packages/csaa/src/application/command-handler-graph-command.test.ts',
	'packages/csaa/src/application/command-handler-graph-progress-jsonl.test.ts',
	'packages/csaa/src/application/command-handler-graph-progress-jsonl.ts',
	'packages/csaa/src/application/run-command-handler-graph-command.ts',
	'packages/csaa/src/application/run-command-handler-graph-report.test.ts',
	'packages/csaa/src/application/run-command-handler-graph-report.ts',
	'packages/csaa/src/application/run-project-context-report.test.ts',
	'packages/csaa/src/application/run-project-context-report.ts',
	'packages/csaa/src/contracts/command-handler-graph-report.ts',
	'packages/csaa/src/index.test.ts',
	'packages/csaa/src/index.ts',
	'scripts/csaa-command-handler-graph.ts'
] as const;

const JPWB_COMMAND_EVENT_CONTRACT_OVERLAY_PROVENANCE = [
	'packages/csaa/src/contracts/command-event-contract-overlay.ts',
	'packages/csaa/src/graph/build-command-event-contract-overlay.ts',
	'packages/csaa/src/graph/command-event-contract-overlay-canonical.ts',
	'packages/csaa/src/graph/validate-command-event-contract-overlay.ts',
	'packages/csaa/src/semantic/repository-smoke.test.ts'
] as const;

const JPWB_COMMAND_EVENT_CONTRACT_OVERLAY_INPUT_PROVENANCE = [
	COMMAND_EVENT_CONTRACT_OVERLAY_PROJECT_CONFIG_PATH,
	COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH,
	COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH,
	COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH
] as const;

const JPWB_COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROVENANCE = [
	'packages/csaa/src/application/command-event-contract-overlay-progress-jsonl.test.ts',
	'packages/csaa/src/application/command-event-contract-overlay-progress-jsonl.ts',
	'packages/csaa/src/application/run-command-event-contract-overlay-command.test.ts',
	'packages/csaa/src/application/run-command-event-contract-overlay-command.ts',
	'packages/csaa/src/application/run-command-event-contract-overlay-report.test.ts',
	'packages/csaa/src/application/run-command-event-contract-overlay-report.ts',
	'packages/csaa/src/application/run-command-handler-graph-report.test.ts',
	'packages/csaa/src/application/run-command-handler-graph-report.ts',
	'packages/csaa/src/contracts/command-event-contract-overlay-report.ts',
	'packages/csaa/src/graph/command-event-contract-overlay-fixture.test-support.ts',
	'packages/csaa/src/graph/command-handler-graph-fixture.test-support.ts',
	'packages/csaa/src/index.test.ts',
	'packages/csaa/src/index.ts',
	'scripts/csaa-command-event-contract-overlay.ts'
] as const;

const JPWB_COMMAND_DISPATCH_TOPOLOGY_PROVENANCE = [
	'packages/csaa/src/contracts/command-dispatch-topology.ts',
	'packages/csaa/src/graph/build-command-dispatch-topology.ts',
	'packages/csaa/src/graph/command-dispatch-topology-canonical.ts',
	'packages/csaa/src/graph/validate-command-dispatch-topology.ts'
] as const;

const JPWB_COMMAND_DISPATCH_TOPOLOGY_REPORT_PROVENANCE = [
	'packages/csaa/src/application/command-dispatch-topology-command.test.ts',
	'packages/csaa/src/application/command-dispatch-topology-progress-jsonl.test.ts',
	'packages/csaa/src/application/command-dispatch-topology-progress-jsonl.ts',
	'packages/csaa/src/application/run-command-dispatch-topology-command.ts',
	'packages/csaa/src/application/run-command-dispatch-topology-report.test.ts',
	'packages/csaa/src/application/run-command-dispatch-topology-report.ts',
	'packages/csaa/src/application/run-command-handler-graph-report.test.ts',
	'packages/csaa/src/application/run-command-handler-graph-report.ts',
	'packages/csaa/src/contracts/command-dispatch-topology-report.ts',
	'packages/csaa/src/graph/command-dispatch-topology-fixture.test-support.ts',
	'packages/csaa/src/graph/command-handler-graph-fixture.test-support.ts',
	'packages/csaa/src/index.test.ts',
	'packages/csaa/src/index.ts',
	'scripts/csaa-command-dispatch-topology.ts'
] as const;

const JPWB_COMMAND_DISPATCH_RETAINED_CENSUS_REFERENCE = [
	'verif/command-dispatch-census.test.ts'
] as const;

const JPWB_GUARD_ENFORCEMENT_LEDGER_PROVENANCE = [
	'packages/csaa/src/contracts/guard-enforcement-ledger.ts',
	'packages/csaa/src/providers/jpwb-guard-enforcement-ledger/artifact-set.ts',
	'packages/csaa/src/providers/jpwb-guard-enforcement-ledger/guard-enforcement-ledger-content.ts',
	'packages/csaa/src/providers/jpwb-guard-enforcement-ledger/normalize-guard-enforcement-ledger.ts',
	'packages/csaa/src/providers/jpwb-guard-enforcement-ledger/observe-guard-enforcement-ledger.ts',
	'packages/csaa/src/providers/jpwb-guard-enforcement-ledger/parse-worker-output.ts',
	'packages/csaa/src/providers/jpwb-guard-enforcement-ledger/validate-guard-enforcement-ledger.ts',
	'packages/csaa/src/providers/jpwb-guard-enforcement-ledger/worker.ts',
	'packages/csaa/src/providers/jpwb-arrow-command-census/executor-environment.ts',
	// The Qualification cell asserts a DERIVED capsule membership; this is the module that performs the
	// derivation. Without it the claim beside it cites no implementing file — the same shape of gap the claim
	// itself was written to close.
	'packages/csaa/src/subject/analyzer-closure.ts'
] as const;

const JPWB_GUARD_ENFORCEMENT_LEDGER_RETAINED_PROVENANCE = [
	'verif/guard-enforcement-ledger.data.ts',
	'verif/guard-enforcement-ledger.test.ts',
	'verif/guard-enforcement-ledger.ts'
] as const;

const JPWB_GUARD_ENFORCEMENT_LEDGER_REPORT_PROVENANCE = [
	GUARD_ENFORCEMENT_LEDGER_REPORT_ANALYZER_DEPENDENCY_PATH,
	'packages/csaa/src/application/guard-enforcement-ledger-command.test.ts',
	'packages/csaa/src/application/guard-enforcement-ledger-progress-jsonl.test.ts',
	'packages/csaa/src/application/guard-enforcement-ledger-progress-jsonl.ts',
	'packages/csaa/src/application/run-guard-enforcement-ledger-command.ts',
	'packages/csaa/src/application/run-guard-enforcement-ledger-report.test.ts',
	'packages/csaa/src/application/run-guard-enforcement-ledger-report.ts',
	'packages/csaa/src/contracts/guard-enforcement-ledger-report.ts',
	'packages/csaa/src/index.test.ts',
	'packages/csaa/src/index.ts',
	'scripts/csaa-guard-enforcement-ledger.ts'
] as const;

const JPWB_GUARD_CLASSIFICATION_OVERLAY_PROVENANCE = [
	'packages/csaa/src/contracts/guard-classification-overlay.ts',
	'packages/csaa/src/graph/build-guard-classification-overlay.ts',
	'packages/csaa/src/graph/guard-classification-overlay-canonical.ts',
	'packages/csaa/src/graph/validate-guard-classification-overlay.ts',
	'packages/csaa/src/semantic/repository-smoke.test.ts'
] as const;

const JPWB_GUARD_CLASSIFICATION_OVERLAY_REPORT_PROVENANCE = [
	GUARD_CLASSIFICATION_OVERLAY_REPORT_STATE_SOURCE.logicalPath,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_STATE_SOURCE.projectConfigPath,
	'packages/csaa/src/application/guard-classification-overlay-progress-jsonl.test.ts',
	'packages/csaa/src/application/guard-classification-overlay-progress-jsonl.ts',
	'packages/csaa/src/application/run-guard-classification-overlay-command.test.ts',
	'packages/csaa/src/application/run-guard-classification-overlay-command.ts',
	'packages/csaa/src/application/run-guard-classification-overlay-report.test.ts',
	'packages/csaa/src/application/run-guard-classification-overlay-report.ts',
	'packages/csaa/src/application/run-command-handler-graph-report.test.ts',
	'packages/csaa/src/application/run-command-handler-graph-report.ts',
	'packages/csaa/src/contracts/guard-classification-overlay-report.ts',
	'packages/csaa/src/graph/command-handler-graph-fixture.test-support.ts',
	'packages/csaa/src/graph/guard-classification-overlay-fixture.test-support.ts',
	'packages/csaa/src/index.test.ts',
	'packages/csaa/src/index.ts',
	'scripts/csaa-guard-classification-overlay.ts'
] as const;

const JPWB_STATE_MACHINE_GRAPH_PROVENANCE = [
	'packages/csaa/src/contracts/state-machine-graph.ts',
	'packages/csaa/src/graph/build-state-machine-graph.ts',
	'packages/csaa/src/graph/state-machine-graph-content.ts',
	'packages/csaa/src/graph/state-machine-graph-ids.ts',
	'packages/csaa/src/graph/state-machine-graph-input.ts',
	'packages/csaa/src/graph/validate-state-machine-graph.ts',
	'packages/csaa/src/providers/jpwb-state-machines/observe-state-machines.ts',
	'packages/csaa/src/providers/jpwb-state-machines/validate-state-machine-observation.ts'
] as const;

const JPWB_STATE_MACHINE_GRAPH_REPORT_PROVENANCE = [
	'packages/csaa/command-subjects/state-machine-graph/transitions.data.ts',
	'packages/csaa/command-subjects/state-machine-graph/tsconfig.json',
	'packages/csaa/src/application/run-project-context-report.ts',
	'packages/csaa/src/application/run-state-machine-graph-command.ts',
	'packages/csaa/src/application/run-state-machine-graph-report.test.ts',
	'packages/csaa/src/application/run-state-machine-graph-report.ts',
	'packages/csaa/src/application/state-machine-graph-command.test.ts',
	'packages/csaa/src/application/state-machine-graph-progress-jsonl.test.ts',
	'packages/csaa/src/application/state-machine-graph-progress-jsonl.ts',
	'packages/csaa/src/contracts/state-machine-graph-report.ts',
	'packages/csaa/src/index.test.ts',
	'packages/csaa/src/index.ts',
	'scripts/csaa-state-machine-graph.ts'
] as const;

const JPWB_ARROW_COMMAND_CENSUS_PROVENANCE = [
	'packages/csaa/src/contracts/arrow-command-census.ts',
	'packages/csaa/src/providers/jpwb-arrow-command-census/arrow-command-census-content.ts',
	'packages/csaa/src/providers/jpwb-arrow-command-census/artifact-set.ts',
	'packages/csaa/src/providers/jpwb-arrow-command-census/executor-environment.ts',
	'packages/csaa/src/providers/jpwb-arrow-command-census/normalize-arrow-command-census.ts',
	'packages/csaa/src/providers/jpwb-arrow-command-census/observe-arrow-command-census.ts',
	'packages/csaa/src/providers/jpwb-arrow-command-census/parse-worker-output.ts',
	'packages/csaa/src/providers/jpwb-arrow-command-census/validate-arrow-command-census.ts',
	'packages/csaa/src/providers/jpwb-arrow-command-census/worker.ts',
	// This provider's capsule membership is DERIVED too, as of W-6; this is the module that performs the
	// derivation. Listed for the same reason as in the guard-enforcement-ledger provenance above — a claim of
	// derived membership that cites no implementing file is the gap the claim was written to close.
	'packages/csaa/src/subject/analyzer-closure.ts'
] as const;

// Keep this inventory-layer projection reconciled in inventory.test.ts with the provider's
// exported canonical path set. Importing artifact-set.ts here would invert its existing
// dependency on inventory/canonical.ts and introduce a production module cycle.
const JPWB_ARROW_COMMAND_CENSUS_RETAINED_PROVENANCE = [
	'verif/arrow-census-coverage.test.ts',
	'verif/arrow-command-census.ts',
	'verif/arrow-command-census.baseline.json',
	'verif/arrow-command-census.test.ts'
] as const;

const JPWB_ARROW_COMMAND_CENSUS_REPORT_PROVENANCE = [
	'packages/csaa/src/application/arrow-command-census-command.test.ts',
	'packages/csaa/src/application/arrow-command-census-progress-jsonl.test.ts',
	'packages/csaa/src/application/arrow-command-census-progress-jsonl.ts',
	'packages/csaa/src/application/run-arrow-command-census-command.ts',
	'packages/csaa/src/application/run-arrow-command-census-report.test.ts',
	'packages/csaa/src/application/run-arrow-command-census-report.ts',
	'packages/csaa/src/contracts/arrow-command-census-report.ts',
	'packages/csaa/src/index.test.ts',
	'packages/csaa/src/index.ts',
	'scripts/csaa-arrow-command-census.ts'
] as const;

const EXISTING_GRAPH_RELEVANT_VERIFICATION_AUTHORITY = [
	'verif/arrow-census-coverage.test.ts',
	'verif/arrow-command-census.baseline.json',
	'verif/arrow-command-census.test.ts',
	'verif/arrow-command-census.ts',
	'verif/authority-resolution-census.test.ts',
	'verif/births-outside-the-census.test.ts',
	'verif/command-dispatch-census.test.ts',
	'verif/contract-number-census.test.ts',
	'verif/dead-kernel-census.test.ts',
	'verif/event-surface-census.test.ts',
	'verif/policy-evidence-requirement-census.test.ts',
	'verif/route-action-census.test.ts'
] as const;

const DEPENDENCY_CRUISER_CORROBORATION_PROVENANCE = [
	'packages/csaa/src/contracts/dependency-comparison.ts',
	'packages/csaa/src/contracts/dependency-cruiser.ts',
	'packages/csaa/src/graph/compare-dependency-providers.ts',
	'packages/csaa/src/graph/validate-dependency-comparison.ts',
	'packages/csaa/src/providers/dependency-cruiser/normalize-output.ts',
	'packages/csaa/src/providers/dependency-cruiser/schema/cruise-result-16.10.4.schema.json',
	'packages/csaa/src/providers/dependency-cruiser/validate-raw-wire-schema.ts'
] as const;

const TYPESCRIPT_SEMANTIC_PROVENANCE = [
	...TYPESCRIPT_AST_PROVENANCE,
	...TYPESCRIPT_SYMBOL_PROVENANCE,
	...TYPESCRIPT_TYPE_PROVENANCE
] as const;

const TYPESCRIPT_STRUCTURAL_SEMANTIC_PROVENANCE = [
	...TYPESCRIPT_AST_PROVENANCE,
	...TYPESCRIPT_SYMBOL_PROVENANCE
] as const;

const TYPESCRIPT_ADAPTER_CAPABILITIES = [
	'TS_PROJECT',
	'TS_SYMBOL',
	'TS_SYNTAX',
	'TS_TYPE',
	'configuration-ast-parse',
	'command-dispatch-static-topology',
	'command-event-contract-static-overlay',
	'command-handler-static-projection',
	'conditional-export-resolution',
	'declaration-context-analysis',
	'frozen-program-construction',
	'guard-classification-static-overlay',
	'jpwb-harmonization-native-projection',
	'logical-graph-composition',
	'module-code-slice',
	'module-resolution-trace',
	'project-context-graph',
	'read-write-access-projection',
	'semantic-source-query',
	'semantic-snapshot-comparison',
	'source-origin-correlation',
	'static-module-impact-candidates',
	'structural-module-reachability-analysis',
	'structural-scc-analysis',
	'working-source-edit-impact-candidates'
] as const;

const PROVIDER_EVIDENCE_IMPORT_PROVENANCE = [
	'packages/csaa/src/providers/runtime/provider-evidence.test.ts',
	'packages/csaa/src/providers/runtime/provider-evidence.ts'
] as const;

const ESLINT_RESULT_INGESTION_PROVENANCE = [
	...PROVIDER_EVIDENCE_IMPORT_PROVENANCE,
	'packages/csaa/src/providers/eslint/import-eslint-json.test.ts',
	'packages/csaa/src/providers/eslint/import-eslint-json.ts'
] as const;

const VITEST_RESULT_INGESTION_PROVENANCE = [
	...PROVIDER_EVIDENCE_IMPORT_PROVENANCE,
	'packages/csaa/src/providers/vitest/import-vitest-json.test.ts',
	'packages/csaa/src/providers/vitest/import-vitest-json.ts'
] as const;

const VITEST_V8_COVERAGE_INGESTION_PROVENANCE = [
	...PROVIDER_EVIDENCE_IMPORT_PROVENANCE,
	'packages/csaa/src/providers/coverage/import-vitest-v8-coverage.test.ts',
	'packages/csaa/src/providers/coverage/import-vitest-v8-coverage.ts',
	'packages/csaa/src/providers/source-map/decode-source-map-v3.ts'
] as const;

const RUNTIME_TRACE_PROVENANCE = [
	...PROVIDER_EVIDENCE_IMPORT_PROVENANCE,
	'packages/csaa/src/providers/runtime/import-runtime-trace.test.ts',
	'packages/csaa/src/providers/runtime/import-runtime-trace.ts'
] as const;

const HYBRID_RUNTIME_EVALUATION_PROVENANCE = [
	...RUNTIME_TRACE_PROVENANCE,
	'packages/csaa/src/cli/compose-coding-agent-cli-handlers.test.ts',
	'packages/csaa/src/cli/compose-coding-agent-cli-handlers.ts',
	'packages/csaa/src/cli/current-jpwb-coding-agent-workflow.integration.test.ts',
	'packages/csaa/src/providers/runtime/evaluate-hybrid-runtime.ts',
	'packages/csaa/src/providers/runtime/project-hybrid-static-prerequisites.test.ts',
	'packages/csaa/src/providers/runtime/project-hybrid-static-prerequisites.ts'
] as const;

const JPWB_NATIVE_SECURITY_PROVENANCE = [
	'packages/csaa/src/providers/security/observe-jpwb-security.test.ts',
	'packages/csaa/src/providers/security/observe-jpwb-security.ts'
] as const;

const FOUR_VALUED_QUERY_OPERATION_PROVENANCE = [
	'packages/csaa/src/query/four-valued-query-algebra.test.ts',
	'packages/csaa/src/query/four-valued-query-algebra.ts',
	'packages/csaa/src/query/four-valued-query-operation.test.ts',
	'packages/csaa/src/query/four-valued-query-operation.ts'
] as const;

const MODULE_CODE_SLICE_PROVENANCE = [
	'packages/csaa/src/query/module-code-slice.test.ts',
	'packages/csaa/src/query/module-code-slice.ts'
] as const;

const SEMANTIC_SNAPSHOT_COMPARISON_PROVENANCE = [
	'packages/csaa/src/impact/semantic-snapshot-comparison.test.ts',
	'packages/csaa/src/impact/semantic-snapshot-comparison.ts'
] as const;

const HARMONIZATION_RULE_EVALUATION_PROVENANCE = [
	'packages/csaa/src/rules/harmonization-first-increment-rules.test.ts',
	'packages/csaa/src/rules/harmonization-first-increment-rules.ts'
] as const;

const HARMONIZATION_BENCHMARK_ACCOUNTING_PROVENANCE = [
	'packages/csaa/src/rules/harmonization-benchmark-accounting.test.ts',
	'packages/csaa/src/rules/harmonization-benchmark-accounting.ts',
	'packages/csaa/src/rules/harmonization-benchmark-baseline.ts'
] as const;

const JPWB_HARMONIZATION_NATIVE_PROJECTION_PROVENANCE = [
	...HARMONIZATION_RULE_EVALUATION_PROVENANCE,
	'packages/csaa/src/cli/current-jpwb-coding-agent-workflow.integration.test.ts',
	'packages/csaa/src/rules/jpwb-harmonization-native-projection.test.ts',
	'packages/csaa/src/rules/jpwb-harmonization-native-projection.ts'
] as const;

const CODING_AGENT_CLI_PROCESS_PROVENANCE = [
	'package.json',
	'packages/csaa/README.md',
	'packages/csaa/package.json',
	'packages/csaa/command-subjects/current-jpwb-coding-agent/tsconfig.json',
	'packages/csaa/src/cli/coding-agent-cli-contract.ts',
	'packages/csaa/src/cli/coding-agent-process.spawn.integration.test.ts',
	'packages/csaa/src/cli/compose-coding-agent-cli-handlers.test.ts',
	'packages/csaa/src/cli/compose-coding-agent-cli-handlers.ts',
	'packages/csaa/src/cli/current-jpwb-coding-agent-workflow.integration.test.ts',
	'packages/csaa/src/cli/run-coding-agent-cli.test.ts',
	'packages/csaa/src/cli/run-coding-agent-cli.ts',
	'packages/csaa/src/cli/run-coding-agent-process-host.test.ts',
	'packages/csaa/src/cli/run-coding-agent-process-host.ts',
	'packages/csaa/src/cli/run-coding-agent-process.test.ts',
	'packages/csaa/src/cli/run-coding-agent-process.ts',
	'packages/csaa/src/providers/emitted-worker-path-smoke.test.ts',
	'scripts/csaa-coding-agent.ts',
	'scripts/csaa-technical-completion.ts',
	'scripts/mutants/ledger.ts',
	'scripts/mutants/run.ts',
	'scripts/mutants/tree-baseline.ts',
	'verif/csaa-technical-completion.test.ts',
	'verif/mutation-tree-baseline.test.ts'
] as const;

const CONTENT_ADDRESSED_PERSISTENCE_PROVENANCE = [
	'packages/csaa/src/cli/content-addressed-coding-agent-cli-artifact-store.test.ts',
	'packages/csaa/src/cli/content-addressed-coding-agent-cli-artifact-store.ts',
	'packages/csaa/src/persistence/content-addressed-file-store.test.ts',
	'packages/csaa/src/persistence/content-addressed-file-store.ts',
	'packages/csaa/src/persistence/measure-content-addressed-file-store-performance.test.ts',
	'packages/csaa/src/persistence/measure-content-addressed-file-store-performance.ts',
	'packages/csaa/src/persistence/assess-dwp-007-persistence-selection.test.ts',
	'packages/csaa/src/persistence/assess-dwp-007-persistence-selection.ts',
	'packages/csaa/src/persistence/run-dwp-007-persistence-selection.ts',
	'scripts/csaa-content-store-performance.ts',
	'verif/csaa/dwp-007.content-addressed-store.cold-warm.evidence.json',
	'verif/csaa/dwp-007.persistence-selection.evidence.json'
] as const;

const ADVANCED_CPG_PROVIDER_DISPOSITION_PROVENANCE = [
	'packages/csaa/src/providers/experimental/assess-advanced-cpg-provider-entry.test.ts',
	'packages/csaa/src/providers/experimental/assess-advanced-cpg-provider-entry.ts',
	'verif/csaa/experimental/dwp-009.local-provider-disposition.evidence.json'
] as const;

const CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_PROVENANCE = [
	...DEPENDENCY_CRUISER_CORROBORATION_PROVENANCE,
	'package.json',
	'packages/csaa/README.md',
	'packages/csaa/package.json',
	'packages/csaa/src/graph/assess-dependency-cruiser-differential.test.ts',
	'packages/csaa/src/graph/assess-dependency-cruiser-differential.ts',
	'packages/csaa/src/graph/current-dependency-cruiser-differential.integration.test.ts',
	'packages/csaa/src/graph/run-current-dependency-cruiser-differential.test.ts',
	'packages/csaa/src/graph/run-current-dependency-cruiser-differential.ts',
	'packages/csaa/src/index-roadmap-completion.test.ts',
	'packages/csaa/src/index.ts',
	'scripts/csaa-dependency-cruiser-differential.ts'
] as const;

const CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_EVIDENCE_PATH =
	'verif/csaa/dwp-004.current-dependency-cruiser-differential.evidence.json';
const CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_EVIDENCE_PATH =
	'verif/csaa/dwp-004.rph-contracts-build-same-perimeter-differential.evidence.json';

function canonicalProvenance(...paths: readonly string[]): string[] {
	return [...new Set(paths)].sort(compareText);
}

export interface CollectInventoryOptions {
	readonly repositoryRoot: string;
	readonly requireJpwbPopulations?: boolean;
}

function object(value: unknown, description: string): JsonObject {
	if (value === null || Array.isArray(value) || typeof value !== 'object') {
		throw new Error(`${description} must be a JSON object`);
	}
	return value as JsonObject;
}

function stringArray(value: unknown, description: string): string[] {
	if (value === undefined) return [];
	if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
		throw new Error(`${description} must be an array of strings`);
	}
	return [...value].sort(compareText) as string[];
}

function frozenText(subject: FrozenSubject, path: string): string {
	const bytes = readFrozenSubjectArtifact(subject, path);
	if (bytes === undefined) throw new Error(`Frozen subject artifact is absent: ${path}`);
	return Buffer.from(bytes).toString('utf8');
}

function readJsonObject(subject: FrozenSubject, path: string, description: string): JsonObject {
	let parsed: unknown;
	try {
		parsed = JSON.parse(frozenText(subject, path));
	} catch (error) {
		throw new Error(`Unreadable ${description} at ${path}: ${String(error)}`);
	}
	return object(parsed, description);
}

function sortedRecord(value: unknown, description: string): Record<string, string> {
	if (value === undefined) return {};
	const record = object(value, description);
	const out: Record<string, string> = {};
	for (const key of Object.keys(record).sort(compareText)) {
		if (typeof record[key] !== 'string') throw new Error(`${description}.${key} must be a string`);
		out[key] = record[key];
	}
	return out;
}

function dependencyDeclarations(
	manifest: JsonObject,
	manifestPath: string
): DependencyDeclaration[] {
	const scopes = [
		'dependencies',
		'devDependencies',
		'optionalDependencies',
		'peerDependencies'
	] as const;
	const declarations: DependencyDeclaration[] = [];
	for (const scope of scopes) {
		const values = sortedRecord(manifest[scope], `${manifestPath}#/${scope}`);
		for (const [name, specifier] of Object.entries(values))
			declarations.push({ name, scope, specifier });
	}
	return declarations.sort((left, right) =>
		compareText(`${left.scope}\0${left.name}`, `${right.scope}\0${right.name}`)
	);
}

function inventoryArtifactClass(
	primaryClass: FrozenSubject['artifacts'][number]['primaryClass']
): ArtifactClass {
	switch (primaryClass) {
		case 'MANIFEST':
		case 'LOCKFILE':
		case 'TOOL_CONFIGURATION':
		case 'PROJECT_CONFIGURATION':
		case 'GENERATED_CONFIGURATION':
			return 'CONFIGURATION';
		case 'PRODUCTION_SOURCE':
			return 'SOURCE';
		case 'TEST_SOURCE':
			return 'TEST';
		case 'GENERATED_SOURCE':
			return 'GENERATED_SOURCE';
		case 'GENERATOR_SOURCE':
		case 'SCRIPT':
			return 'SCRIPT';
		case 'VERIFICATION':
			return 'VERIFICATION';
		case 'BUILD_OUTPUT':
		case 'CACHE':
		case 'EXTERNAL_DEPENDENCY':
		case 'VENDOR':
		case 'OTHER':
			return 'OTHER';
	}
}

function projectSelectedFiles(subject: FrozenSubject): SelectedFileRecord[] {
	return subject.artifacts.map((artifact) => ({
		artifactClass: inventoryArtifactClass(artifact.primaryClass),
		bytes: artifact.bytes,
		path: artifact.path,
		sha256: artifact.sha256,
		subjectArtifactClass: artifact.primaryClass
	}));
}

function projectWorkspaces(subject: FrozenSubject): WorkspaceInventory[] {
	return subject.workspaces.map((workspace) => {
		const manifest = readJsonObject(
			subject,
			workspace.manifestPath,
			`workspace manifest ${workspace.manifestPath}`
		);
		return {
			dependencies: dependencyDeclarations(manifest, workspace.manifestPath),
			exportsState: manifest.exports === undefined ? 'NOT_DECLARED' : 'DECLARED',
			kind: workspace.kind,
			manifestPath: workspace.manifestPath,
			name: workspace.name,
			path: workspace.path,
			private: workspace.private,
			provenance: workspace.provenance,
			scripts: sortedRecord(manifest.scripts, `${workspace.manifestPath}#/scripts`),
			version: typeof manifest.version === 'string' ? manifest.version : null
		};
	});
}

function projectTypeScriptProjects(subject: FrozenSubject): TypeScriptProjectInventory[] {
	return subject.projects.map((project) => {
		const generatedContexts = subject.generatedContexts.filter(
			(context) => context.consumerProject === project.configPath
		);
		const generatedPaths = new Set(generatedContexts.map((context) => context.path));
		const generatedDiagnostics = subject.diagnostics.filter(
			(diagnostic) =>
				(diagnostic.code === 'GENERATED_CONTEXT_ABSENT' &&
					diagnostic.path === project.configPath) ||
				(diagnostic.phase === 'FRESHNESS' &&
					diagnostic.path !== null &&
					generatedPaths.has(diagnostic.path))
		);
		const partialityReasons: TypeScriptProjectInventory['partialityReasons'][number][] = [];
		if (project.rootDisposition === 'INCOMPLETE')
			partialityReasons.push({
				code: 'ROOT_DISPOSITION_INCOMPLETE',
				message:
					'TypeScript did not produce a complete compiler-root disposition for this project.',
				path: project.configPath,
				provenance: ['project.rootDisposition']
			});
		if (project.frameworkCandidates.length > 0)
			partialityReasons.push({
				code: 'FRAMEWORK_CANDIDATES_PRESENT',
				message: `${project.frameworkCandidates.length} framework candidate(s) remain outside the DWP-002 TypeScript compiler-root model.`,
				path: project.configPath,
				provenance: ['project.frameworkCandidates']
			});
		for (const diagnostic of project.typescriptDiagnostics.filter(
			(item) => item.severity === 'ERROR' || item.code === 'TYPESCRIPT_PROJECT_PARTIAL'
		))
			partialityReasons.push({
				code: diagnostic.code,
				message: diagnostic.message,
				path: diagnostic.path,
				provenance: ['project.typescriptDiagnostics']
			});
		for (const diagnostic of generatedDiagnostics)
			partialityReasons.push({
				code: diagnostic.code,
				message: diagnostic.message,
				path: diagnostic.path,
				provenance: ['subject.diagnostics', 'subject.generatedContexts']
			});
		for (const context of generatedContexts.filter((item) => item.freshness === 'STALE'))
			partialityReasons.push({
				code: 'GENERATED_CONTEXT_STALE',
				message: context.freshnessBasis,
				path: context.path,
				provenance: ['subject.generatedContexts']
			});
		return {
			candidateArtifactCount: project.fileNames.length + project.frameworkCandidates.length,
			compilerOptions: project.rawCompilerOptions,
			diagnostics: project.typescriptDiagnostics,
			diagnosticsState: 'RUN',
			exclude: project.rawExclude,
			extends: project.rawExtends,
			files: project.rawFiles,
			frameworkCandidates: project.frameworkCandidates,
			generatedContexts,
			include: project.rawInclude,
			partialityReasons,
			parseState: 'PARSED',
			path: project.configPath,
			provenance: [project.configPath, ...project.configClosure.map((item) => item.path)],
			references: project.projectReferences,
			resolvedRootFiles: project.fileNames,
			resolvedRootState: 'RESOLVED_DWP002',
			rootDisposition: project.rootDisposition,
			semanticOptionCoverage: 'COMPLETE_RAW_DECLARATION',
			status: project.status
		};
	});
}

function commandCategories(name: string): string[] {
	const categories: string[] = [];
	for (const [category, pattern] of [
		['BOUNDARY', /boundary/],
		['BUILD', /build/],
		['COVERAGE', /coverage/],
		['E2E', /e2e/],
		['FRAMEWORK_CHECK', /check(?!-types)/],
		['GENERATION', /(?:^|:)gen/],
		['LINT', /lint|format/],
		['MUTATION', /mutant/],
		['TEST', /test|gate/],
		['TYPE_CHECK', /check-types/]
	] as const) {
		if (pattern.test(name)) categories.push(category);
	}
	return categories.length > 0 ? categories : ['OTHER'];
}

function commands(
	rootManifest: JsonObject,
	workspaces: readonly WorkspaceInventory[]
): CommandInventory[] {
	const out: CommandInventory[] = [];
	const add = (owner: string, manifestPath: string, scripts: Readonly<Record<string, string>>) => {
		for (const [name, command] of Object.entries(scripts)) {
			out.push({
				categories: commandCategories(name),
				command,
				name,
				owner,
				provenance: [`${manifestPath}#/scripts/${name}`],
				state: 'CONFIGURED_NOT_RUN'
			});
		}
	};
	add('.', 'package.json', sortedRecord(rootManifest.scripts, 'package.json#/scripts'));
	for (const workspace of workspaces)
		add(workspace.path, workspace.manifestPath, workspace.scripts);
	return sortUniqueBy(out, (entry) => `${entry.owner}\0${entry.name}`, 'configured command');
}

function propertyName(name: ts.PropertyName | undefined): string | undefined {
	if (!name) return undefined;
	if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name))
		return name.text;
	return undefined;
}

function arrayLiteralValue(node: ts.ArrayLiteralExpression): unknown {
	const values = node.elements.map((element) =>
		ts.isSpreadElement(element) ? undefined : literalValue(element as ts.Expression)
	);
	return values.includes(undefined) ? undefined : values;
}

function objectLiteralValue(node: ts.ObjectLiteralExpression): unknown {
	const value: Record<string, unknown> = {};
	for (const child of node.properties) {
		if (!ts.isPropertyAssignment(child)) return undefined;
		const key = propertyName(child.name);
		const literal = literalValue(child.initializer);
		if (key === undefined || literal === undefined) return undefined;
		value[key] = literal;
	}
	return value;
}

function literalValue(node: ts.Expression): unknown {
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
	if (ts.isNumericLiteral(node)) return Number(node.text);
	if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
	if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
	if (ts.isArrayLiteralExpression(node)) return arrayLiteralValue(node);
	if (ts.isObjectLiteralExpression(node)) return objectLiteralValue(node);
	return undefined;
}

function findObjectProperty(
	source: string,
	fileName: string,
	wanted: string
): JsonObject | undefined {
	const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
	let result: JsonObject | undefined;
	const visit = (node: ts.Node) => {
		if (
			result === undefined &&
			ts.isPropertyAssignment(node) &&
			propertyName(node.name) === wanted &&
			ts.isObjectLiteralExpression(node.initializer)
		) {
			const value = literalValue(node.initializer);
			if (value !== undefined) result = object(value, `${fileName}#/${wanted}`);
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	return result;
}

function booleanPropertyValues(source: string, fileName: string, wanted: string): boolean[] {
	const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
	const values = new Set<boolean>();
	const visit = (node: ts.Node) => {
		if (ts.isPropertyAssignment(node) && propertyName(node.name) === wanted) {
			const value = literalValue(node.initializer);
			if (typeof value === 'boolean') values.add(value);
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	return [...values].sort((left, right) => Number(left) - Number(right));
}

function assuranceSurfaces(
	subject: FrozenSubject,
	files: readonly SelectedFileRecord[],
	rootCommands: readonly CommandInventory[]
): AssuranceSurfaceInventory {
	const sourcePopulation = subject.testPopulations.find(
		(population) => population.provider === 'VITEST' && population.profile === 'SOURCE'
	);
	const distPopulation = subject.testPopulations.find(
		(population) => population.provider === 'VITEST' && population.profile === 'DIST'
	);
	if (
		sourcePopulation !== undefined &&
		distPopulation !== undefined &&
		canonicalJson(sourcePopulation.includedPaths) !== canonicalJson(distPopulation.includedPaths)
	)
		throw new Error('Vitest SOURCE and DIST configured test populations differ.');
	const deterministicPopulation = subject.testPopulations.find(
		(population) => population.provider === 'PLAYWRIGHT' && population.profile === 'DETERMINISTIC'
	);
	const livePopulation = subject.testPopulations.find(
		(population) => population.provider === 'PLAYWRIGHT' && population.profile === 'LIVE'
	);
	const unitTests = sourcePopulation?.includedPaths ?? [];
	const deterministicFiles = deterministicPopulation?.includedPaths ?? [];
	const liveFiles = livePopulation?.includedPaths ?? [];
	const vitestConfig = files.find((file) => file.path === 'vitest.config.ts');
	const projectsConfig = files.find((file) => file.path === 'vitest.projects.ts');
	const coverageObject = vitestConfig
		? findObjectProperty(frozenText(subject, vitestConfig.path), vitestConfig.path, 'coverage')
		: undefined;
	const thresholds = coverageObject?.thresholds;
	const numericThresholds: Record<string, number> = {};
	if (thresholds !== undefined) {
		for (const [key, value] of Object.entries(object(thresholds, 'coverage thresholds'))) {
			if (typeof value === 'number') numericThresholds[key] = value;
		}
	}
	const mutationCommands = rootCommands
		.filter((command) => command.categories.includes('MUTATION'))
		.map((command) => command.name);
	return {
		coverage: {
			configurationPath: vitestConfig?.path ?? null,
			exclude: stringArray(coverageObject?.exclude, 'vitest coverage exclude'),
			include: stringArray(coverageObject?.include, 'vitest coverage include'),
			outputIdentity: null,
			provider: typeof coverageObject?.provider === 'string' ? coverageObject.provider : null,
			state: vitestConfig ? 'NOT_RUN' : 'NOT_CONFIGURED',
			thresholds: numericThresholds
		},
		e2e: {
			deterministicFiles,
			liveFiles,
			state:
				deterministicPopulation !== undefined || livePopulation !== undefined
					? 'NOT_RUN'
					: 'NOT_CONFIGURED'
		},
		mutation: {
			commands: mutationCommands,
			ledgerPath: files.some((file) => file.path === 'scripts/mutants/ledger.ts')
				? 'scripts/mutants/ledger.ts'
				: null,
			runnerPath: files.some((file) => file.path === 'scripts/mutants/run.ts')
				? 'scripts/mutants/run.ts'
				: null,
			state: mutationCommands.length > 0 ? 'NOT_RUN' : 'NOT_CONFIGURED'
		},
		testPopulations: subject.testPopulations,
		unitTests: {
			files: unitTests,
			passWithNoTestsValues: projectsConfig
				? booleanPropertyValues(
						frozenText(subject, projectsConfig.path),
						projectsConfig.path,
						'passWithNoTests'
					)
				: [],
			state: unitTests.length > 0 ? 'NOT_RUN' : 'NOT_CONFIGURED'
		}
	};
}

function dependencyBoundary(
	subject: FrozenSubject,
	files: readonly SelectedFileRecord[],
	rootManifest: JsonObject
): DependencyBoundaryInventory {
	const configurationPath = files.some((file) => file.path === '.dependency-cruiser.cjs')
		? '.dependency-cruiser.cjs'
		: null;
	const boundaryCommand =
		sortedRecord(rootManifest.scripts, 'package.json#/scripts').boundary ?? null;
	if (!configurationPath) {
		return {
			analyzedPerimeter: [],
			command: boundaryCommand,
			configurationPath: null,
			enforcementCarriers: boundaryCommand?.includes('csaa-product-boundary.ts')
				? ['scripts/csaa-product-boundary.ts']
				: [],
			enforcementPerimeter: boundaryCommand?.includes('csaa-product-boundary.ts')
				? ['apps', 'packages']
				: [],
			provenance: boundaryCommand ? ['package.json#/scripts/boundary'] : [],
			ruleIds: [],
			state: 'NOT_CONFIGURED'
		};
	}
	const source = frozenText(subject, configurationPath);
	const sourceFile = ts.createSourceFile(
		configurationPath,
		source,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.JS
	);
	const names = new Set<string>();
	const visit = (node: ts.Node) => {
		if (
			ts.isPropertyAssignment(node) &&
			propertyName(node.name) === 'name' &&
			ts.isStringLiteral(node.initializer)
		) {
			names.add(node.initializer.text);
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	const commandTokens = boundaryCommand?.trim().split(/\s+/) ?? [];
	const executableIndex = commandTokens.indexOf('depcruise');
	const optionIndex = commandTokens.findIndex(
		(token, index) => index > executableIndex && token.startsWith('-')
	);
	const perimeterEnd = optionIndex < 0 ? commandTokens.length : optionIndex;
	const analyzedPerimeter =
		executableIndex < 0
			? []
			: commandTokens
					.slice(executableIndex + 1, perimeterEnd)
					.filter((token) => !token.startsWith('-'))
					.sort(compareText);
	return {
		analyzedPerimeter,
		command: boundaryCommand,
		configurationPath,
		enforcementCarriers: [
			configurationPath,
			...(boundaryCommand?.includes('csaa-product-boundary.ts')
				? ['scripts/csaa-product-boundary.ts']
				: [])
		],
		enforcementPerimeter: boundaryCommand?.includes('csaa-product-boundary.ts')
			? ['apps', 'packages']
			: analyzedPerimeter,
		provenance: [configurationPath, ...(boundaryCommand ? ['package.json#/scripts/boundary'] : [])],
		ruleIds: [...names].sort(compareText),
		state: 'CONFIGURED_NOT_RUN'
	};
}

const PROVIDERS = [
	['@playwright/test', ['e2e-test']],
	['@vitest/coverage-v8', ['coverage']],
	['dependency-cruiser', ['dependency-graph', 'architecture-boundary']],
	['eslint', ['lint']],
	['sonar', ['static-quality-reporting']],
	['typescript', ['typescript-parse', 'type-system']],
	['vitest', ['unit-test']]
] as const;

const PROVIDER_ADAPTER_CAPABILITIES = {
	'@playwright/test': [],
	'@vitest/coverage-v8': ['test-coverage-ingestion'],
	'dependency-cruiser': [
		'current-dependency-cruiser-differential',
		'dependency-graph-corroboration'
	],
	eslint: ['eslint-result-ingestion'],
	sonar: [],
	typescript: TYPESCRIPT_ADAPTER_CAPABILITIES,
	vitest: ['vitest-result-ingestion']
} as const satisfies Record<(typeof PROVIDERS)[number][0], readonly string[]>;

function providerAdapterProvenance(name: (typeof PROVIDERS)[number][0]): readonly string[] {
	switch (name) {
		case '@vitest/coverage-v8':
			return VITEST_V8_COVERAGE_INGESTION_PROVENANCE;
		case 'dependency-cruiser':
			return CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_PROVENANCE;
		case 'eslint':
			return ESLINT_RESULT_INGESTION_PROVENANCE;
		case 'typescript':
			return [
				...TYPESCRIPT_SEMANTIC_PROVENANCE,
				...TYPESCRIPT_MODULE_GRAPH_PROVENANCE,
				...TYPESCRIPT_MODULE_DEPENDENCY_REPORT_PROVENANCE,
				...TYPESCRIPT_SEMANTIC_SOURCE_QUERY_PROVENANCE,
				...TYPESCRIPT_CALL_GRAPH_PROVENANCE,
				...TYPESCRIPT_CALL_GRAPH_REPORT_PROVENANCE,
				...TYPESCRIPT_LOGICAL_GRAPH_COMPOSITION_PROVENANCE,
				...TYPESCRIPT_LOGICAL_GRAPH_COMPOSITION_REPORT_PROVENANCE,
				...TYPESCRIPT_PROJECT_CONTEXT_GRAPH_PROVENANCE,
				...TYPESCRIPT_PROJECT_CONTEXT_REPORT_PROVENANCE,
				...TYPESCRIPT_CONDITIONAL_EXPORT_RESOLUTION_PROVENANCE,
				...TYPESCRIPT_MODULE_RESOLUTION_TRACE_PROVENANCE,
				...TYPESCRIPT_MODULE_RESOLUTION_TRACE_REPORT_PROVENANCE,
				...TYPESCRIPT_DECLARATION_CONTEXT_ANALYSIS_PROVENANCE,
				...TYPESCRIPT_DECLARATION_CONTEXT_REPORT_PROVENANCE,
				...TYPESCRIPT_SOURCE_ORIGIN_CORRELATION_PROVENANCE,
				...TYPESCRIPT_READ_WRITE_ACCESS_GRAPH_PROVENANCE,
				...TYPESCRIPT_READ_WRITE_ACCESS_REPORT_PROVENANCE,
				...TYPESCRIPT_STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_PROVENANCE,
				...TYPESCRIPT_STRUCTURAL_MODULE_REACHABILITY_REPORT_PROVENANCE,
				...TYPESCRIPT_STATIC_MODULE_IMPACT_CANDIDATE_REPORT_PROVENANCE,
				...TYPESCRIPT_WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_PROVENANCE,
				...TYPESCRIPT_STRUCTURAL_SCC_ANALYSIS_PROVENANCE,
				...TYPESCRIPT_STRUCTURAL_SCC_REPORT_PROVENANCE,
				...JPWB_COMMAND_DISPATCH_TOPOLOGY_PROVENANCE,
				...JPWB_COMMAND_DISPATCH_TOPOLOGY_REPORT_PROVENANCE,
				...JPWB_COMMAND_EVENT_CONTRACT_OVERLAY_PROVENANCE,
				...JPWB_COMMAND_EVENT_CONTRACT_OVERLAY_INPUT_PROVENANCE,
				...JPWB_COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROVENANCE,
				...JPWB_COMMAND_HANDLER_GRAPH_PROVENANCE,
				...JPWB_COMMAND_HANDLER_GRAPH_REPORT_PROVENANCE,
				...JPWB_GUARD_CLASSIFICATION_OVERLAY_PROVENANCE,
				...JPWB_GUARD_CLASSIFICATION_OVERLAY_REPORT_PROVENANCE,
				...MODULE_CODE_SLICE_PROVENANCE,
				...SEMANTIC_SNAPSHOT_COMPARISON_PROVENANCE,
				...JPWB_HARMONIZATION_NATIVE_PROJECTION_PROVENANCE
			];
		case 'vitest':
			return VITEST_RESULT_INGESTION_PROVENANCE;
		default:
			return [];
	}
}

function gateReachableScriptNames(rootScripts: ReadonlyMap<string, string>): Set<string> {
	const reachable = new Set<string>();
	const pending = ['gate', 'gate:fast'].filter((name) => rootScripts.has(name));
	while (pending.length > 0) {
		const name = pending.shift()!;
		if (reachable.has(name)) continue;
		reachable.add(name);
		const command = rootScripts.get(name);
		if (!command) continue;
		for (const match of command.matchAll(/\bbun run ([a-zA-Z0-9:_-]+)/g)) {
			const dependency = match[1]!;
			if (!reachable.has(dependency)) pending.push(dependency);
		}
	}
	return reachable;
}

function providerConfigurationPaths(
	files: readonly SelectedFileRecord[]
): Record<(typeof PROVIDERS)[number][0], readonly string[]> {
	return {
		'@playwright/test': files
			.filter((file) => file.path.endsWith('playwright.config.ts'))
			.map((file) => file.path),
		'@vitest/coverage-v8': files.some((file) => file.path === 'vitest.config.ts')
			? ['vitest.config.ts']
			: [],
		'dependency-cruiser': files.some((file) => file.path === '.dependency-cruiser.cjs')
			? ['.dependency-cruiser.cjs']
			: [],
		eslint: files.some((file) => file.path === 'eslint.config.mjs') ? ['eslint.config.mjs'] : [],
		sonar: files.some((file) => file.path === 'sonar-project.properties')
			? ['sonar-project.properties']
			: [],
		typescript: files
			.filter((file) => /(?:^|\/)tsconfig(?:\.[^/]+)?\.json$/.test(file.path))
			.map((file) => file.path),
		vitest: files
			.filter((file) => /^vitest(?:\.[^.]+)?\.(?:config|projects)\.ts$/.test(file.path))
			.map((file) => file.path)
	};
}

function providerGateEvidence(
	gateReachable: ReadonlySet<string>
): Record<(typeof PROVIDERS)[number][0], readonly string[]> {
	return {
		'@playwright/test': gateReachable.has('e2e') ? ['package.json#/scripts/gate:fast'] : [],
		'@vitest/coverage-v8': gateReachable.has('test:coverage')
			? ['package.json#/scripts/test:coverage']
			: [],
		'dependency-cruiser': gateReachable.has('boundary') ? ['package.json#/scripts/boundary'] : [],
		eslint: gateReachable.has('lint') ? ['package.json#/scripts/lint'] : [],
		sonar: gateReachable.has('sonar') ? ['package.json#/scripts/sonar'] : [],
		typescript: gateReachable.has('check-types') ? ['package.json#/scripts/check-types'] : [],
		vitest:
			gateReachable.has('test:src') || gateReachable.has('test')
				? ['package.json#/scripts/test']
				: []
	};
}

function providerInventory(
	subject: FrozenSubject,
	files: readonly SelectedFileRecord[],
	configuredCommands: readonly CommandInventory[]
): ProviderInventory[] {
	const lock = files.find((file) => file.path === 'bun.lock');
	const text = lock ? frozenText(subject, lock.path) : '';
	const rootScripts = new Map(
		configuredCommands
			.filter((command) => command.owner === '.')
			.map((command) => [command.name, command.command])
	);
	const gateReachable = gateReachableScriptNames(rootScripts);
	return PROVIDERS.map(([name, potentialCapabilities]) => {
		const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
		const versionPattern = new RegExp(String.raw`^\s*"${escaped}": \["${escaped}@([^"\s]+)"`, 'm');
		const version = versionPattern.exec(text)?.[1] ?? null;
		const configurationPaths = providerConfigurationPaths(files);
		const gateEvidence = providerGateEvidence(gateReachable);
		const configured = configurationPaths[name].length > 0;
		const gateWired = gateEvidence[name].length > 0;
		const adapterCapabilities = PROVIDER_ADAPTER_CAPABILITIES[name];
		const inventoryIntegrated = adapterCapabilities.length > 0;
		return {
			adapterCapabilities,
			adapterState: inventoryIntegrated ? 'INVENTORY_INTEGRATED' : 'UNIMPLEMENTED',
			configurationState: configured ? 'CONFIGURED' : 'NOT_CONFIGURED',
			configuredState: configured ? 'CONFIGURED_NOT_RUN' : 'NOT_CONFIGURED',
			gateState: gateWired ? 'GATE_WIRED' : 'NOT_GATE_WIRED',
			installationState: version ? 'LOCKED' : 'NOT_LOCKED',
			name,
			potentialCapabilities,
			provenance: canonicalProvenance(
				...(lock ? [lock.path] : []),
				...configurationPaths[name],
				...gateEvidence[name],
				...providerAdapterProvenance(name)
			),
			version
		};
	});
}

function verificationAssetRole(
	path: string,
	projectsText: string,
	isTest: boolean,
	isData: boolean,
	configuredCommands: readonly CommandInventory[]
): VerificationAssetInventory['role'] {
	if (isTest) return 'TEST';
	if (isData) return 'SUPPORT_DATA';
	if (/(?:guard|refusal)/.test(basename(path)) && projectsText.includes(basename(path)))
		return 'RUNTIME_GUARD';
	if (configuredCommands.some((command) => isNativeCsaaAnalysisAdapterInvocation(command, path)))
		return 'ANALYZER';
	if (path.startsWith('scripts/')) return 'SCRIPT';
	return 'ANALYZER';
}

function verificationAssetExtractionMethod(
	text: string,
	isTest: boolean,
	isData: boolean
): VerificationAssetInventory['extractionMethod'] {
	if (/from ['"]typescript['"]|require\(['"]typescript['"]\)/.exec(text)) return 'TYPESCRIPT_AST';
	if (isTest) return 'VITEST_EXECUTABLE_ASSERTION';
	if (isData) return 'DECLARED_STATIC_DATA';
	if (/\b(?:readFileSync|readdirSync|globSync|readFile)\b/.test(text)) return 'FILESYSTEM_OR_TEXT';
	return 'IMPORTED_EXECUTABLE_LOGIC';
}

function verificationAssetAssertedPopulation(
	path: string,
	isTest: boolean,
	extractionMethod: VerificationAssetInventory['extractionMethod']
): string {
	if (isTest) return `Executable assertions and imported surfaces declared by ${path}.`;
	if (extractionMethod === 'TYPESCRIPT_AST')
		return `Repository syntax and declarations selected by ${path} at execution time.`;
	return `Repository files, exports, or runtime events selected by ${path} at execution time.`;
}

function verificationAssetDisposition(
	path: string,
	role: VerificationAssetInventory['role'],
	configuredCommands: readonly CommandInventory[]
): VerificationAssetInventory['disposition'] {
	if (path === 'verif/arrow-command-census.ts') return ARROW_COMMAND_CENSUS_INTEGRATION_STRATEGY;
	if (configuredCommands.some((command) => isNativeCsaaAnalysisAdapterInvocation(command, path)))
		return 'CSAA_NATIVE';
	if (role === 'ANALYZER') return 'WRAP';
	return 'RETAIN_DELEGATED';
}

function commandReferencesVerificationAsset(command: string, path: string): boolean {
	const normalizedCommand = command.replaceAll('\\', '/');
	const boundary = `[\\s"'=;&|()]`;
	return [path, basename(path)].some((candidate) => {
		const escapedCandidate = candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		return new RegExp(`(?:^|${boundary})(?:\\./)?${escapedCandidate}(?=$|${boundary})`, 'u').test(
			normalizedCommand
		);
	});
}

function isNativeCsaaAnalysisAdapterInvocation(command: CommandInventory, path: string): boolean {
	return (
		path.startsWith('scripts/csaa-') &&
		command.name.startsWith('csaa:analyze:') &&
		commandReferencesVerificationAsset(command.command, path)
	);
}

function verificationAssetCarriers(
	path: string,
	stem: string,
	isTest: boolean,
	testSources: ReadonlyMap<string, string>,
	projectsText: string,
	configuredCommands: readonly CommandInventory[]
): string[] {
	const carriers = isTest
		? ['bun run test:src -> verif', path]
		: [...testSources.entries()]
				.filter(
					([, source]) =>
						source.includes(`./${stem}`) ||
						source.includes(basename(path)) ||
						source.includes(path.replace(/\.ts$/, ''))
				)
				.map(([testPath]) => testPath);
	for (const command of configuredCommands) {
		if (
			commandReferencesVerificationAsset(command.command, path) &&
			!isNativeCsaaAnalysisAdapterInvocation(command, path)
		) {
			carriers.push(...command.provenance);
		}
	}
	if (!isTest && projectsText.includes(basename(path)))
		carriers.push('vitest.projects.ts#setupFiles');
	if (carriers.length === 0) carriers.push('UNMAPPED');
	return carriers;
}

function verificationAssets(
	subject: FrozenSubject,
	files: readonly SelectedFileRecord[],
	configuredCommands: readonly CommandInventory[]
): VerificationAssetInventory[] {
	const assetPaths = files
		.filter(
			(file) =>
				/^(?:verif|scripts)\/.*\.ts$/u.test(file.path) ||
				(file.path.startsWith('verif/') && file.subjectArtifactClass === 'VERIFICATION')
		)
		.map((file) => file.path);
	const baselines = files.filter((file) => /^verif\/[^/]+\.baseline\.json$/.test(file.path));
	const testSources = new Map(
		assetPaths
			.filter((path) => path.endsWith('.test.ts'))
			.map((path) => [path, frozenText(subject, path)])
	);
	const projectsText = files.some((file) => file.path === 'vitest.projects.ts')
		? frozenText(subject, 'vitest.projects.ts')
		: '';
	return assetPaths.map((path) => {
		const selectedFile = files.find((file) => file.path === path);
		if (!selectedFile)
			throw new Error(`Verification asset is absent from selected-file manifest: ${path}`);
		const text = frozenText(subject, path);
		const stem = basename(path).replace(/\.test\.ts$|\.data\.ts$|\.ts$/, '');
		const isTest = path.endsWith('.test.ts');
		const isData = path.endsWith('.data.ts') || path.endsWith('.evidence.json');
		const role = verificationAssetRole(path, projectsText, isTest, isData, configuredCommands);
		const associatedBaselines = baselines
			.filter(
				(baseline) =>
					baseline.path.includes(stem) ||
					text.includes(baseline.path) ||
					text.includes(basename(baseline.path))
			)
			.map((baseline) => baseline.path);
		const carriers = verificationAssetCarriers(
			path,
			stem,
			isTest,
			testSources,
			projectsText,
			configuredCommands
		);
		const extractionMethod = verificationAssetExtractionMethod(text, isTest, isData);
		return {
			associatedBaselines,
			assertedPopulation: verificationAssetAssertedPopulation(path, isTest, extractionMethod),
			contentSha256: selectedFile.sha256,
			disposition: verificationAssetDisposition(path, role, configuredCommands),
			extractionMethod,
			gateCarriers: [...new Set(carriers)].sort(compareText),
			path,
			provenance: [path],
			role
		};
	});
}

function capabilities(files: readonly SelectedFileRecord[]): CapabilityInventory[] {
	const unimplemented = ['code-property-graph', 'control-flow', 'data-flow'];
	const currentDependencyCruiserDifferentialEvidenceSelected = files.some(
		(file) => file.path === CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_EVIDENCE_PATH
	);
	const currentDependencyCruiserG4ClosureEvidenceSelected = files.some(
		(file) => file.path === CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_EVIDENCE_PATH
	);
	return [
		{
			explanation: 'DWP-001 deterministically derives and verifies the repository inventory.',
			id: 'repository-inventory',
			provider: INVENTORY_GENERATOR_ID,
			provenance: ['packages/csaa/src/inventory/collect-inventory.ts'],
			state: 'IMPLEMENTED'
		},
		{
			explanation: `The implementation-local ${WORKING_CHANGE_SET_SCHEMA_VERSION} capability resolves a raw-worktree-byte-comparable non-bare Git worktree through ${WORKING_CHANGE_SET_METHOD}: an initial bounded read-only Git observation, ordinary immutable FrozenSubject capture, exact base-to-frozen-byte change binding, final Git reobservation, final selected-byte and mode reconciliation, and one whole-sequence retry. It binds the exact full base commit, object format, linked-checkout identity, repository prefix, full provider identity, raw-byte comparison policy, tracked add/modify/delete/mode/artifact-kind changes, exact globally unambiguous rename/copy lineage, selected untracked inputs, excluded output/policy/outside/index state, population counts, and separate change, exclusion, and worktree-state digests. A clean worktree binds revision=HEAD; selected raw-byte changes bind parentRevision=HEAD; index-only changes remain explicitly excluded local state and do not alter frozen subject identity. It fails closed for sparse or unmerged state, skip-worktree, assume-unchanged, gitlinks, selected symlinks/special files, unsupported object or path identities, automatic checkout or selected-path working-tree transformations, races, and aggregate Git byte/deadline exhaustion. Raw after-byte SHA-256 remains distinct from Git blob identity. Plain non-Git resolveSubject and inventory generation retain filesystem-only UNKNOWN revision metadata; unified coding-agent operations must opt into resolveWorkingSubject. This local schema is not a registered JAN-CSAA-007 WorkingChangeSetRecord, does not support similarity lineage, filtered/smudged worktrees, recursive submodules, bare/unborn repositories, revision materialization, persistence, cross-revision comparison, findings, gates, or authority, and therefore remains PARTIAL.`,
			id: 'working-change-set',
			provider: 'git',
			provenance: WORKING_CHANGE_SET_PROVENANCE,
			state: 'PARTIAL'
		},
		{
			explanation: `The first two bounded DWP-004 increments project every compiler-observed module occurrence into a validated TypeScript module-dependency graph and normalize exact-schema-validated dependency-cruiser 16.10.4 JSON evidence for conservative, context-bound comparison. Provider aggregates never replace compiler occurrence edges; qualified target agreement, unresolved agreement, collapsed corroboration, incomparable scope/context differences, and unqualified observed differences remain distinct. This contract cannot promote a difference to conflict without later validated context-equivalence and closed-perimeter evidence. An implementation-local preliminary coding-agent report facade under ${MODULE_DEPENDENCY_REPORT_OPERATION_VERSION} admits one explicit bounded project set, reuses the exact validated CAP-010 evidence pipeline, preflights the complete selected graph's exact node, edge, and limitation populations before graph construction, independently validates the constructed graph, verifies final selected-captured-subject currentness, and emits one maxResultBytes-bounded admitted partial ${MODULE_DEPENDENCY_REPORT_SCHEMA_VERSION} report with the full occurrence-edge population, both indexes, layer manifests, full project/source identity evidence, and ${MODULE_DEPENDENCY_REPORT_RESULT_SCHEMA_VERSION} result; successful graph evidence is never truncated and small refusal envelopes remain emit-able. Its request schema is ${MODULE_DEPENDENCY_REPORT_REQUEST_SCHEMA_VERSION}, its exact supported selection is ${JSON.stringify(MODULE_DEPENDENCY_REPORT_SELECTION)}, its analysis authority is ${MODULE_DEPENDENCY_REPORT_AUTHORITY}, authority transfer is ${MODULE_DEPENDENCY_REPORT_AUTHORITY_TRANSFER}, and gate effect is ${MODULE_DEPENDENCY_REPORT_GATE_EFFECT}. Even an embedded COMPLETE/CLOSED graph is closed only within the selected compiler module-resolution projection; the facade and CAP-004 status remain PARTIAL. Final CURRENT_FOR_CAPTURED_SUBJECT is scoped to SELECTED_CAPTURED_SUBJECT_ONLY and neither establishes persistent or cross-revision currentness nor turns a zero edge or incoming-edge population into unused, dead, orphan, irrelevant, non-impacting, or safe-removal proof. The facade is not a registered JAN-CSAA-007 OperationResponse, does not complete DWP-004, DWP-005, or DWP-006, and publishes ${MODULE_DEPENDENCY_REPORT_NONCLAIMS.join(', ')}. Its bounded best-effort JSONL progress transport is excluded from report identity and evidence. The machine-facing coding-agent invocation bun run --silent csaa:analyze:module-dependency is CONFIGURED_NOT_RUN by inventory generation. The package root exports the report contract, runner, progress-event schema, and transport schema/limits/types; the parsed-request command adapter, JSONL progress writer, population preflight, failure classifier, and internal project-context admission/capture seams remain trust-bound implementation details and are not package-root exports. Manifest dependencies, resolved component instances, inferred or observed runtime dependencies, dependency-cruiser or external corroborating-provider execution beyond the internal TypeScript capture, architecture discovery or violation, graph algorithms, query, slicing, impact, flow, and cross-Program composition are not implemented by this facade.`,
			id: 'dependency-graph',
			provider: 'typescript',
			provenance: [
				...TYPESCRIPT_MODULE_GRAPH_PROVENANCE,
				...TYPESCRIPT_MODULE_DEPENDENCY_REPORT_PROVENANCE,
				...TYPESCRIPT_SYMBOL_PROVENANCE,
				...DEPENDENCY_CRUISER_CORROBORATION_PROVENANCE,
				'package.json#/scripts/csaa:analyze:module-dependency'
			],
			state: 'PARTIAL'
		},
		{
			explanation: `The third bounded DWP-004 increment enumerates every retained TypeScript CALL, NEW, and TAGGED_TEMPLATE site into a validated graph with exact structural/lexical ownership within the declared method, open compiler-bound callable candidates, and explicit external-dispatch, unresolved, or unsupported frontiers. An implementation-local preliminary coding-agent report facade under ${CALL_GRAPH_REPORT_OPERATION_VERSION} admits one explicit bounded project set, requests the exact TS_PROJECT, TS_SYMBOL, TS_SYNTAX, and TS_TYPE semantic capability closure through the trusted CAP-010 successor seam, and performs bounded deterministic invocation-classification record inspection before it admits the exact complete selected node, edge, and limitation populations. It then materializes and independently validates one full ${CALL_GRAPH_REPORT_SCHEMA_VERSION} graph report with both indexes, layer manifests, complete project/source identity evidence, final selected-captured-subject currentness, and ${CALL_GRAPH_REPORT_RESULT_SCHEMA_VERSION} result under maxResultBytes; successful evidence is never truncated and refusal envelopes remain emit-able. Its request schema is ${CALL_GRAPH_REPORT_REQUEST_SCHEMA_VERSION}, exact selection is ${JSON.stringify(CALL_GRAPH_REPORT_SELECTION)}, analysis authority is ${CALL_GRAPH_REPORT_AUTHORITY}, authority transfer is ${CALL_GRAPH_REPORT_AUTHORITY_TRANSFER}, and gate effect is ${CALL_GRAPH_REPORT_GATE_EFFECT}. The graph and facade remain PARTIAL/OPEN: runtime caller and evaluation ownership remain coarsened, invocation-specific resolved signatures, exact or exclusive targets, dispatch closure, runtime observations, whole-program reachability, and all twelve entry-mechanism classes are not claimed; runtime caller and evaluation ownership are not inferred from the structural ownership edge. Final CURRENT_FOR_CAPTURED_SUBJECT is scoped to SELECTED_CAPTURED_SUBJECT_ONLY and does not establish persistent or cross-revision currentness. The facade is not a registered JAN-CSAA-007 OperationResponse, does not complete DWP-004, DWP-005, or DWP-006, and publishes ${CALL_GRAPH_REPORT_NONCLAIMS.join(', ')}. Its bounded best-effort JSONL progress transport is excluded from report identity and evidence. The machine-facing coding-agent invocation bun run --silent csaa:analyze:call-graph is CONFIGURED_NOT_RUN by inventory generation. The package root exports the report contract, runner, progress-event schema, and transport schema/limits/types; the bounded builder seam, parsed-request command adapter, JSONL writer, failure classifier, and internal TS_TYPE capture seam remain implementation-private. Exact/exhaustive caller sets, reachability, dead-code or safe-removal conclusions, architecture discovery or violation, query, slicing, impact, comparison, findings, gates, remediation, and disposition remain outside this facade.`,
			id: 'call-graph',
			provider: 'typescript',
			provenance: [
				...TYPESCRIPT_CALL_GRAPH_PROVENANCE,
				...TYPESCRIPT_CALL_GRAPH_REPORT_PROVENANCE,
				...TYPESCRIPT_SEMANTIC_PROVENANCE,
				'package.json#/scripts/csaa:analyze:call-graph'
			],
			state: 'PARTIAL'
		},
		{
			explanation: `The fourth bounded DWP-004 increment observes the exact frozen generated JPWB transition table without executing it and projects declared machines, states, legal transitions, guarded-legal restrictions, explicitly illegal transitions, and cross-axis frontiers. It uses implementation-local relation codes because the closed JAN-CSAA-007 registry has no state-machine relation family. An implementation-local preliminary coding-agent report facade under ${STATE_MACHINE_GRAPH_REPORT_OPERATION_VERSION} admits one explicit project set and one exact generated source selected by project config and logical path, derives all artifact and semantic identities internally, reuses the exact TS_PROJECT, TS_SYMBOL, and TS_SYNTAX CAP-010 evidence pipeline, independently validates the complete generated-topology observation and the complete bounded state-machine graph, verifies final selected-captured-subject currentness, and emits one maxResultBytes-bounded admitted partial ${STATE_MACHINE_GRAPH_REPORT_SCHEMA_VERSION} report with full project-context evidence, ${STATE_MACHINE_GRAPH_REPORT_RESULT_SCHEMA_VERSION} result, both graph indexes, layer manifests, and exact UTF-16 source witnesses; successful evidence is never truncated and small refusal envelopes remain emit-able. Its request schema is ${STATE_MACHINE_GRAPH_REPORT_REQUEST_SCHEMA_VERSION}, exact selection is ${JSON.stringify(STATE_MACHINE_GRAPH_REPORT_SELECTION)}, analysis authority is ${STATE_MACHINE_GRAPH_REPORT_AUTHORITY}, authority transfer is ${STATE_MACHINE_GRAPH_REPORT_AUTHORITY_TRANSFER}, and gate effect is ${STATE_MACHINE_GRAPH_REPORT_GATE_EFFECT}. The graph and facade remain CAP-027 PARTIAL/OPEN, GENERATED_RUNTIME_TOPOLOGY_ONLY, and IMPLEMENTATION_LOCAL_UNREGISTERED; the existing specialized verifier authority remains ${STATE_MACHINE_GRAPH_VERIFIER_AUTHORITY} and is neither held nor transferred by the facade. Final CURRENT_FOR_CAPTURED_SUBJECT is scoped to SELECTED_CAPTURED_SUBJECT_ONLY and does not establish persistent or cross-revision currentness. The facade is not a registered JAN-CSAA-007 OperationResponse, does not complete DWP-004, DWP-005, or DWP-006, and publishes ${STATE_MACHINE_GRAPH_REPORT_NONCLAIMS.join(', ')}. Its bounded best-effort JSONL progress transport is excluded from report identity and evidence. The machine-facing coding-agent invocation bun run --silent csaa:analyze:state-machine-graph is CONFIGURED_NOT_RUN by inventory generation. The package root exports the report contract, runner, progress-event schema, and transport schema/limits/types; source-binding helpers, parsed-request command adapter, JSONL writer, failure classifiers, and internal project-context admission/capture seams remain implementation-private. This generated-runtime-topology projection does not establish upstream vocabulary authority, runtime behavior, command performability, handler or writer/effect coverage, guard enforcement, behavioral reachability, whole-program reachability, semantic query, slicing, impact, comparison, architecture or dead-code conclusions, findings, gates, remediation, or any specialized verifier-census conclusion; full JAN-CSAA-007 and JAN-CSAA-008 conformance remain NOT_CLAIMED and existing verifier authority remains delegated.`,
			id: 'state-machine-graph',
			provider: 'jpwb-generated-transition-table',
			provenance: [
				...JPWB_STATE_MACHINE_GRAPH_PROVENANCE,
				...JPWB_STATE_MACHINE_GRAPH_REPORT_PROVENANCE,
				'package.json#/scripts/csaa:analyze:state-machine-graph'
			],
			state: 'PARTIAL'
		},
		{
			explanation: `The fifth bounded DWP-004 increment implements the ${ARROW_COMMAND_CENSUS_INTEGRATION_STRATEGY} strategy through exact adapter ${ARROW_COMMAND_CENSUS_ADAPTER_ID} and method ${ARROW_COMMAND_CENSUS_METHOD}, wrapping the retained JPWB arrow-command census without changing its ${ARROW_COMMAND_CENSUS_VERIFIER_AUTHORITY} verifier authority, oracle, baseline, gate effect, or source implementation. It binds an exact FrozenSubject-selected repository artifact population, independently records the Bun/TypeScript/ULID/Zod executor environment, runs the retained analyzer in an isolated temporary byte capsule, validates post-execution subject and executor integrity, preserves exact raw evidence and baseline comparison, and publishes a canonical partial observation. An implementation-local preliminary coding-agent report facade under ${ARROW_COMMAND_CENSUS_REPORT_OPERATION_VERSION} admits one explicit bounded project set plus mandatory execution acknowledgement ${ARROW_COMMAND_CENSUS_REPORT_EXECUTION_SELECTION}, adds the provider's exported fixed retained-verifier artifact paths to the same FrozenSubject, independently validates the exact artifact set and returned complete or partial observation, verifies final selected-captured-subject currentness, and emits one maxResultBytes-bounded admitted partial ${ARROW_COMMAND_CENSUS_REPORT_SCHEMA_VERSION} report with ${ARROW_COMMAND_CENSUS_REPORT_RESULT_SCHEMA_VERSION} result, exact raw evidence, baseline comparison, subject identity, executor identity, and failure evidence; successful evidence is never truncated and small refusal envelopes remain emit-able. Its request schema is ${ARROW_COMMAND_CENSUS_REPORT_REQUEST_SCHEMA_VERSION}, exact selection is ${JSON.stringify(ARROW_COMMAND_CENSUS_REPORT_SELECTION)}, capability status is ${ARROW_COMMAND_CENSUS_REPORT_CAPABILITY_STATUS}, registry status is ${ARROW_COMMAND_CENSUS_REPORT_REGISTRY_STATUS}, scope is ${ARROW_COMMAND_CENSUS_REPORT_SCOPE}, analysis authority is ${ARROW_COMMAND_CENSUS_REPORT_AUTHORITY}, authority transfer is ${ARROW_COMMAND_CENSUS_REPORT_AUTHORITY_TRANSFER}, and gate effect is ${ARROW_COMMAND_CENSUS_REPORT_GATE_EFFECT}. Retained dead-covered and orphan labels keep their specialized transition-census meanings and are not formal JAN-CSAA rule findings, repository-code dead/orphan classifications, or safe-removal proof. Final CURRENT_FOR_CAPTURED_SUBJECT is scoped to SELECTED_CAPTURED_SUBJECT_ONLY and establishes neither persistent nor cross-revision currentness. The facade is not a registered JAN-CSAA-007 OperationResponse, does not complete DWP-004, DWP-005, or DWP-006, and publishes ${ARROW_COMMAND_CENSUS_REPORT_NONCLAIMS.join(', ')}. Its bounded best-effort JSONL progress transport is excluded from report identity and evidence. The machine-facing coding-agent invocation bun run --silent csaa:analyze:arrow-command-census is CONFIGURED_NOT_RUN by inventory generation. The package root exports the report contract, runner, progress-event schema, and transport schema/limits/types; the report's parsed-request command adapter, JSONL writer, request admission, and dependency-injection seam remain implementation-private. This is process isolation rather than a hostile-code security sandbox: subject module initializers can execute arbitrary code with ambient filesystem, network, process, environment, and secret access. Supported declaration idioms remain those of the retained verifier; runtime performability, handler-registry closure, graph-relation conformance, query, slicing, impact, comparison, replacement equivalence, and full JAN-CSAA-007 or JAN-CSAA-008 conformance are NOT_CLAIMED.`,
			id: 'arrow-command-census',
			provider: ARROW_COMMAND_CENSUS_ADAPTER_ID,
			provenance: [
				...JPWB_ARROW_COMMAND_CENSUS_PROVENANCE,
				...JPWB_ARROW_COMMAND_CENSUS_RETAINED_PROVENANCE,
				...JPWB_ARROW_COMMAND_CENSUS_REPORT_PROVENANCE,
				'package.json#/scripts/csaa:analyze:arrow-command-census'
			],
			state: 'PARTIAL'
		},
		{
			explanation: `The sixth bounded DWP-004 increment derives a validated Program-local read/write access graph from normalized TypeScript reference, declaration, symbol, and assignment facts. It distinguishes reads, writes, and compound/update read-writes; retains deterministic symbol-slot and occurrence identities, forward/reverse indexes, UTF-16 zero-based half-open source witnesses, population reconciliation, and explicit type-position, dynamic-element, unresolved, and unsupported frontiers. Implicit bindings, for-in/of targets, delete operations, and write forms absent from the normalized assignment taxonomy are not classified as supported writes. An implementation-local preliminary coding-agent report facade under ${READ_WRITE_ACCESS_REPORT_OPERATION_VERSION} admits one explicit bounded project set, reuses the exact validated CAP-010 evidence pipeline, constructs and independently validates the complete selected Program-local read/write graph, verifies final selected-captured-subject currentness, and emits one maxResultBytes-bounded admitted partial ${READ_WRITE_ACCESS_REPORT_SCHEMA_VERSION} report with full project/source identity evidence and ${READ_WRITE_ACCESS_REPORT_RESULT_SCHEMA_VERSION} result; successful graph evidence is never truncated and small refusal envelopes remain emit-able. Its request schema is ${READ_WRITE_ACCESS_REPORT_REQUEST_SCHEMA_VERSION}, its exact supported selection is ${JSON.stringify(READ_WRITE_ACCESS_REPORT_SELECTION)}, its analysis authority is ${READ_WRITE_ACCESS_REPORT_AUTHORITY}, authority transfer is ${READ_WRITE_ACCESS_REPORT_AUTHORITY_TRANSFER}, and gate effect is ${READ_WRITE_ACCESS_REPORT_GATE_EFFECT}. Final CURRENT_FOR_CAPTURED_SUBJECT is scoped to SELECTED_CAPTURED_SUBJECT_ONLY and does not close the graph's OPEN world, establish persistent or cross-revision currentness, or turn a zero recorded population into unused, dead, irrelevant, non-impacting, or safe-removal proof. The facade is not a registered JAN-CSAA-007 OperationResponse, does not complete DWP-004, DWP-005, or DWP-006, and publishes ${READ_WRITE_ACCESS_REPORT_NONCLAIMS.join(', ')}. Its bounded best-effort JSONL progress transport is excluded from report identity and evidence. The machine-facing coding-agent invocation bun run --silent csaa:analyze:read-write-access is CONFIGURED_NOT_RUN by inventory generation. The package root exports the report contract, runner, progress-event schema, and transport schema/limits/types; the parsed-request command adapter, JSONL progress writer, and internal project-context admission/capture seams remain trust-bound implementation details and are not package-root exports. It does not construct control flow, reaching definitions, heap or points-to state, interprocedural flow, taint, or JAN-CSAA-CAP-007 data flow; the broader data-flow capability therefore remains UNIMPLEMENTED.`,
			id: 'read-write-access-graph',
			provider: 'typescript',
			provenance: [
				...TYPESCRIPT_READ_WRITE_ACCESS_GRAPH_PROVENANCE,
				...TYPESCRIPT_READ_WRITE_ACCESS_REPORT_PROVENANCE,
				'package.json#/scripts/csaa:analyze:read-write-access',
				...TYPESCRIPT_SYMBOL_PROVENANCE
			],
			state: 'PARTIAL'
		},
		{
			explanation: `The seventh bounded DWP-004 increment independently reconciles the normalized JPWB COMMANDS and HANDLERS registry populations, resolves supported direct handler callables, and overlays the exact retained arrow-command site and occurrence populations. Deterministic registry/direct/table facts occupy the JAN-CSAA-CAP-027 derivation lane; shared factory attribution remains candidate evidence in a separate JAN-CSAA-CAP-028 inference lane with explicit frontiers. An implementation-local preliminary coding-agent report facade under ${COMMAND_HANDLER_GRAPH_REPORT_OPERATION_VERSION} admits exactly the fixed seven-project JPWB command-handler closure plus mandatory retained-execution acknowledgement ${COMMAND_HANDLER_GRAPH_REPORT_EXECUTION_SELECTION}, captures a validated structural semantic snapshot and the fixed retained-arrow artifacts in one FrozenSubject, independently validates the retained-arrow artifact set and complete-or-partial observation, derives the exact COMMANDS and HANDLERS selectors internally, constructs and independently validates the PARTIAL/OPEN command-handler graph, reconciles all subject, snapshot, artifact-set, executor, observation, selector, graph, authority, method, limitation, and budget identities, performs one final selected-captured-subject currentness check, and emits one maxResultBytes-bounded admitted partial ${COMMAND_HANDLER_GRAPH_REPORT_SCHEMA_VERSION} report with ${COMMAND_HANDLER_GRAPH_REPORT_RESULT_SCHEMA_VERSION} result, a bounded semantic snapshot summary, and full retained-arrow and command-handler graph evidence; successful evidence is never truncated. It deliberately does not construct CAP-010 project-context projection evidence. Its request schema is ${COMMAND_HANDLER_GRAPH_REPORT_REQUEST_SCHEMA_VERSION}, exact selection is ${JSON.stringify(COMMAND_HANDLER_GRAPH_REPORT_SELECTION)}, analysis authority is ${COMMAND_HANDLER_GRAPH_REPORT_AUTHORITY}, authority transfer is ${COMMAND_HANDLER_GRAPH_REPORT_AUTHORITY_TRANSFER}, and gate effect is ${COMMAND_HANDLER_GRAPH_REPORT_GATE_EFFECT}. The public package surface exports the report contract, runner, progress-event schema, and transport schema/limits/types while its same-process FrozenSubject-and-semantic handoff, request admission, dependency seam, parsed-request adapter, and JSONL writer remain implementation-private. The machine-facing invocation bun run --silent csaa:analyze:command-handler-graph is CONFIGURED_NOT_RUN by inventory generation. The facade is not a registered JAN-CSAA-007 OperationResponse, completes no DWP, and publishes ${COMMAND_HANDLER_GRAPH_REPORT_NONCLAIMS.join(', ')}. It neither integrates the separate command-dispatch census nor analyzes command-bus runtime lookup, handler execution, exact factory ownership, guards, effects, events, persistence, runtime performability, whole-program closure, semantic query, slicing, impact, comparison, architecture, dead/orphan classification, findings, gates, remediation, safe removal, hostile-code sandboxing, replacement equivalence, or full JAN-CSAA-007/008 conformance.`,
			id: 'command-handler-static-projection',
			provider: 'typescript+jpwb-arrow-command-census-overlay',
			provenance: [
				...JPWB_COMMAND_HANDLER_GRAPH_PROVENANCE,
				...JPWB_COMMAND_HANDLER_GRAPH_REPORT_PROVENANCE,
				...JPWB_ARROW_COMMAND_CENSUS_PROVENANCE,
				...JPWB_ARROW_COMMAND_CENSUS_RETAINED_PROVENANCE,
				...TYPESCRIPT_STRUCTURAL_SEMANTIC_PROVENANCE,
				'capabilities#arrow-command-census',
				'capabilities#symbol-table',
				'capabilities#typescript-ast',
				'package.json#/scripts/csaa:analyze:command-handler-graph'
			],
			state: 'PARTIAL'
		},
		{
			explanation: `The eighth bounded DWP-004 increment composes a static JPWB command-bus topology overlay over the validated command-handler graph. From normalized TypeScript syntax and symbol facts it binds the selected dispatchStamped COMMANDS lookup, payload-validation call, HANDLERS lookup, missing-handler guard, and handler invocation, then emits candidate-only cross-graph references to the predecessor HANDLER_TARGET population without duplicating registry or handler nodes. An implementation-local preliminary coding-agent report facade under ${COMMAND_DISPATCH_TOPOLOGY_REPORT_OPERATION_VERSION} admits exactly the fixed seven-project JPWB command-handler closure plus mandatory retained-execution acknowledgement ${COMMAND_DISPATCH_TOPOLOGY_REPORT_EXECUTION_SELECTION}; captures a validated structural semantic snapshot, fixed retained-arrow artifacts, and the retained command-dispatch census in one FrozenSubject through a same-process nonserialized command-handler pipeline handoff; independently revalidates the retained-arrow observation and command-handler graph; selects the exact JPWB command bus; constructs and independently validates the PARTIAL/OPEN command-dispatch topology; reconciles subject, predecessor budgets, identities, digests, selectors, retained-census reference and authority, layer manifests, indexes, coverage, and candidate handler-target membership; and performs one final selected-captured-subject currentness check. It emits one maxResultBytes-bounded admitted partial ${COMMAND_DISPATCH_TOPOLOGY_REPORT_SCHEMA_VERSION} report with ${COMMAND_DISPATCH_TOPOLOGY_REPORT_RESULT_SCHEMA_VERSION} result, a bounded semantic snapshot summary, and full retained-arrow observation, command-handler graph, and command-dispatch topology evidence; successful evidence is never truncated. Its request schema is ${COMMAND_DISPATCH_TOPOLOGY_REPORT_REQUEST_SCHEMA_VERSION}, exact selection is ${JSON.stringify(COMMAND_DISPATCH_TOPOLOGY_REPORT_SELECTION)}, distinct facade scope is ${COMMAND_DISPATCH_TOPOLOGY_REPORT_SCOPE}, analysis authority is ${COMMAND_DISPATCH_TOPOLOGY_REPORT_AUTHORITY}, authority transfer is ${COMMAND_DISPATCH_TOPOLOGY_REPORT_AUTHORITY_TRANSFER}, and gate effect is ${COMMAND_DISPATCH_TOPOLOGY_REPORT_GATE_EFFECT}. The retained command-dispatch census remains exact-identity-bound RETAIN_DELEGATED corroboration under ${COMMAND_DISPATCH_TOPOLOGY_REPORT_SELECTION.retainedDispatchCensus}. The public package surface exports the report contract, runner, progress-event schema, and transport schema/limits/types while its same-process FrozenSubject-and-semantic handoff, request admission, dependency seam, parsed-request adapter, and JSONL writer remain implementation-private. The machine-facing invocation bun run --silent csaa:analyze:command-dispatch-topology is CONFIGURED_NOT_RUN by inventory generation. The facade is not a registered JAN-CSAA-007 OperationResponse, completes no DWP, and publishes ${COMMAND_DISPATCH_TOPOLOGY_REPORT_NONCLAIMS.join(', ')}. It confers no runtime dispatch, path-feasibility, guard-rejection, payload-success, handler-invocation, performability, CAP-010 project-context, semantic-query, slicing, impact, comparison, architecture, finding, gate, remediation, safe-removal, replacement-equivalence, full JAN-CSAA-007/008 conformance, or security-sandbox claim.`,
			id: 'command-dispatch-static-topology',
			provider: 'typescript+command-handler-graph-overlay',
			provenance: [
				...JPWB_COMMAND_DISPATCH_TOPOLOGY_PROVENANCE,
				...JPWB_COMMAND_DISPATCH_TOPOLOGY_REPORT_PROVENANCE,
				...JPWB_COMMAND_HANDLER_GRAPH_PROVENANCE,
				...JPWB_COMMAND_DISPATCH_RETAINED_CENSUS_REFERENCE,
				...TYPESCRIPT_STRUCTURAL_SEMANTIC_PROVENANCE,
				'capabilities#command-handler-static-projection',
				'capabilities#symbol-table',
				'capabilities#typescript-ast',
				'package.json#/scripts/csaa:analyze:command-dispatch-topology'
			],
			state: 'PARTIAL'
		},
		{
			explanation: `The ninth bounded DWP-004 increment implements the ${GUARD_ENFORCEMENT_LEDGER_INTEGRATION_STRATEGY} strategy through exact adapter ${GUARD_ENFORCEMENT_LEDGER_ADAPTER_ID} and method ${GUARD_ENFORCEMENT_LEDGER_METHOD}, preserving every retained guarded-arrow occurrence, distinct guard text, ledger classification, enforcement citation, anchor, and audit finding from the JPWB guard-enforcement ledger. It derives capsule membership as the transitive relative-import closure of the retained analyzer and data roots over frozen subject bytes, binds each closure member as an exact ANALYZER_DEPENDENCY_SOURCE FrozenSubject artifact fail-closed with no partial closure, and reports every undecidable specifier as a POPULATION_RECONCILIATION_FAILED diagnostic rather than dropping it silently. It executes the retained analyzer and data exports in an isolated temporary byte capsule, verifies subject and executor integrity, and publishes deterministic raw and normalized evidence without changing the ${GUARD_ENFORCEMENT_LEDGER_VERIFIER_AUTHORITY} verifier authority, test gate, oracle, baseline, or source implementation. Process isolation is not a hostile-code security sandbox, retained subject initializers may execute inside the capsule, and worker duration/output guards cannot confine an intentionally detached descendant process. Public in-memory exact-shape validation must enumerate already-materialized plain-object keys; maxRecords bounds containers and array entries but is not a transport byte ceiling or an object-key enumeration bound. The retained Vitest authority is identity-bound but NOT_EXECUTED_BY_CSAA. An implementation-local preliminary coding-agent report facade under ${GUARD_ENFORCEMENT_LEDGER_REPORT_OPERATION_VERSION} admits one explicit bounded project set plus mandatory execution acknowledgement ${GUARD_ENFORCEMENT_LEDGER_REPORT_EXECUTION_SELECTION}, captures the retained analyzer, data, authority test, and the analyzer's retained arrow-census dependency in the same FrozenSubject, independently validates the exact artifact set and returned complete or partial observation, reconciles executor identity to the selected analyzer and data bindings, verifies final selected-captured-subject currentness, and emits one maxResultBytes-bounded admitted partial ${GUARD_ENFORCEMENT_LEDGER_REPORT_SCHEMA_VERSION} report with ${GUARD_ENFORCEMENT_LEDGER_REPORT_RESULT_SCHEMA_VERSION} result and full validated retained evidence; successful evidence is never truncated. Its request schema is ${GUARD_ENFORCEMENT_LEDGER_REPORT_REQUEST_SCHEMA_VERSION}, exact selection is ${JSON.stringify(GUARD_ENFORCEMENT_LEDGER_REPORT_SELECTION)}, capability status is ${GUARD_ENFORCEMENT_LEDGER_REPORT_CAPABILITY_STATUS}, registry status is ${GUARD_ENFORCEMENT_LEDGER_REPORT_REGISTRY_STATUS}, scope is ${GUARD_ENFORCEMENT_LEDGER_REPORT_SCOPE}, analysis authority is ${GUARD_ENFORCEMENT_LEDGER_REPORT_AUTHORITY}, authority transfer is ${GUARD_ENFORCEMENT_LEDGER_REPORT_AUTHORITY_TRANSFER}, and gate effect is ${GUARD_ENFORCEMENT_LEDGER_REPORT_GATE_EFFECT}. Final CURRENT_FOR_CAPTURED_SUBJECT is scoped to SELECTED_CAPTURED_SUBJECT_ONLY and establishes neither persistent nor cross-revision currentness. The facade is not a registered JAN-CSAA-007 OperationResponse, does not complete DWP-004, DWP-005, or DWP-006, and publishes ${GUARD_ENFORCEMENT_LEDGER_REPORT_NONCLAIMS.join(', ')}. Its bounded best-effort JSONL progress transport is excluded from report identity and evidence. The machine-facing coding-agent invocation bun run --silent csaa:analyze:guard-enforcement-ledger is CONFIGURED_NOT_RUN by inventory generation. The package root exports the report contract, runner, progress-event schema, and transport schema/limits/types; the parsed-request command adapter, JSONL writer, request admission, and dependency-injection seam remain implementation-private. Ledger classifications remain retained repository judgments: neither provider nor facade proves guard dominance, reachability, runtime enforcement, command performability or refusal, effects, events, persistence behavior, replacement equivalence, or full JAN-CSAA-007/008 conformance.`,
			id: 'guard-enforcement-ledger',
			provider: GUARD_ENFORCEMENT_LEDGER_ADAPTER_ID,
			provenance: [
				...JPWB_GUARD_ENFORCEMENT_LEDGER_PROVENANCE,
				...JPWB_GUARD_ENFORCEMENT_LEDGER_RETAINED_PROVENANCE,
				...JPWB_GUARD_ENFORCEMENT_LEDGER_REPORT_PROVENANCE,
				'package.json#/scripts/csaa:analyze:guard-enforcement-ledger'
			],
			state: 'PARTIAL'
		},
		{
			explanation: `The tenth bounded DWP-004 increment composes the validated retained guard-enforcement ledger, generated state-machine observation and graph, retained arrow observation, command-handler graph, one FrozenSubject, and one structural semantic snapshot. It preserves all guard classifications without promotion; maps every ledger arrow to its exact legal-transition record and complete projected state-edge set; correlates every matching retained declared-command occurrence; and rebinds ENFORCED citations by exact path and unique anchor text instead of stale retained line numbers. Exact direct-handler links remain JAN-CSAA-CAP-027 derivation evidence based only on static AST containment. Shared-factory links remain candidate-only JAN-CSAA-CAP-028 inference evidence, and helper citations remain explicit frontiers. An implementation-local preliminary coding-agent report facade under ${GUARD_CLASSIFICATION_OVERLAY_REPORT_OPERATION_VERSION} admits exactly the fixed seven-project JPWB command-handler closure plus mandatory retained-execution acknowledgement ${GUARD_CLASSIFICATION_OVERLAY_REPORT_EXECUTION_SELECTION}; captures a validated structural semantic snapshot, retained-arrow artifacts, and fixed retained guard-ledger artifacts in one FrozenSubject through a same-process nonserialized command-handler pipeline handoff; independently validates the retained-arrow observation, command-handler graph, guard artifact set and guard observation; selects exact state source ${GUARD_CLASSIFICATION_OVERLAY_REPORT_STATE_SOURCE.logicalPath} under ${GUARD_CLASSIFICATION_OVERLAY_REPORT_STATE_SOURCE.projectConfigPath}; constructs and independently validates the state observation, PARTIAL/OPEN state graph, and PARTIAL/OPEN guard-classification overlay; reconciles all subject, predecessor request, budget, identity, digest, authority, limitation, index, coverage, state-source, and candidate-frontier bindings; and performs one final selected-captured-subject currentness check. It emits one maxResultBytes-bounded admitted partial ${GUARD_CLASSIFICATION_OVERLAY_REPORT_SCHEMA_VERSION} report with ${GUARD_CLASSIFICATION_OVERLAY_REPORT_RESULT_SCHEMA_VERSION} result, a bounded semantic snapshot summary, and full retained-arrow, command-handler, guard, state-observation, state-graph, and overlay evidence; successful evidence is never truncated. Its request schema is ${GUARD_CLASSIFICATION_OVERLAY_REPORT_REQUEST_SCHEMA_VERSION}, exact selection is ${JSON.stringify(GUARD_CLASSIFICATION_OVERLAY_REPORT_SELECTION)}, distinct facade scope is ${GUARD_CLASSIFICATION_OVERLAY_REPORT_SCOPE}, analysis authority is ${GUARD_CLASSIFICATION_OVERLAY_REPORT_AUTHORITY}, authority transfer is ${GUARD_CLASSIFICATION_OVERLAY_REPORT_AUTHORITY_TRANSFER}, and gate effect is ${GUARD_CLASSIFICATION_OVERLAY_REPORT_GATE_EFFECT}. Dispatch topology and command-event evidence remain explicitly NOT_CONSUMED. The retained guard and arrow authorities remain delegated, and their retained test gates are identity-bound but NOT_EXECUTED_BY_CSAA. The public package surface exports the report contract, runner, progress-event schema, and transport schema/limits/types while its same-process FrozenSubject-and-semantic handoff, request admission, dependency/replay seams, parsed-request adapter, and JSONL writer remain implementation-private. The machine-facing invocation bun run --silent csaa:analyze:guard-classification-overlay and the dedicated structural common-subject smoke command are CONFIGURED_NOT_RUN by inventory generation. The facade is not a registered JAN-CSAA-007 OperationResponse, completes no DWP, and publishes ${GUARD_CLASSIFICATION_OVERLAY_REPORT_NONCLAIMS.join(', ')}. Static correlation neither invokes nor executes handlers and does not prove handler ownership, refusal semantics, CFG dominance, reachability, runtime enforcement or performability, effects, events, persistence, replacement equivalence, provider qualification, or full JAN-CSAA-007/008 conformance.`,
			id: 'guard-classification-static-overlay',
			provider: 'typescript+retained-guard-state-handler-overlay',
			provenance: canonicalProvenance(
				...JPWB_GUARD_CLASSIFICATION_OVERLAY_PROVENANCE,
				...JPWB_GUARD_CLASSIFICATION_OVERLAY_REPORT_PROVENANCE,
				...JPWB_GUARD_ENFORCEMENT_LEDGER_PROVENANCE,
				...JPWB_GUARD_ENFORCEMENT_LEDGER_RETAINED_PROVENANCE,
				...JPWB_STATE_MACHINE_GRAPH_PROVENANCE,
				...JPWB_COMMAND_HANDLER_GRAPH_PROVENANCE,
				...JPWB_ARROW_COMMAND_CENSUS_PROVENANCE,
				...JPWB_ARROW_COMMAND_CENSUS_RETAINED_PROVENANCE,
				...TYPESCRIPT_STRUCTURAL_SEMANTIC_PROVENANCE,
				'capabilities#arrow-command-census',
				'capabilities#command-handler-static-projection',
				'capabilities#guard-enforcement-ledger',
				'capabilities#state-machine-graph',
				'capabilities#symbol-table',
				'capabilities#typescript-ast',
				'package.json#/scripts/csaa:semantic:smoke:guard-classification',
				'package.json#/scripts/csaa:analyze:guard-classification-overlay'
			),
			state: 'PARTIAL'
		},
		{
			explanation: `The eleventh bounded DWP-004 increment composes the validated command-handler graph, one frozen subject, and one structural semantic snapshot with the exact generated COMMANDS and EVENTS declarations, exact command/event vocabulary artifact, and exact retained event-surface census artifact. It records primary and additional command-declared event links, event payload-schema references, the retained BOUND formula's command-primary and transition-binding contributions, and the dated pinned EMITTED set, while preserving distinct sets and explicit discrepancy frontiers. Exact overlay-originated records occupy the JAN-CSAA-CAP-027 derivation lane; referenced predecessor handler attributions remain visibly exact, candidate, or unresolved without promotion. The overlay's JAN-CSAA-CAP-028 inference lane is present but empty: it adds no candidate relationship or runtime conclusion from a surface discrepancy. An implementation-local unregistered preliminary coding-agent report facade under ${COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_OPERATION_VERSION} admits exactly the fixed seven-project JPWB command-handler closure plus mandatory retained-execution acknowledgement ${COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_EXECUTION_SELECTION}; captures a validated structural semantic snapshot, fixed retained-arrow artifacts, exact COMMANDS/EVENTS registry, vocabulary, and retained event-census artifacts in one FrozenSubject through a same-process nonserialized command-handler pipeline handoff; independently validates the retained-arrow observation, command-handler graph, fixed report inputs, and command-event overlay; reconciles subject, predecessor budgets, identities, digests, registry/vocabulary/census bindings, authority, limitations, indexes, coverage, and derivation-lane attribution; and performs one final selected-captured-subject currentness check. It emits one maxResultBytes-bounded admitted partial ${COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SCHEMA_VERSION} report with ${COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_RESULT_SCHEMA_VERSION} result, a bounded semantic snapshot summary, and full retained-arrow, command-handler, registry, vocabulary, retained-census, and command-event overlay evidence; successful evidence is never truncated. Its request schema is ${COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_REQUEST_SCHEMA_VERSION}, exact selection is ${JSON.stringify(COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SELECTION)}, distinct facade scope is ${COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SCOPE}, analysis authority is ${COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_AUTHORITY}, authority transfer is ${COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_AUTHORITY_TRANSFER}, and gate effect is ${COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_GATE_EFFECT}. The facade and embedded overlay remain PARTIAL/OPEN and IMPLEMENTATION_LOCAL_UNREGISTERED. Final CURRENT_FOR_CAPTURED_SUBJECT is scoped to SELECTED_CAPTURED_SUBJECT_ONLY and establishes neither persistent nor cross-revision currentness. The retained event-surface census remains RETAINED_DELEGATED, NOT_EXECUTED_BY_CSAA, and NOT_INTEGRATED with no authority, oracle, baseline, or gate change; its exact test bytes are parsed and bound as dated static evidence but the retained Vitest gate is not executed. Command-dispatch topology, guard-enforcement ledger, and guard-classification evidence remain explicitly NOT_CONSUMED. The public package surface exports the report contract, runner, progress-event schema, and transport schema/limits/types while its same-process FrozenSubject-and-semantic handoff, request admission, dependency seam, parsed-request adapter, and JSONL writer remain implementation-private. Its bounded best-effort JSONL progress transport is excluded from report identity and evidence. The machine-facing invocation bun run --silent csaa:analyze:command-event-contract-overlay and the dedicated structural common-subject smoke command are CONFIGURED_NOT_RUN by inventory generation. The facade is not a registered JAN-CSAA-007 OperationResponse, completes no DWP, and publishes ${COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_NONCLAIMS.join(', ')}. Static correlation neither invokes nor executes a handler and does not establish handler ownership, event construction or emission, runtime execution or performability, payload compatibility, control-flow path feasibility or reachability, effects or persistence, replacement equivalence, provider qualification, full JAN-CSAA-007/008 conformance, or a hostile-code security sandbox. The pinned EMITTED set remains a dated static declaration and not fresh runtime evidence.`,
			id: 'command-event-contract-static-overlay',
			provider: 'typescript+command-handler-graph+jpwb-event-contract-overlay',
			provenance: canonicalProvenance(
				...JPWB_COMMAND_EVENT_CONTRACT_OVERLAY_PROVENANCE,
				...JPWB_COMMAND_EVENT_CONTRACT_OVERLAY_INPUT_PROVENANCE,
				...JPWB_COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROVENANCE,
				...JPWB_COMMAND_HANDLER_GRAPH_PROVENANCE,
				...JPWB_ARROW_COMMAND_CENSUS_PROVENANCE,
				...JPWB_ARROW_COMMAND_CENSUS_RETAINED_PROVENANCE,
				...TYPESCRIPT_STRUCTURAL_SEMANTIC_PROVENANCE,
				'capabilities#arrow-command-census',
				'capabilities#command-handler-static-projection',
				'capabilities#symbol-table',
				'capabilities#typescript-ast',
				'package.json#/scripts/csaa:semantic:smoke:command-event-contract',
				'package.json#/scripts/csaa:analyze:command-event-contract-overlay'
			),
			state: 'PARTIAL'
		},
		{
			explanation: `The twelfth bounded DWP-004 increment applies ${STRUCTURAL_SCC_ANALYSIS_METHOD} to one independently validated TypeScript module-dependency graph and deterministically partitions ${STRUCTURAL_SCC_ANALYSIS_SELECTION.nodePopulation} over ${STRUCTURAL_SCC_ANALYSIS_SELECTION.edgePopulation} in ${STRUCTURAL_SCC_ANALYSIS_SELECTION.direction} direction while preserving parallel edges and self-loops. It publishes canonical component membership, node-to-component indexing, internal-edge attribution, cycle-kind classification, exact population and edge-accounting reconciliation, source-graph identity, semantic-snapshot identity, and explicit upstream-closure status under ${STRUCTURAL_SCC_ANALYSIS_CAPABILITY} with ${STRUCTURAL_SCC_ANALYSIS_CAPABILITY_STATUS} status. Structural closure is exact only for the selected validated graph; graph authority is ${STRUCTURAL_SCC_ANALYSIS_GRAPH_AUTHORITY}, authority transfer is ${STRUCTURAL_SCC_ANALYSIS_AUTHORITY_TRANSFER}, and gate effect is ${STRUCTURAL_SCC_ANALYSIS_GATE_EFFECT}. An implementation-local preliminary report facade under ${STRUCTURAL_SCC_REPORT_OPERATION_VERSION} admits one explicit bounded project set, captures one frozen subject and semantic snapshot, constructs and analyzes one validated module-dependency graph, verifies selected-captured-subject currentness, and emits a maxResultBytes-bounded terminal ${STRUCTURAL_SCC_REPORT_SCHEMA_VERSION} envelope with ${STRUCTURAL_SCC_REPORT_RESULT_SCHEMA_VERSION} evidence. Its request schema is ${STRUCTURAL_SCC_REPORT_REQUEST_SCHEMA_VERSION}; it is not a registered JAN-CSAA-007 OperationResponse, and its report nonclaims are ${STRUCTURAL_SCC_REPORT_NONCLAIMS.join(', ')}. The bounded best-effort JSONL progress transport is excluded from report identity and evidence. The coding-agent command csaa:analyze:structural-scc and dedicated structural SCC-only smoke command are CONFIGURED_NOT_RUN by inventory generation. The analysis nonclaims are ${STRUCTURAL_SCC_ANALYSIS_NONCLAIMS.join(', ')}. Full JAN-CSAA-007 conformance is ${STRUCTURAL_SCC_ANALYSIS_FULL_JAN_CSAA_007_CONFORMANCE}, and full JAN-CSAA-008 conformance is ${STRUCTURAL_SCC_ANALYSIS_FULL_JAN_CSAA_008_CONFORMANCE}.`,
			id: 'structural-scc-analysis',
			provider: 'typescript+validated-module-dependency-graph-scc',
			provenance: canonicalProvenance(
				...TYPESCRIPT_STRUCTURAL_SCC_ANALYSIS_PROVENANCE,
				...TYPESCRIPT_STRUCTURAL_SCC_REPORT_PROVENANCE,
				...TYPESCRIPT_MODULE_GRAPH_PROVENANCE,
				...TYPESCRIPT_STRUCTURAL_SEMANTIC_PROVENANCE,
				'capabilities#dependency-graph',
				'capabilities#symbol-table',
				'capabilities#typescript-ast',
				'package.json#/scripts/csaa:semantic:smoke:structural-scc',
				'package.json#/scripts/csaa:analyze:structural-scc'
			),
			state: 'PARTIAL'
		},
		{
			explanation: `The thirteenth bounded DWP-004 increment applies ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_METHOD} to one independently validated TypeScript module-dependency graph and one explicit graph-node criterion in a request-selected FORWARD or REVERSE direction. It deterministically traverses ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION.nodePopulation} over ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION.edgePopulation}, preserves parallel edges under ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION.parallelEdges}, and records ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION.witnessPolicy} parent witnesses, reached-member distances, encountered graph-native resolution-target frontiers, exact population reconciliation, source-graph identity, semantic-snapshot identity, and the carried upstream graph closure and limitations under ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_CAPABILITY} with ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_CAPABILITY_STATUS} status. The analysis is complete-or-unavailable under its budgets: a successful static traversal is NOT_TRUNCATED and structural closure is exact only within that one validated graph and criterion, while upstream closure may remain OPEN. Unvisited nodes have no irrelevance or non-impact meaning. Graph authority is ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_GRAPH_AUTHORITY}, authority transfer is ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_AUTHORITY_TRANSFER}, and gate effect is ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_GATE_EFFECT}. An implementation-local preliminary coding-agent report facade under ${STRUCTURAL_MODULE_REACHABILITY_REPORT_OPERATION_VERSION} admits one explicit bounded project set plus one exact project/logical-path criterion and one FORWARD or REVERSE direction, captures one FrozenSubject and static semantic snapshot, constructs one validated module-dependency graph, binds one exact captured criterion artifact and criterion node, runs the partial CAP-027 analysis, verifies final selected-captured-subject currentness, and emits one maxResultBytes-bounded admitted partial ${STRUCTURAL_MODULE_REACHABILITY_REPORT_SCHEMA_VERSION} report with the full analysis snapshot, bounded predecessor-forest witness evidence, exact criterion-artifact baseline identity, and ${STRUCTURAL_MODULE_REACHABILITY_REPORT_RESULT_SCHEMA_VERSION} result; small refusal envelopes remain emit-able. Its request schema is ${STRUCTURAL_MODULE_REACHABILITY_REPORT_REQUEST_SCHEMA_VERSION}. Final CURRENT_FOR_CAPTURED_SUBJECT is scoped to SELECTED_CAPTURED_SUBJECT_ONLY. The facade is not the stable JAN-CSAA-007 query envelope, does not complete DWP-005 or DWP-006, and publishes ${STRUCTURAL_MODULE_REACHABILITY_REPORT_NONCLAIMS.join(', ')}. Its bounded best-effort JSONL progress transport is excluded from report identity and evidence. The machine-facing coding-agent invocation bun run --silent csaa:analyze:structural-module-reachability and the dedicated structural module-reachability-only smoke command are CONFIGURED_NOT_RUN by inventory generation. The package root publicly exports the analysis builder plus the report contract, runner, progress-event schema, and transport schema/limits/types; the JSONL progress writer and executable command adapter remain trust-bound implementation details and are not package-root exports. The published analysis nonclaims are ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_NONCLAIMS.join(', ')}. Full JAN-CSAA-007 conformance is ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_FULL_JAN_CSAA_007_CONFORMANCE}, and full JAN-CSAA-008 conformance is ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_FULL_JAN_CSAA_008_CONFORMANCE}.`,
			id: 'structural-module-reachability-analysis',
			provider: 'typescript+validated-module-dependency-graph-reachability',
			provenance: canonicalProvenance(
				...TYPESCRIPT_STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_PROVENANCE,
				...TYPESCRIPT_STRUCTURAL_MODULE_REACHABILITY_REPORT_PROVENANCE,
				...TYPESCRIPT_MODULE_GRAPH_PROVENANCE,
				...TYPESCRIPT_STRUCTURAL_SEMANTIC_PROVENANCE,
				'capabilities#dependency-graph',
				'capabilities#symbol-table',
				'capabilities#typescript-ast',
				'package.json#/scripts/csaa:semantic:smoke:structural-module-reachability',
				'package.json#/scripts/csaa:analyze:structural-module-reachability'
			),
			state: 'PARTIAL'
		},
		{
			explanation: `The fourteenth bounded DWP-004 increment applies ${LOGICAL_GRAPH_COMPOSITION_METHOD} under ${LOGICAL_GRAPH_COMPOSITION_CAPABILITY} with ${LOGICAL_GRAPH_COMPOSITION_CAPABILITY_STATUS} status to one independently validated TypeScript module-dependency graph and one independently validated TypeScript call graph derived from the same frozen semantic snapshot. It performs an exact reference-only semanticSourceId join from ${LOGICAL_GRAPH_COMPOSITION_SELECTION.moduleNodePopulation} to ${LOGICAL_GRAPH_COMPOSITION_SELECTION.callNodePopulation} using ${LOGICAL_GRAPH_COMPOSITION_SELECTION.joinKey}, emitting ${LOGICAL_GRAPH_COMPOSITION_SELECTION.crossLinkRelation} cross-links without copying predecessor nodes or edges. Composition mode is ${LOGICAL_GRAPH_COMPOSITION_SELECTION.compositionMode}; conflicts receive ${LOGICAL_GRAPH_COMPOSITION_SELECTION.conflictTreatment} after exact consistency checks over ${LOGICAL_GRAPH_COMPOSITION_SELECTION.consistencyFields.join(', ')}. The current source population is a total mapping with explicit empty unmatched and conflict populations. Source-layer graph identities, semantic-snapshot identities, coverage, health, epistemic state, closure, and limitations are preserved without promotion; composition is complete only for the declared mapping between ${LOGICAL_GRAPH_COMPOSITION_SELECTION.layerOrder.join(' and ')} layers, not for a universal or materialized code property graph. Graph authority is ${LOGICAL_GRAPH_COMPOSITION_GRAPH_AUTHORITY}, authority transfer is ${LOGICAL_GRAPH_COMPOSITION_AUTHORITY_TRANSFER}, and gate effect is ${LOGICAL_GRAPH_COMPOSITION_GATE_EFFECT}. Freshness is ${LOGICAL_GRAPH_COMPOSITION_FRESHNESS}, and currentness is ${LOGICAL_GRAPH_COMPOSITION_CURRENTNESS}. An implementation-local preliminary coding-agent report facade under ${LOGICAL_GRAPH_COMPOSITION_REPORT_OPERATION_VERSION} admits one explicit bounded project set and emits one exact same-subject project-context, module-dependency, call, and two-layer reference-only composition evidence set under ${LOGICAL_GRAPH_COMPOSITION_REPORT_SCHEMA_VERSION} and ${LOGICAL_GRAPH_COMPOSITION_REPORT_RESULT_SCHEMA_VERSION}. Its request schema is ${LOGICAL_GRAPH_COMPOSITION_REPORT_REQUEST_SCHEMA_VERSION}, its exact selection is ${JSON.stringify(LOGICAL_GRAPH_COMPOSITION_REPORT_SELECTION)}, its analysis authority is ${LOGICAL_GRAPH_COMPOSITION_REPORT_AUTHORITY}, authority transfer is ${LOGICAL_GRAPH_COMPOSITION_REPORT_AUTHORITY_TRANSFER}, gate effect is ${LOGICAL_GRAPH_COMPOSITION_REPORT_GATE_EFFECT}, and full capability is ${LOGICAL_GRAPH_COMPOSITION_REPORT_FULL_CAPABILITY}. The facade remains preliminary and unregistered, preserves PARTIAL/OPEN status and every predecessor limitation, performs its final currentness check only for the selected captured subject, and does not claim query, slice, impact, finding, remediation, dead-code, safe-removal, DWP-004/DWP-005/DWP-006 completion, G4/G5/G6 passage, or a registered JAN-CSAA-007 operation envelope. The report publishes ${LOGICAL_GRAPH_COMPOSITION_REPORT_NONCLAIMS.join(', ')}. Its bounded best-effort JSONL progress transport is excluded from report identity and evidence. The machine-facing coding-agent invocation bun run --silent csaa:analyze:logical-graph-composition is CONFIGURED_NOT_RUN by inventory generation. The package root exports the report contract, runner, progress-event schema, and transport schema/limits/types; the parsed-request command adapter and JSONL progress writer remain trust-bound implementation details and are not package-root exports. The dedicated FULL-profile logical-graph-composition-only smoke command is CONFIGURED_NOT_RUN by inventory generation. The published nonclaims are ${LOGICAL_GRAPH_COMPOSITION_NONCLAIMS.join(', ')}. Full JAN-CSAA-009 conformance is ${LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_009_CONFORMANCE}, full JAN-CSAA-007 conformance is ${LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_007_CONFORMANCE}, and full JAN-CSAA-008 conformance is ${LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_008_CONFORMANCE}.`,
			id: 'logical-graph-composition',
			provider: 'typescript+validated-module-and-call-graph-composition',
			provenance: canonicalProvenance(
				...TYPESCRIPT_LOGICAL_GRAPH_COMPOSITION_PROVENANCE,
				...TYPESCRIPT_LOGICAL_GRAPH_COMPOSITION_REPORT_PROVENANCE,
				...TYPESCRIPT_MODULE_GRAPH_PROVENANCE,
				...TYPESCRIPT_CALL_GRAPH_PROVENANCE,
				...TYPESCRIPT_SEMANTIC_PROVENANCE,
				'capabilities#call-graph',
				'capabilities#dependency-graph',
				'capabilities#project-context-graph',
				'capabilities#symbol-table',
				'capabilities#typescript-ast',
				'capabilities#type-graph',
				'package.json#/scripts/csaa:semantic:smoke:logical-graph-composition',
				'package.json#/scripts/csaa:analyze:logical-graph-composition'
			),
			state: 'PARTIAL'
		},
		{
			explanation: `The fifteenth bounded DWP-004 increment applies ${PROJECT_CONTEXT_GRAPH_METHOD} under ${PROJECT_CONTEXT_GRAPH_CAPABILITY} with ${PROJECT_CONTEXT_GRAPH_CAPABILITY_STATUS} status to one exact FrozenSubject and one independently validated static semantic snapshot. It projects ${PROJECT_CONTEXT_GRAPH_SELECTION.projectPopulation}, ${PROJECT_CONTEXT_GRAPH_SELECTION.programPopulation}, and ${PROJECT_CONTEXT_GRAPH_SELECTION.sourcePopulation}; emits exact ${PROJECT_CONTEXT_GRAPH_SELECTION.membershipRelations.join(' and ')} membership records; and resolves ${PROJECT_CONTEXT_GRAPH_SELECTION.projectReferencePopulation} by ${PROJECT_CONTEXT_GRAPH_SELECTION.referenceResolutionBasis}. The current predecessor contract proves that every declared project reference resolves within the selected project population, so successful outside-selected and unresolved populations are explicitly empty and reference closure is closed for the validated selected subject. Variant policy is ${PROJECT_CONTEXT_GRAPH_SELECTION.variantPolicy}, and effective configuration is limited to ${PROJECT_CONTEXT_GRAPH_SELECTION.effectiveConfigurationPolicy}; no additional build, test, browser, SSR, generated, or consumer variant is inferred. Graph authority is ${PROJECT_CONTEXT_GRAPH_GRAPH_AUTHORITY}, authority transfer is ${PROJECT_CONTEXT_GRAPH_AUTHORITY_TRANSFER}, gate effect is ${PROJECT_CONTEXT_GRAPH_GATE_EFFECT}, freshness is ${PROJECT_CONTEXT_GRAPH_FRESHNESS}, and currentness is ${PROJECT_CONTEXT_GRAPH_CURRENTNESS}. An implementation-local preliminary report facade under ${PROJECT_CONTEXT_REPORT_OPERATION_VERSION} admits one explicit bounded project set, captures one FrozenSubject and static semantic snapshot, constructs one validated project context graph, verifies final selected-captured-subject currentness, and emits one maxResultBytes-bounded admitted partial ${PROJECT_CONTEXT_REPORT_SCHEMA_VERSION} report with ${PROJECT_CONTEXT_REPORT_RESULT_SCHEMA_VERSION} evidence; small refusal envelopes remain emit-able. Its request schema is ${PROJECT_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION}. The facade-level CURRENT_FOR_CAPTURED_SUBJECT observation is scoped to SELECTED_CAPTURED_SUBJECT_ONLY and does not alter or promote the embedded graph's ${PROJECT_CONTEXT_GRAPH_FRESHNESS} freshness or ${PROJECT_CONTEXT_GRAPH_CURRENTNESS} currentness. The report remains partial, is not a registered JAN-CSAA-007 OperationResponse, and publishes the nonclaims ${PROJECT_CONTEXT_REPORT_NONCLAIMS.join(', ')}. Its bounded best-effort JSONL progress transport is excluded from report identity and evidence. The coding-agent command csaa:analyze:project-context and the dedicated STRUCTURAL-profile project-context-only smoke command are CONFIGURED_NOT_RUN by inventory generation. The graph's published nonclaims are ${PROJECT_CONTEXT_GRAPH_NONCLAIMS.join(', ')}. Full JAN-CSAA-010 conformance is ${PROJECT_CONTEXT_GRAPH_FULL_JAN_CSAA_010_CONFORMANCE}.`,
			id: 'project-context-graph',
			provider: 'typescript+frozen-project-context-projection',
			provenance: canonicalProvenance(
				...TYPESCRIPT_PROJECT_CONTEXT_GRAPH_PROVENANCE,
				...TYPESCRIPT_PROJECT_CONTEXT_REPORT_PROVENANCE,
				...TYPESCRIPT_STRUCTURAL_SEMANTIC_PROVENANCE,
				'capabilities#symbol-table',
				'capabilities#typescript-ast',
				'package.json#/scripts/csaa:semantic:smoke:project-context-graph',
				'package.json#/scripts/csaa:analyze:project-context'
			),
			state: 'PARTIAL'
		},
		{
			explanation: `The sixteenth bounded DWP-004 increment applies ${CONDITIONAL_EXPORT_RESOLUTION_METHOD} to a ${CONDITIONAL_EXPORT_RESOLUTION_CAPABILITY_STATUS} ${CONDITIONAL_EXPORT_RESOLUTION_CAPABILITY} slice for one explicit consumer source and Program, one exact selected FrozenSubject workspace package manifest, one exact . or ./subpath request, one IMPORT or REQUIRE mode, one NODE or NEUTRAL platform, an explicit ordered unique condition population, one independently validated static semantic snapshot, and one independently validated project context graph. It reads only exact frozen manifest bytes, preserves raw manifest declaration order and UTF-16 source spans, binds a raw exports-value digest, supports explicit exact-key and root-dot-sugar string/null targets plus nested exact-key condition trees with string/null leaves, and publishes one context-specific decision with ordered selected, candidate, and excluded branch records. Unsupported arrays, patterns, package imports maps, target syntax outside the declared safe subset, and other unsupported selected surfaces remain explicit frontiers and never become a false resolution miss. Successful output is complete-or-unavailable under caller budgets and is never truncated. The exact selection policy is ${JSON.stringify(CONDITIONAL_EXPORT_RESOLUTION_SELECTION)}. Resolution authority is ${CONDITIONAL_EXPORT_RESOLUTION_AUTHORITY}, authority transfer is ${CONDITIONAL_EXPORT_RESOLUTION_AUTHORITY_TRANSFER}, gate effect is ${CONDITIONAL_EXPORT_RESOLUTION_GATE_EFFECT}, freshness is ${CONDITIONAL_EXPORT_RESOLUTION_FRESHNESS}, and currentness is ${CONDITIONAL_EXPORT_RESOLUTION_CURRENTNESS}. The dedicated STRUCTURAL-profile conditional-export-resolution-only smoke command is CONFIGURED_NOT_RUN by inventory generation. The published nonclaims are ${CONDITIONAL_EXPORT_RESOLUTION_NONCLAIMS.join(', ')}. Full JAN-CSAA-012 conformance is ${CONDITIONAL_EXPORT_RESOLUTION_FULL_JAN_CSAA_012_CONFORMANCE}.`,
			id: 'conditional-export-resolution',
			provider: 'typescript+frozen-workspace-conditional-export-resolution',
			provenance: canonicalProvenance(
				...TYPESCRIPT_CONDITIONAL_EXPORT_RESOLUTION_PROVENANCE,
				'capabilities#project-context-graph',
				'package.json#/scripts/csaa:semantic:smoke:conditional-export-resolution'
			),
			state: 'PARTIAL'
		},
		{
			explanation: `The seventeenth bounded DWP-004 increment applies ${MODULE_RESOLUTION_TRACE_METHOD} to a ${MODULE_RESOLUTION_TRACE_CAPABILITY_STATUS} ${MODULE_RESOLUTION_TRACE_CAPABILITY} slice for one exact literal bare workspace-package root value, non-type-only IMPORT occurrence after independently validating its FrozenSubject-bound static semantic snapshot, project context graph, and a newly constructed conditional-export predecessor with explicit types condition, NODE platform, and IMPORT mode. The fixed report selection is ${JSON.stringify(MODULE_RESOLUTION_TRACE_REPORT_SELECTION)}. The configured smoke criterion is packages/rph-application/src/command-bus.ts importing @janumipwb/rph-contracts, with exact resolved declaration build-output target packages/rph-contracts/dist/index.d.ts and captured target-byte digest and length. It invokes public TypeScript getImpliedNodeFormatForFile, createSourceFile, getModeForUsageLocation, and resolveModuleName against only the exact verified project-scoped in-memory capture; records fresh two-stage ordered callbacks as exact query/observation attempts; derives candidates bijectively only from MODULE_RESOLUTION-stage FILE_EXISTS attempts; and publishes exact importer, resolver configuration, case-sensitivity, condition-membership, capture, selected-target, relation, coverage, and reconciliation witnesses. Successful output is complete-or-unavailable under caller budgets, PARTIAL, and NOT_TRUNCATED. The attached capture capability is in-memory and exact-object-bound: serialization, structured cloning, persistence, and deserialized replay do not carry it. An implementation-local preliminary coding-agent facade under ${MODULE_RESOLUTION_TRACE_REPORT_OPERATION_VERSION} admits one explicit bounded project set plus exact project/source/literal coordinate and bare workspace package, constructs the validated CAP-010, CAP-012, and CAP-011 chain in one process, and emits one maxResultBytes-bounded admitted partial ${MODULE_RESOLUTION_TRACE_REPORT_SCHEMA_VERSION} report with full embedded predecessor evidence and ${MODULE_RESOLUTION_TRACE_REPORT_RESULT_SCHEMA_VERSION} summary; small refusal envelopes remain emit-able. Its request schema is ${MODULE_RESOLUTION_TRACE_REPORT_REQUEST_SCHEMA_VERSION}. Final CURRENT_FOR_CAPTURED_SUBJECT is explicitly limited to SELECTED_CAPTURED_SUBJECT_ONLY; compiler capture and the CONTEXT_ONLY target remain NOT_ASSESSED, and embedded freshness/currentness fields remain unchanged. The embedded trace retains its full predecessor nonclaim set, including CURRENTNESS_OR_FRESHNESS; that broad trace nonclaim is not copied into the facade nonclaim set. The facade is not a registered JAN-CSAA-007 OperationResponse, does not complete DWP-004, DWP-005, or DWP-006, and publishes ${MODULE_RESOLUTION_TRACE_REPORT_NONCLAIMS.join(', ')}. Its bounded best-effort JSONL progress transport is excluded from report identity and evidence. The machine-facing coding-agent invocation bun run --silent csaa:analyze:module-resolution-trace and the dedicated STRUCTURAL-profile module-resolution-trace-only smoke command are CONFIGURED_NOT_RUN by inventory generation. The package root publicly exports buildModuleResolutionTrace and validateModuleResolutionTrace plus the report contract, runner, progress-event schema, and transport schema/limits/types; the JSONL progress writer, parsed-request executable adapter, attachVerifiedCompilerCaptureToStaticSemanticSnapshot, getStaticSemanticSnapshotCompilerProjectInputLookup, validateConstructedModuleResolutionTrace, and the mutable @internal moduleResolutionTraceTypeScriptPublicApi test seam remain trust-bound implementation details and are not package-root exports. The exact selection policy is ${JSON.stringify(MODULE_RESOLUTION_TRACE_SELECTION)}. Resolution authority is ${MODULE_RESOLUTION_TRACE_AUTHORITY}, authority transfer is ${MODULE_RESOLUTION_TRACE_AUTHORITY_TRANSFER}, gate effect is ${MODULE_RESOLUTION_TRACE_GATE_EFFECT}, freshness is ${MODULE_RESOLUTION_TRACE_FRESHNESS}, and currentness is ${MODULE_RESOLUTION_TRACE_CURRENTNESS}. The published trace nonclaims are ${MODULE_RESOLUTION_TRACE_NONCLAIMS.join(', ')}. Full JAN-CSAA-011 conformance is ${MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_011_CONFORMANCE}, full JAN-CSAA-007 conformance is ${MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_007_CONFORMANCE}, and full JAN-CSAA-008 conformance is ${MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_008_CONFORMANCE}.`,
			id: 'module-resolution-trace',
			provider: 'typescript+verified-project-capture-module-resolution-trace',
			provenance: canonicalProvenance(
				...TYPESCRIPT_MODULE_RESOLUTION_TRACE_PROVENANCE,
				...TYPESCRIPT_MODULE_RESOLUTION_TRACE_REPORT_PROVENANCE,
				'capabilities#conditional-export-resolution',
				'capabilities#project-context-graph',
				'capabilities#symbol-table',
				'capabilities#typescript-ast',
				'package.json#/scripts/csaa:semantic:smoke:module-resolution-trace',
				'package.json#/scripts/csaa:analyze:module-resolution-trace'
			),
			state: 'PARTIAL'
		},
		{
			explanation: `The bounded DWP-003 semantic-completion increment applies ${DECLARATION_CONTEXT_ANALYSIS_METHOD} to a ${DECLARATION_CONTEXT_ANALYSIS_CAPABILITY_STATUS} ${DECLARATION_CONTEXT_ANALYSIS_CAPABILITY} slice for one exact package-root export name in the ${MODULE_RESOLUTION_TRACE_CAPABILITY} selected WORKSPACE_BUILD_DECLARATION target. It independently validates and binds JAN-CSAA-CAP-001 through the exact FrozenSubject-bound StaticSemanticSnapshot carrier, ${PROJECT_CONTEXT_GRAPH_CAPABILITY}, ${MODULE_RESOLUTION_TRACE_CAPABILITY}, and ${CONDITIONAL_EXPORT_RESOLUTION_CAPABILITY}; CAP-002 declaration and symbol identities are explicitly forbidden inputs. The selected supported slice reconstructs one fresh public-TypeScript Program over the verified project-scoped compiler capture, meters every Program, checker-creation, caller-analysis, and separate declaration-artifact parse input attempt and duplicate PRESENT read byte, inventories every Program source and AST node, completely enumerates the package-root export symbols, accepts only a zero-hop direct root export or one same-root local-only ExportSpecifier without a module specifier whose property name directly identifies the terminal declaration through one public getAliasedSymbol call, and creates an exact byte-bound public createSourceFile parse witness for the selected root declaration artifact. It emits exactly one selected export binding, one terminal checker symbol, the complete same-root terminal declaration set, one declaration artifact, declarations, a zero-or-one merge classification, and exact DECLARES, CONTRIBUTES_TO, and linear MERGES_WITH participation relations. Cross-file declarations or merges, reexports, multi-hop or indirect alias bindings, unsupported declaration kinds, non-declaration or non-WORKSPACE_BUILD_DECLARATION targets, module/global augmentation syntax, ambient-effect syntax, and incompatible predecessors fail closed as unavailable; augmentation and ambient-effect output populations are explicitly empty. Successful output is complete-or-unavailable under caller budgets, ${DECLARATION_CONTEXT_ANALYSIS_CAPABILITY_STATUS}, and NOT_TRUNCATED. The elapsed wall-clock budget brackets synchronous predecessor-validator and public-TypeScript capability calls and fails closed on return, but does not claim preemptive cancellation inside those separately bounded calls. The exact selection policy is ${JSON.stringify(DECLARATION_CONTEXT_ANALYSIS_SELECTION)}. Analysis authority is ${DECLARATION_CONTEXT_ANALYSIS_AUTHORITY}, authority transfer is ${DECLARATION_CONTEXT_ANALYSIS_AUTHORITY_TRANSFER}, gate effect is ${DECLARATION_CONTEXT_ANALYSIS_GATE_EFFECT}, freshness is ${DECLARATION_CONTEXT_ANALYSIS_FRESHNESS}, and currentness is ${DECLARATION_CONTEXT_ANALYSIS_CURRENTNESS}. The package root publicly exports buildDeclarationContextAnalysis and validateDeclarationContextAnalysis; createCompilerProjectProgramSession, createPrevalidatedVerifiedCompilerProjectInputHost, the callback-scoped withAttributedQueryForVerifiedHost borrowed-input path, getStaticSemanticSnapshotCompilerProjectInputLookup, validateConstructedDeclarationContextAnalysis, the immutable per-call @internal validateDeclarationContextAnalysisWithProviderForTesting provider-fault injection entry, the immutable @internal compareDeclarationContextAnalysisCanonicalValuesForTesting comparator probe, the mutable @internal declarationContextAnalysisCompilerProgramCapability and declarationContextAnalysisTypeScriptPublicApi producer test seams, the progress-aware canonicalSemanticJsonWithProgress, canonicalSemanticJsonWitnessWithProgress, canonicalSemanticJsonPrefixedSha256, and compareCanonicalSemanticJsonStrings helpers, and fixture support remain trust-bound implementation details and are not package-root exports. The callback-free one-argument canonicalSemanticJson and canonicalSemanticJsonWitness APIs remain package-root public and byte-compatible. An implementation-local preliminary coding-agent report facade under ${DECLARATION_CONTEXT_REPORT_OPERATION_VERSION} admits one explicit bounded project set plus one exact project/source/literal importer coordinate, one bare workspace package, and one exact package-root export name; reuses the validated CAP-010/CAP-012/CAP-011 captured predecessor chain; constructs one partial CAP-013 declaration context analysis; verifies final selected-captured-subject currentness; and emits one maxResultBytes-bounded admitted partial ${DECLARATION_CONTEXT_REPORT_SCHEMA_VERSION} report with full embedded project-context, conditional-export, module-resolution-trace, and declaration-context evidence and ${DECLARATION_CONTEXT_REPORT_RESULT_SCHEMA_VERSION} result; small refusal envelopes remain emit-able. Its request schema is ${DECLARATION_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION}, and its exact report selection is ${JSON.stringify(DECLARATION_CONTEXT_REPORT_SELECTION)}. Final CURRENT_FOR_CAPTURED_SUBJECT is scoped to SELECTED_CAPTURED_SUBJECT_ONLY; compiler capture and the CONTEXT_ONLY declaration target remain NOT_ASSESSED, and embedded predecessor freshness/currentness fields remain unchanged. The report preserves its predecessor nonclaims as nested evidence, including the analysis-layer CURRENTNESS_OR_FRESHNESS nonclaim, rather than copying that broad nonclaim into the facade set. The facade is not a registered JAN-CSAA-007 OperationResponse, does not complete DWP-003, DWP-004, DWP-005, or DWP-006, adds no authority, and publishes ${DECLARATION_CONTEXT_REPORT_NONCLAIMS.join(', ')}. Its bounded best-effort JSONL progress transport is excluded from report identity and evidence. The machine-facing coding-agent invocation bun run --silent csaa:analyze:declaration-context and the dedicated STRUCTURAL-profile declaration-context-analysis-only smoke command are CONFIGURED_NOT_RUN by inventory generation. The package root additionally exports the report contract, runner, progress-event schema, and transport schema/limits/types; the parsed-request command adapter, JSONL progress writer, internal inherited-request admission seam admitModuleResolutionTraceReportRequest, and internal predecessor capture seam captureModuleResolutionTraceReportPipeline remain trust-bound implementation details and are not package-root exports. The published nonclaims are ${DECLARATION_CONTEXT_ANALYSIS_NONCLAIMS.join(', ')}. Full JAN-CSAA-013 conformance is ${DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_013_CONFORMANCE}, full JAN-CSAA-007 conformance is ${DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_007_CONFORMANCE}, and full JAN-CSAA-008 conformance is ${DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_008_CONFORMANCE}.`,
			id: 'declaration-context-analysis',
			provider: 'typescript+verified-project-capture-declaration-context-analysis',
			provenance: canonicalProvenance(
				...TYPESCRIPT_DECLARATION_CONTEXT_ANALYSIS_PROVENANCE,
				...TYPESCRIPT_DECLARATION_CONTEXT_REPORT_PROVENANCE,
				'capabilities#conditional-export-resolution',
				'capabilities#module-resolution-trace',
				'capabilities#project-context-graph',
				'capabilities#typescript-ast',
				'package.json#/scripts/csaa:semantic:smoke:declaration-context-analysis',
				'package.json#/scripts/csaa:analyze:declaration-context'
			),
			state: 'PARTIAL'
		},
		{
			explanation: `A second bounded DWP-003 semantic-completion increment applies ${SOURCE_ORIGIN_CORRELATION_METHOD} to a ${SOURCE_ORIGIN_CORRELATION_CAPABILITY_STATUS} ${SOURCE_ORIGIN_CORRELATION_CAPABILITY} slice through a self-contained request over one exact FrozenSubject and its exact StaticSemanticSnapshot, exact selected semantic project, Program, root-source identities and logical path, and caller-captured declaration target and external map bytes with exact identities. It has no capability predecessor and does not consume or depend on ${DECLARATION_CONTEXT_ANALYSIS_CAPABILITY}. The supported slice reconstructs a fresh verified project-scoped public-TypeScript Program, emits exactly one selected authored root source to one declaration and one adjacent external declaration map, reconciles both emitted UTF-8 outputs byte-for-byte with the caller captures, strictly decodes the complete flat external source-map v3 mappings population, and emits exact unique zero-width generated/authored location pairs and bidirectional correlations. The v1 map shape is ${SOURCE_ORIGIN_CORRELATION_SELECTION.canonicalSourceMapShape}; map decoding is ${SOURCE_ORIGIN_CORRELATION_SELECTION.mapDecoding}; and range inference is ${SOURCE_ORIGIN_CORRELATION_SELECTION.rangeInference}. Unsupported, ambiguous, inferred, multi-source, indexed, inline, chained, or non-declaration-map surfaces make the operation unavailable rather than producing a truncated or partially mapped result. The configured repository smoke reads its target and adjacent map as caller-supplied ignored local build-artifact captures that are absent from FrozenSubject; they are not checked-in build outputs, FrozenSubject evidence, freshness evidence, or currentness evidence. Successful output is complete for only the exact request selection, NOT_TRUNCATED, and remains ${SOURCE_ORIGIN_CORRELATION_CAPABILITY_STATUS}. Analysis authority is ${SOURCE_ORIGIN_CORRELATION_AUTHORITY}, authority transfer is ${SOURCE_ORIGIN_CORRELATION_AUTHORITY_TRANSFER}, gate effect is ${SOURCE_ORIGIN_CORRELATION_GATE_EFFECT}, freshness is ${SOURCE_ORIGIN_CORRELATION_FRESHNESS}, and currentness is ${SOURCE_ORIGIN_CORRELATION_CURRENTNESS}; no declaration, source, build, finding, gate, or remediation authority is conferred. The exact selection policy is ${JSON.stringify(SOURCE_ORIGIN_CORRELATION_SELECTION)}. The package root publicly exports buildSourceOriginCorrelation and validateSourceOriginCorrelation; the source-map decoder, declaration-emission provider, compiler-Program session, constructed-output validator, mutable provider test seams, canonical helpers, and fixture support remain trust-bound implementation details and are not package-root exports. The dedicated STRUCTURAL-profile source-origin-correlation-only smoke command is CONFIGURED_NOT_RUN by inventory generation. The published nonclaims are ${SOURCE_ORIGIN_CORRELATION_NONCLAIMS.join(', ')}. Full JAN-CSAA-014 conformance is ${SOURCE_ORIGIN_CORRELATION_FULL_JAN_CSAA_014_CONFORMANCE}, full JAN-CSAA-007 conformance is ${SOURCE_ORIGIN_CORRELATION_FULL_JAN_CSAA_007_CONFORMANCE}, and full JAN-CSAA-008 conformance is ${SOURCE_ORIGIN_CORRELATION_FULL_JAN_CSAA_008_CONFORMANCE}.`,
			id: 'source-origin-correlation',
			provider: 'typescript+verified-project-capture-source-origin-correlation',
			provenance: canonicalProvenance(
				...TYPESCRIPT_SOURCE_ORIGIN_CORRELATION_PROVENANCE,
				'capabilities#typescript-ast',
				'package.json#/scripts/csaa:semantic:smoke:source-origin-correlation'
			),
			state: 'PARTIAL'
		},
		{
			explanation: `A preliminary implementation-local unregistered query increment exposes core ${SEMANTIC_SOURCE_QUERY_OPERATION_VERSION} and report facade ${SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION} for one explicitly selected static ${SEMANTIC_SOURCE_QUERY_POPULATION} population retained by one validated semantic snapshot. The fixed safe scalar field registry is ${JSON.stringify(SEMANTIC_SOURCE_QUERY_FIELDS)}, the fixed operator registry is ${JSON.stringify(SEMANTIC_SOURCE_QUERY_OPERATORS)}, and the expression language provides exact scalar equality, exact nonempty case-sensitive logicalPath prefix comparison, unary NOT, and nonempty ordered AND/OR. Prefix evaluation performs no path normalization, globbing, regular-expression matching, or path-segment inference. ${SEMANTIC_SOURCE_QUERY_ALGEBRA_VERSION} preserves exact T/F/U/C evidence-pair composition. Whole-AST validation precedes ${SEMANTIC_SOURCE_QUERY_EXECUTION_MODE} node-total evaluation; the report retains compact source/provenance references, per-record traces, exact truth and applicability partitions, the six independent epistemic dimensions, explicit dynamic-evidence NOT_APPLICABLE, CLOSED_FOR_RETAINED_VALIDATED_SEMANTIC_SOURCES evaluation closure, and OPEN global closure. The facade admits one explicit bounded project set, exact caller-owned executionId, expression, and resource budgets; captures the trusted TypeScript semantic pipeline directly; verifies final selected-captured-subject currentness after detached evidence construction; and emits one maxResultBytes-bounded admitted partial ${SEMANTIC_SOURCE_QUERY_REPORT_SCHEMA_VERSION} report with ${SEMANTIC_SOURCE_QUERY_REPORT_RESULT_SCHEMA_VERSION} result under request schema ${SEMANTIC_SOURCE_QUERY_REPORT_REQUEST_SCHEMA_VERSION}. Successful evidence is never truncated. Core capability status is ${SEMANTIC_SOURCE_QUERY_CAPABILITY_STATUS}; report capability ${SEMANTIC_SOURCE_QUERY_REPORT_CAPABILITY} has status ${SEMANTIC_SOURCE_QUERY_REPORT_CAPABILITY_STATUS}, analysis authority ${SEMANTIC_SOURCE_QUERY_REPORT_AUTHORITY}, authority transfer ${SEMANTIC_SOURCE_QUERY_REPORT_AUTHORITY_TRANSFER}, and gate effect ${SEMANTIC_SOURCE_QUERY_REPORT_GATE_EFFECT}. It is not full JAN-CSAA-CAP-029, does not complete DWP-005 or DWP-006, does not pass or activate G5, is not a registered JAN-CSAA-007 operation or OperationResponse, and creates no rule, finding, severity, remediation, gate, or disposition. Core nonclaims are ${SEMANTIC_SOURCE_QUERY_NONCLAIMS.join(' ')} Facade nonclaims are ${SEMANTIC_SOURCE_QUERY_REPORT_NONCLAIMS.join(', ')}. The bounded best-effort JSONL progress transport is excluded from report identity and evidence. The machine-facing coding-agent invocation bun run --silent csaa:analyze:semantic-source-query is CONFIGURED_NOT_RUN by inventory generation. The package root exports the query/report contracts, four-valued algebra helpers and evaluator, report runner, progress-event schema, and transport schema/limits/types; the parsed-request command adapter, JSONL writer, internal semantic capture seam, failure classifier, and dependency-injection seams remain trust-bound implementation details.`,
			id: 'semantic-source-query',
			provider: 'typescript+implementation-local-semantic-source-query',
			provenance: canonicalProvenance(
				...TYPESCRIPT_SEMANTIC_SOURCE_QUERY_PROVENANCE,
				'capabilities#typescript-ast',
				'package.json#/scripts/csaa:analyze:semantic-source-query'
			),
			state: 'PARTIAL'
		},
		{
			explanation: `A second preliminary implementation-local unregistered DWP-005 increment exposes ${STATIC_MODULE_IMPACT_CANDIDATE_CAPABILITY} with ${STATIC_MODULE_IMPACT_CANDIDATE_CAPABILITY_STATUS} status through ${STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION}. It accepts exactly one ${STATIC_MODULE_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION} caller-declared existing whole-source EDIT seed with an opaque caller-owned working-change-set identity and expected captured artifact SHA-256, then invokes the validated structural module-reachability report exactly once in REVERSE direction. The seed is bound to one current captured artifact, subject, semantic snapshot, semantic source, project, Program, graph node, and source graph. The pure ${STATIC_MODULE_IMPACT_CANDIDATE_METHOD} projection selects ${STATIC_MODULE_IMPACT_CANDIDATE_PROPAGATION.candidatePopulation} over ${STATIC_MODULE_IMPACT_CANDIDATE_PROPAGATION.relationFamily} relations and retains every admitted relation kind ${STATIC_MODULE_IMPACT_CANDIDATE_PROPAGATION.relationKinds.join(', ')}. Every importer is impact-epistemic POSSIBLE; direct and transitive labels describe structural distance only. Every positive candidate includes one complete canonical shortest seed-to-candidate reverse-traversal witness while preserving each native ${STATIC_MODULE_IMPACT_CANDIDATE_PROPAGATION.nativeEdgeOrientation} edge and source citation. The request requires budgets.maxCandidateWitnessHops with an absolute safety ceiling of ${STATIC_MODULE_IMPACT_CANDIDATE_REPORT_SAFETY_CEILINGS.maxCandidateWitnessHops.toLocaleString('en-US')} cumulative duplicated witness hops and, before path allocation, preflights the smaller caller limit and a remaining-result allowance after the exact predecessor bytes, a ${STATIC_MODULE_IMPACT_CANDIDATE_OUTER_RESULT_BASE_BYTE_RESERVATION.toLocaleString('en-US')}-byte outer-envelope reservation, and a ${STATIC_MODULE_IMPACT_CANDIDATE_WITNESS_HOP_RESULT_BYTE_RESERVATION.toLocaleString('en-US')}-byte per-hop resource reservation. Unvisited nodes receive no impact or irrelevance state, a zero-candidate result is not non-impact, and global impact closure remains OPEN while upstream graph health, epistemic state, closure, limitations, frontiers, budgets, non-truncation, currentness, exclusions, and invalidation dependencies remain explicit. Unassessed propagation families are ${STATIC_MODULE_IMPACT_CANDIDATE_UNASSESSED_PROPAGATION_FAMILIES.join(', ')}. Next evidence is ${STATIC_MODULE_IMPACT_CANDIDATE_NEXT_EVIDENCE.join(', ')}. The caller-declared working-change identity is not independently validated and no change content or cross-snapshot diff is analyzed. Full CAP-031 is ${STATIC_MODULE_IMPACT_CANDIDATE_FULL_CAP_031}; analysis authority is ${STATIC_MODULE_IMPACT_CANDIDATE_ANALYSIS_AUTHORITY}, authority transfer is ${STATIC_MODULE_IMPACT_CANDIDATE_AUTHORITY_TRANSFER}, and gate effect is ${STATIC_MODULE_IMPACT_CANDIDATE_GATE_EFFECT}. The facade is not a ChangeSeedRecord, ChangeImpactResultRecord, registered JAN-CSAA-007 operation, DWP-005/DWP-006 completion, or G5/G6 gate evidence and publishes ${STATIC_MODULE_IMPACT_CANDIDATE_REPORT_NONCLAIMS.join(', ')}. It emits one maxResultBytes-bounded admitted partial ${STATIC_MODULE_IMPACT_CANDIDATE_REPORT_SCHEMA_VERSION} report with ${STATIC_MODULE_IMPACT_CANDIDATE_REPORT_RESULT_SCHEMA_VERSION} result under ${STATIC_MODULE_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION}; predecessor CAP-027 progress is reused unchanged and excluded from terminal identity. A final outer FrozenSubject currentness recheck follows report construction and result-size admission and fails closed unless the exact captured predecessor subject remains CURRENT. The machine-facing coding-agent invocation bun run --silent csaa:analyze:static-module-impact-candidates is CONFIGURED_NOT_RUN by inventory generation. The package root exports the contract, runner, and exit-code helper; the executable adapter and reused predecessor JSONL writer remain trust-bound implementation details.`,
			id: 'static-module-impact-candidates',
			provider: 'typescript+validated-reverse-module-impact-candidates',
			provenance: canonicalProvenance(
				...TYPESCRIPT_STATIC_MODULE_IMPACT_CANDIDATE_REPORT_PROVENANCE,
				...TYPESCRIPT_STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_PROVENANCE,
				...TYPESCRIPT_STRUCTURAL_MODULE_REACHABILITY_REPORT_PROVENANCE,
				...TYPESCRIPT_MODULE_GRAPH_PROVENANCE,
				...TYPESCRIPT_STRUCTURAL_SEMANTIC_PROVENANCE,
				'capabilities#dependency-graph',
				'capabilities#structural-module-reachability-analysis',
				'capabilities#symbol-table',
				'capabilities#typescript-ast',
				'package.json#/scripts/csaa:analyze:static-module-impact-candidates'
			),
			state: 'PARTIAL'
		},
		{
			explanation: `A third preliminary implementation-local unregistered DWP-005 increment exposes ${WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_CAPABILITY} with ${WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_CAPABILITY_STATUS} status through ${WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION}. It accepts exactly one ${WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION} existing regular authored source EDIT seed and one exact full lowercase immutable base commit object ID. The path-local ${WORKING_SOURCE_EDIT_OBSERVATION_METHOD} observation reads the selected raw immutable HEAD tree blob, requires the exact stage-zero index blob and regular-file mode to match that HEAD tree entry, fatally decodes both the immutable blob and current raw source as UTF-8, and binds the current bytes by path, byte count, and SHA-256 to the exact FrozenSubject artifact under ${WORKING_SOURCE_EDIT_OBSERVATION_SCHEMA_VERSION}. It does not execute git status or porcelain, enumerate repository-wide dirty state, or execute Git attribute filters, clean/smudge/process filters, external diff drivers, or text normalization; observation exclusions are ${WORKING_SOURCE_EDIT_OBSERVATION_EXCLUSIONS.join(', ')}. The ${WORKING_SOURCE_EDIT_TEXTUAL_CHANGE_METHOD} records one UTF-16 longest-common-prefix/suffix envelope that can contain unchanged interior text and is neither a minimal multi-hunk edit script nor semantic change evidence. Its ${WORKING_SOURCE_EDIT_EVIDENCE_DIGEST_METHOD} evidence digest covers ${WORKING_SOURCE_EDIT_EVIDENCE_DIGEST_SCOPE}. The ${WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_METHOD} composition invokes the existing static-module-impact predecessor once with the observed current artifact digest and evidence digest as its implementation-local working-change binding, then embeds that predecessor report verbatim. Every predecessor importer candidate remains POSSIBLE, direct/transitive remains structural distance only, all native importer-to-imported witnesses and upstream limitations remain unchanged, and global impact closure remains OPEN. Currentness requires the initial exact Git HEAD/tree/stage-zero index/raw-byte observation, exact FrozenSubject binding and final currentness recheck, and a final exact Git reobservation after composition and result-size admission; it is limited to the selected source HEAD, index, raw bytes, and captured subject. The command emits one maxResultBytes-bounded admitted partial ${WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_SCHEMA_VERSION} report with ${WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_RESULT_SCHEMA_VERSION} result under ${WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION}; the absolute result ceiling is ${WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_SAFETY_CEILINGS.maxResultBytes.toLocaleString('en-US')} bytes and successful evidence is not truncated. Next evidence is ${WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_NEXT_EVIDENCE.join(', ')}. This path-local evidence is not a repository-wide WorkingChangeSetRecord, ChangeSeedRecord, ChangeImpactResultRecord, or revision comparison; full CAP-031 is ${WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_FULL_CAP_031}, analysis authority is ${WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_ANALYSIS_AUTHORITY}, authority transfer is ${WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_AUTHORITY_TRANSFER}, and gate effect is ${WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_GATE_EFFECT}. It does not complete DWP-005 or DWP-006, qualify Git or an analysis provider, create a finding or gate, establish runtime impact or behavior preservation, or prove non-impact, irrelevance, dead code, or safe removal, and publishes ${WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_NONCLAIMS.join(', ')}. The machine-facing coding-agent invocation bun run --silent csaa:analyze:working-source-edit-impact-candidates is CONFIGURED_NOT_RUN by inventory generation. The package root exports the contract, runner, and exit-code helper; the Git observer, executable adapter, private exact-subject predecessor handoff, and reused predecessor JSONL writer remain trust-bound implementation details.`,
			id: 'working-source-edit-impact-candidates',
			provider: 'git+typescript+validated-working-source-edit-impact-candidates',
			provenance: canonicalProvenance(
				...TYPESCRIPT_WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_PROVENANCE,
				...TYPESCRIPT_STATIC_MODULE_IMPACT_CANDIDATE_REPORT_PROVENANCE,
				...TYPESCRIPT_STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_PROVENANCE,
				...TYPESCRIPT_STRUCTURAL_MODULE_REACHABILITY_REPORT_PROVENANCE,
				...TYPESCRIPT_MODULE_GRAPH_PROVENANCE,
				...TYPESCRIPT_STRUCTURAL_SEMANTIC_PROVENANCE,
				'capabilities#dependency-graph',
				'capabilities#static-module-impact-candidates',
				'capabilities#structural-module-reachability-analysis',
				'capabilities#symbol-table',
				'capabilities#typescript-ast',
				'package.json#/scripts/csaa:analyze:working-source-edit-impact-candidates'
			),
			state: 'PARTIAL'
		},
		{
			explanation:
				'The jpwb-deterministic-runtime-trace 1.0.0 importer validates a closed runtime-event wire shape for the five allocated hybrid finding IDs and binds normalized evidence to provider identity, exact subject identity, dated run metadata, coverage, freshness, health, conflicts, and raw-artifact identity. It imports evidence only: inventory generation neither executes subject code nor imports a current trace, so current runtime health and any universal runtime graph remain NOT_RUN or UNKNOWN. Analysis authority and gate effect are NONE; this is PARTIAL runtime-trace support.',
			id: 'runtime-traces',
			provider: 'jpwb-deterministic-runtime-trace',
			provenance: canonicalProvenance(...RUNTIME_TRACE_PROVENANCE),
			state: 'PARTIAL'
		},
		{
			explanation:
				'The implementation-local hybrid projector derives exactly five rule-specific DFG or TAINT prerequisite rows from exact retained FrozenSubject bytes at the fixed JPWB implementation paths for findings 9, 19, 45, 54, and 55. The coding-agent findings v2 handler always retains that source-bound projection and can import one optional caller-supplied deterministic trace without launching a provider or executing subject code. The evaluator reconciles only those five rows: unsupported or conflicting static regions remain UNSUPPORTED, absent runtime input is retained as runtimeTrace: null and runtimeEvaluation: null, and supplied but stale, unhealthy, partial, malformed, mismatched, or conflicting runtime evidence remains explicitly unusable with affected rows NOT_RUN. Focused tests cover exact five-row positive evaluation, provider-conflict refusal, and explanation replay tamper detection; the current-JPWB smoke supplies only an explicitly unusable negative control and makes no current-runtime claim. The projector does not implement a general DFG or taint engine, and no provider qualification, analysis authority, or gate effect is created.',
			id: 'hybrid-runtime-evaluation',
			provider: 'jan-csaa-harmonization-hybrid-runtime',
			provenance: canonicalProvenance(...HYBRID_RUNTIME_EVALUATION_PROVENANCE),
			state: 'PARTIAL'
		},
		{
			explanation:
				'The vitest-v8-coverage 4.1.10 adapter validates and imports bounded V8 coverage JSON, reconciles exact included, uncovered, and missing source populations, validates supported source maps, and retains dated provider, subject, coverage, freshness, health, and raw-artifact evidence. Inventory generation does not run Vitest or ingest a current coverage output, so assuranceSurfaces.coverage.outputIdentity and current coverage health remain UNKNOWN or NOT_RUN. Analysis authority and gate effect are NONE.',
			id: 'test-coverage-ingestion',
			provider: 'vitest-v8-coverage',
			provenance: canonicalProvenance(...VITEST_V8_COVERAGE_INGESTION_PROVENANCE),
			state: 'PARTIAL'
		},
		{
			explanation:
				'The implementation-local JPWB native security observer applies exactly three bounded public-TypeScript-AST rules: unbound HUMAN principal construction, shell-enabled process execution, and secret-bearing diagnostic arguments. It reports explicit coverage, freshness, health, limitations, and source evidence with analysis authority and gate effect NONE. It is not a general security-query language, taint engine, whole-program security proof, or absence proof, and inventory generation does not execute it.',
			id: 'security-query',
			provider: 'jan-csaa-native-jpwb-security',
			provenance: canonicalProvenance(...JPWB_NATIVE_SECURITY_PROVENANCE),
			state: 'PARTIAL'
		},
		{
			explanation:
				'The eslint 9.39.5 JSON adapter validates and imports bounded file and message observations with provider, subject, raw-artifact, coverage, freshness, health, and conflict evidence. Adapter availability does not establish a current lint run, rule correctness, repository conformance, or gate authority; inventory generation imports no ESLint output.',
			id: 'eslint-result-ingestion',
			provider: 'eslint',
			provenance: canonicalProvenance(...ESLINT_RESULT_INGESTION_PROVENANCE),
			state: 'PARTIAL'
		},
		{
			explanation:
				'The Vitest 4.1.10 JSON adapter validates and imports bounded file and assertion observations with provider, subject, raw-artifact, coverage, freshness, health, and conflict evidence. Adapter availability does not establish a current test run, behavioral correctness, repository conformance, or gate authority; inventory generation imports no Vitest output.',
			id: 'vitest-result-ingestion',
			provider: 'vitest',
			provenance: canonicalProvenance(...VITEST_RESULT_INGESTION_PROVENANCE),
			state: 'PARTIAL'
		},
		{
			explanation:
				'The implementation-local unregistered 0.1.0 four-valued query operation validates a bounded closed request, reuses the exact T/F/U/C algebra and semantic-source evaluator, and returns bounded explanation accounting. It confers analysis authority, authority transfer, and gate effect NONE and does not complete full CAP-029, DWP-005, DWP-006, G5, finding, remediation, disposition, or registered-operation requirements.',
			id: 'four-valued-query-operation',
			provider: 'implementation-local-four-valued-query-operation',
			provenance: canonicalProvenance(...FOUR_VALUED_QUERY_OPERATION_PROVENANCE),
			state: 'PARTIAL'
		},
		{
			explanation:
				'The JAN-CSAA-CAP-030 PARTIAL module code-slice operation implements validated-module-dependency-bounded-may-slice/1.0.0 over one validated module graph and explicit criteria with complete bounded witnesses and frontiers. It does not implement call-graph or data-flow slicing, prove irrelevance or safe removal, complete DWP-005/DWP-006, or confer finding, remediation, disposition, or gate authority.',
			id: 'module-code-slice',
			provider: 'typescript+validated-module-dependency-graph',
			provenance: canonicalProvenance(...MODULE_CODE_SLICE_PROVENANCE),
			state: 'PARTIAL'
		},
		{
			explanation:
				'The JAN-CSAA-CAP-032 PARTIAL semantic snapshot comparison implements exact-source-path-plus-unique-content-lineage/1.0.0 for bounded semantic source-record populations. It does not establish exhaustive cross-revision lineage, symbol, declaration, or graph deltas, behavior preservation, non-impact, safe removal, gate decisions, remediation, or disposition authority.',
			id: 'semantic-snapshot-comparison',
			provider: 'typescript+implementation-local-semantic-snapshot-comparison',
			provenance: canonicalProvenance(...SEMANTIC_SNAPSHOT_COMPARISON_PROVENANCE),
			state: 'PARTIAL'
		},
		{
			explanation:
				'The implementation-local unregistered harmonization first-increment evaluator supplies bounded profiles and deterministic evaluation for the frozen 23-rule exemplar set over admitted caller observations. It has analysis authority, authority transfer, and gate effect NONE and does not by itself extract repository facts, reproduce current defects, qualify a provider, activate G5, or complete DWP-005/DWP-006.',
			id: 'harmonization-first-increment-rule-evaluation',
			provider: 'implementation-local-harmonization-rule-evaluator',
			provenance: canonicalProvenance(...HARMONIZATION_RULE_EVALUATION_PROVENANCE),
			state: 'PARTIAL'
		},
		{
			explanation:
				'The implementation-local unregistered benchmark-accounting operation accounts for all 75 frozen harmonization rows and the DETECTED, NOT_DETECTED, UNSUPPORTED, NOT_APPLICABLE, and NOT_RUN status population. It is accounting rather than detector execution or benchmark passage and confers analysis authority, authority transfer, and gate effect NONE.',
			id: 'harmonization-benchmark-accounting',
			provider: 'implementation-local-harmonization-benchmark-accounting',
			provenance: canonicalProvenance(...HARMONIZATION_BENCHMARK_ACCOUNTING_PROVENANCE),
			state: 'PARTIAL'
		},
		{
			explanation:
				'The implementation-local unregistered JPWB native projection performs bounded public-TypeScript-AST plus schema and registry projection for the frozen 23-rule first increment and feeds those observations to the existing evaluator. The projector operates over exact FrozenSubject bytes and accepts caller-supplied currentness; a separate current-JPWB production-composition smoke independently resolves and verifies the bounded subject before capture, before and after projection, and after verification, observes all 23 rows as five DETECTED, zero NOT_DETECTED, and 18 UNSUPPORTED, and preserves exact subject bytes. Analysis authority, authority transfer, and gate effect are NONE. It is not general-purpose taint, whole-program dynamic reachability, security absence, benchmark passage, all-75 accounting, or human normative adjudication.',
			id: 'jpwb-harmonization-native-projection',
			provider: 'typescript-public-ast-plus-bounded-schema-and-registry-projection',
			provenance: canonicalProvenance(...JPWB_HARMONIZATION_NATIVE_PROJECTION_PROVENANCE),
			state: 'PARTIAL'
		},
		{
			explanation:
				'The implementation-local unregistered coding-agent CLI admits and routes the seven versioned inventory, snapshot, query, impact, findings, explain, and verify commands through explicit handlers, bounded JSON output, typed exit codes, content-addressed artifact persistence, and a process host. A focused production-host golden executes persistent artifact put/get and all seven operations through independent Bun processes, covers exits 0, 2, 3, 4, and 5 plus stale, budget, cancellation, and unsupported refusals, and verifies byte-for-byte subject immutability. A separate current-JPWB production-composition smoke executes all seven operations over one sound bounded exact subject, including a semantic query, static impact candidates, 23-row RUN native findings, five source-bound hybrid prerequisite rows, explicit fail-closed handling of an unusable runtime-control artifact, exact native-and-hybrid explanation replay, conjunctive workflow verification, independent currentness, and exact source-byte preservation. The serialized csaa:completion:check command additionally verifies controlled evidence and the full repository gate; its mutation phase captures the exact staged index, refuses unstaged tracked bytes or later index drift, restores every mutation to the staged candidate, and confers analysis authority and gate effect NONE. These bounded workflows do not establish provider execution for every repository or input lane, external G10 corpus acceptance, network use, subject-code execution, source mutation, or gate activation.',
			id: 'coding-agent-cli-process',
			provider: 'jan-csaa-coding-agent-cli',
			provenance: canonicalProvenance(...CODING_AGENT_CLI_PROCESS_PROVENANCE),
			state: 'PARTIAL'
		},
		{
			explanation:
				'The rebuildable content-addressed file store implements versioned immutable generations, exact invalidation dependencies, reader pins, bounded publication, recovery, corruption quarantine, concurrency controls, retention, and a coding-agent artifact-store adapter with focused clean/incremental equivalence, crash, cancellation, corruption, concurrency, and retention tests. A checked empirical evidence artifact records five real cold/warm pairs with exact artifact and generation identity, dependency invalidation, computed/reused accounting, and a current benchmark-source digest. The checked DWP-007 selection assessment chooses CONTENT_ADDRESSED_FILES because that already implemented eligible store satisfies the bounded technical acceptance criteria; better-sqlite3 produced Node transaction, migration-rollback, and WAL-reader evidence but no completion record under the active Bun host, while Bun built-in SQLite is a different unimplemented adapter. Startup has no product threshold or SLO, the selection makes no provider-qualification claim, and cache contents remain non-authoritative and rebuildable.',
			id: 'content-addressed-persistence',
			provider: 'jan-csaa-content-addressed-file-store',
			provenance: canonicalProvenance(...CONTENT_ADDRESSED_PERSISTENCE_PROVENANCE),
			state: 'PARTIAL'
		},
		{
			explanation:
				'The DWP-009 local advanced-CPG provider entry assessor and checked evidence record a DEFER disposition for the observed Windows environment: CodeQL and Joern were unavailable on the recorded PATH, qualification was not performed, need remained UNKNOWN, native CSAA remained INDEPENDENT, and analysis authority and gate effect are NONE. The evidence authorizes no install, network, upload, license, system change, provider availability claim outside that environment, or code-property-graph capability.',
			id: 'advanced-cpg-provider-disposition',
			provider: null,
			provenance: canonicalProvenance(...ADVANCED_CPG_PROVIDER_DISPOSITION_PROVENANCE),
			state: 'PARTIAL'
		},
		{
			explanation:
				'The implementation-local current dependency-cruiser runner retains two distinct profiles. The broad asymmetric profile captures one exact packages/rph-contracts/tsconfig.build.json compiler slice, separately observes dependency-cruiser over whole apps/packages, and compares only the truthful overlap; provider rows outside the compiler slice remain incomparable. After an exact digest is reviewed and source-bound, the broad profile can emit PARTIAL evidence with REVIEWED_DIFFERENTIAL_EVIDENCE_ONLY authority and gate effect NONE. The aligned G4 profile fixes dependency-cruiser to the exact ten authored build-root files, requires equality among compiler roots, deep authored compiler sources, provider inputs, and provider modules, reconciles every represented compiler/provider relation with zero observed differences, and can retain CLOSED_FOR_EXACT_BUILD_ROOT_AND_REPRESENTED_RELATION_POPULATIONS only after its exact digest is reviewed and source-bound. Both profiles recheck subject and provider identity under explicit budgets and retain analysis authority and gate effect NONE. Compiler/provider resolution-context equivalence, optional dependency-cruiser metadata interpretation, negative-coverage closure beyond the represented exact-slice populations, multi-project or repository-wide closure, provider qualification, architecture compliance, repository-wide G4 passage, and gate activation remain explicit nonclaims. Root and package-local discovery/check/write commands, the package-root export, focused tests, and operational README exist; neither evidence check is a repository gate. ' +
				(currentDependencyCruiserDifferentialEvidenceSelected
					? `The selected subject includes ${CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_EVIDENCE_PATH}; inventory generation records that path as provenance but does not execute the runner, independently validate the evidence, or claim repository-wide equivalence, negative-coverage closure, G4 passage, provider qualification, or repository-gate authority.`
					: `No selected ${CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_EVIDENCE_PATH} is present; inventory generation does not execute the separately configured broad runner or claim repository-wide equivalence, negative-coverage closure, provider qualification, or repository-gate authority.`) +
				(currentDependencyCruiserG4ClosureEvidenceSelected
					? ` The selected subject includes ${CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_EVIDENCE_PATH}; inventory generation records that path as provenance but does not independently validate it or promote its bounded slice closure to repository-wide G4 passage.`
					: ` No selected ${CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_EVIDENCE_PATH} is present; inventory generation makes no bounded same-perimeter closure claim.`),
			id: 'current-dependency-cruiser-differential',
			provider: 'typescript+dependency-cruiser',
			provenance: canonicalProvenance(
				...CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_PROVENANCE,
				...(currentDependencyCruiserDifferentialEvidenceSelected
					? [CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_EVIDENCE_PATH]
					: []),
				...(currentDependencyCruiserG4ClosureEvidenceSelected
					? [CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_EVIDENCE_PATH]
					: [])
			),
			state: 'PARTIAL'
		},
		...unimplemented.map((id): CapabilityInventory => ({
			explanation:
				'Universal code-property-graph, control-flow, and data-flow support is not implemented by the current bounded increments and is not inferred from semantic snapshots, partial graph projections, bounded provider imports, native rules, or installed tools.',
			id,
			provider: null,
			provenance: ['packages/csaa/src/contracts/inventory.ts'],
			state: 'UNIMPLEMENTED'
		})),
		{
			explanation:
				'The current DWP-003 provider constructs frozen TypeScript Programs and implements TS_PROJECT and TS_SYNTAX semantic snapshot capabilities. Its operation-wide duration budget is enforced from a wall-anchored monotonic elapsed-time clock, preventing later wall-clock correction from making in-flight elapsed time regress. This is an execution-control property, not a benchmark, product ceiling, expected duration, or SLO.',
			id: 'typescript-ast',
			provider: 'typescript',
			provenance: TYPESCRIPT_AST_PROVENANCE,
			state: 'IMPLEMENTED'
		},
		{
			explanation:
				'The current DWP-003 provider implements Program-scoped TS_SYMBOL declarations, symbols, aliases, references, module resolutions, and module exports with normalized provenance and validation. Cross-Program symbol identity and binding reconciliation is not implemented for multi-project snapshots.',
			id: 'symbol-table',
			provider: 'typescript',
			provenance: TYPESCRIPT_SYMBOL_PROVENANCE,
			state: 'PARTIAL'
		},
		{
			explanation:
				'The current DWP-003 provider implements Program-local TS_TYPE records for types, type parameters, call and construct signatures, signature parameters, overload sets, declared type relations, and request-scoped checker assignability. Cross-Program type reconciliation, exhaustive all-pairs assignability, and DWP-004 composed graph projection are not implemented.',
			id: 'type-graph',
			provider: 'typescript',
			provenance: [...TYPESCRIPT_TYPE_PROVENANCE, ...TYPESCRIPT_SYMBOL_PROVENANCE],
			state: 'PARTIAL'
		}
	];
}

function artifactPopulations(
	files: readonly SelectedFileRecord[],
	subject: FrozenSubject
): ArtifactPopulation[] {
	const classes: ArtifactClass[] = [
		'CONFIGURATION',
		'GENERATED_SOURCE',
		'OTHER',
		'SCRIPT',
		'SOURCE',
		'TEST',
		'VERIFICATION'
	];
	return classes.map((artifactClass) => {
		const count = files.filter((file) => file.artifactClass === artifactClass).length;
		const excludedRecords = subject.excludedArtifacts.filter(
			(artifact) => inventoryArtifactClass(artifact.primaryClass) === artifactClass
		);
		const excluded = excludedRecords.some((artifact) => artifact.physicalFileCount === 'UNKNOWN')
			? ('UNKNOWN' as const)
			: excludedRecords.reduce(
					(total, artifact) => total + (artifact.physicalFileCount as number),
					0
				);
		return {
			artifactClass,
			discovered: excluded === 'UNKNOWN' ? ('UNKNOWN' as const) : count + excluded,
			excluded,
			failed: 0,
			included: count,
			provenance: [
				`subject.selectedFiles#artifactClass=${artifactClass}`,
				'subject.excludedArtifacts[*].physicalFileCount'
			],
			successfullyInventoried: count
		};
	});
}

function projectExclusionRecords(subject: FrozenSubject): ExclusionRecord[] {
	const byPolicy = new Map<string, FrozenSubject['excludedArtifacts'][number][]>();
	for (const artifact of subject.excludedArtifacts) {
		const records = byPolicy.get(artifact.policyId) ?? [];
		records.push(artifact);
		byPolicy.set(artifact.policyId, records);
	}
	return [...byPolicy]
		.map(([id, records]) => {
			const physicalPopulationKnown = records.every(
				(record) => record.physicalFileCount !== 'UNKNOWN'
			);
			return {
				countState: physicalPopulationKnown
					? ('PHYSICAL_POPULATION_ENUMERATED' as const)
					: ('PHYSICAL_POPULATION_NOT_ENUMERATED' as const),
				excludedPhysicalFileCount: physicalPopulationKnown
					? records.reduce((total, record) => total + (record.physicalFileCount as number), 0)
					: null,
				id,
				includedFileCount: 0 as const,
				physicalPopulationState: physicalPopulationKnown
					? ('EXCLUDED_AFTER_ENUMERATION' as const)
					: ('EXCLUDED_BEFORE_ENUMERATION' as const),
				policyRuleCount: new Set(records.map((record) => record.reason)).size,
				rules: [...new Set(records.map((record) => record.reason))].sort(compareText)
			};
		})
		.sort((left, right) => compareText(left.id, right.id));
}

function assertJpwbCorePopulations(
	rootManifest: JsonObject,
	workspaces: readonly WorkspaceInventory[],
	files: readonly SelectedFileRecord[],
	assets: readonly VerificationAssetInventory[]
): void {
	if (rootManifest.name !== 'janumi-professional-workbench') {
		throw new Error('JPWB inventory root manifest identity is absent or incompatible');
	}
	if (workspaces.length === 0) throw new Error('JPWB workspace population is empty');
	if (!assets.some((asset) => /^verif\/[^/]+\.ts$/.test(asset.path))) {
		throw new Error('JPWB top-level verif TypeScript population is empty');
	}
	if (!files.some((file) => file.path.startsWith('scripts/') && file.path.endsWith('.ts'))) {
		throw new Error('JPWB scripts TypeScript population is empty');
	}
}

function assertJpwbRequiredRootCommands(configuredCommands: readonly CommandInventory[]): void {
	const rootNames = new Set(
		configuredCommands.filter((entry) => entry.owner === '.').map((entry) => entry.name)
	);
	for (const required of [
		'boundary',
		'check-types',
		'gate',
		'gate:fast',
		'lint',
		'test',
		'test:coverage',
		'csaa:semantic:smoke:conditional-export-resolution',
		'csaa:semantic:smoke:declaration-context-analysis',
		'csaa:semantic:smoke:source-origin-correlation',
		'csaa:semantic:smoke:module-resolution-trace',
		'csaa:semantic:smoke:command-event-contract',
		'csaa:semantic:smoke:guard-classification',
		'csaa:semantic:smoke:logical-graph-composition',
		'csaa:analyze:arrow-command-census',
		'csaa:analyze:command-handler-graph',
		'csaa:analyze:command-dispatch-topology',
		'csaa:analyze:command-event-contract-overlay',
		'csaa:analyze:guard-enforcement-ledger',
		'csaa:analyze:guard-classification-overlay',
		'csaa:analyze:call-graph',
		'csaa:analyze:declaration-context',
		'csaa:analyze:module-dependency',
		'csaa:analyze:semantic-source-query',
		'csaa:analyze:logical-graph-composition',
		'csaa:analyze:module-resolution-trace',
		'csaa:analyze:project-context',
		'csaa:analyze:read-write-access',
		'csaa:analyze:static-module-impact-candidates',
		'csaa:analyze:structural-module-reachability',
		'csaa:analyze:working-source-edit-impact-candidates',
		'csaa:semantic:smoke:project-context-graph',
		'csaa:semantic:smoke:structural-module-reachability',
		'csaa:semantic:smoke:structural-scc'
	]) {
		if (!rootNames.has(required))
			throw new Error(`Required JPWB assurance command is absent: ${required}`);
	}
}

function assertJpwbAssuranceCommandExact(
	configuredCommands: readonly CommandInventory[],
	name: string,
	expected: string
): void {
	const configured = configuredCommands.find((entry) => entry.owner === '.' && entry.name === name);
	if (configured?.command !== expected) {
		throw new Error(`Required JPWB assurance command is incompatible: ${name}`);
	}
}

function assertRequiredSelectedPaths(
	selectedPaths: ReadonlySet<string>,
	required: readonly string[],
	description: string
): void {
	for (const path of required) {
		if (!selectedPaths.has(path)) throw new Error(`${description} is absent: ${path}`);
	}
}

function assertJpwbTestPopulations(subject: FrozenSubject): void {
	const expectedProfiles = [
		['PLAYWRIGHT', 'DETERMINISTIC'],
		['PLAYWRIGHT', 'LIVE'],
		['VITEST', 'DIST'],
		['VITEST', 'SOURCE']
	] as const;
	if (subject.testPopulations.length !== expectedProfiles.length)
		throw new Error('Required JPWB configured test-population profile set is incompatible.');
	for (const [provider, profile] of expectedProfiles) {
		const matches = subject.testPopulations.filter(
			(population) => population.provider === provider && population.profile === profile
		);
		if (
			matches.length !== 1 ||
			matches[0]!.status !== 'COMPLETE' ||
			!matches[0]!.reconciles ||
			matches[0]!.included === 0
		)
			throw new Error(`Required JPWB ${provider} ${profile} test population is not closed.`);
	}
	const population = (provider: 'PLAYWRIGHT' | 'VITEST', profile: string) =>
		subject.testPopulations.find(
			(candidate) => candidate.provider === provider && candidate.profile === profile
		)!.includedPaths;
	const source = population('VITEST', 'SOURCE');
	const dist = population('VITEST', 'DIST');
	if (canonicalJson(source) !== canonicalJson(dist))
		throw new Error('Required JPWB Vitest SOURCE and DIST populations differ.');
	const artifactPaths = subject.artifacts.map((artifact) => artifact.path);
	const expectedUnit = artifactPaths.filter((path) =>
		/^(?:verif\/.*|packages\/[^/]+\/src\/.*|apps\/[^/]+\/src\/.*)\.test\.ts$/u.test(path)
	);
	const expectedDeterministic = artifactPaths.filter((path) =>
		/^apps\/rph-demo\/e2e\/.*\.e2e\.ts$/u.test(path)
	);
	const expectedLive = artifactPaths.filter((path) =>
		/^apps\/rph-demo\/e2e-live\/.*\.live\.ts$/u.test(path)
	);
	for (const [actual, expected, name] of [
		[source, expectedUnit, 'Vitest'],
		[population('PLAYWRIGHT', 'DETERMINISTIC'), expectedDeterministic, 'Playwright deterministic'],
		[population('PLAYWRIGHT', 'LIVE'), expectedLive, 'Playwright live']
	] as const)
		if (canonicalJson(actual) !== canonicalJson(expected))
			throw new Error(`Required JPWB ${name} test population differs from its independent census.`);
}

function assertJpwbGeneratedContext(
	subject: FrozenSubject,
	configuredCommands: readonly CommandInventory[]
): void {
	const contexts = subject.generatedContexts.filter(
		(context) => context.path === RPH_DEMO_GENERATED_CONTEXT_PATH
	);
	if (
		contexts.length !== 2 ||
		contexts.some(
			(context) =>
				context.freshness !== 'CURRENT' ||
				context.generator?.id !== SVELTE_KIT_SYNC_GENERATOR_ID ||
				context.outputPaths.length < 2 ||
				!context.outputPaths.includes(RPH_DEMO_GENERATED_CONTEXT_PATH)
		)
	)
		throw new Error('Required JPWB SvelteKit generated context is not current and closed.');
	if (
		!subject.artifacts.some(
			(artifact) => artifact.path === RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH
		)
	)
		throw new Error('Required JPWB SvelteKit generated-context evidence is absent.');
	assertJpwbAssuranceCommandExact(
		configuredCommands,
		'csaa:generated-context',
		'bun run scripts/csaa-generated-context.ts --write'
	);
	assertJpwbAssuranceCommandExact(
		configuredCommands,
		'csaa:generated-context:check',
		'bun run scripts/csaa-generated-context.ts --check'
	);
	const gateFast = configuredCommands.find(
		(command) => command.owner === '.' && command.name === 'gate:fast'
	)?.command;
	if (
		gateFast === undefined ||
		!gateFast.startsWith('bun run csaa:generated-context:check && bun run csaa:inventory:check && ')
	)
		throw new Error('Required JPWB generated-context and inventory gate order is incompatible.');
}

function assertJpwbNonVacuity(
	subject: FrozenSubject,
	rootManifest: JsonObject,
	workspaces: readonly WorkspaceInventory[],
	files: readonly SelectedFileRecord[],
	assets: readonly VerificationAssetInventory[],
	configuredCommands: readonly CommandInventory[]
): void {
	assertJpwbCorePopulations(rootManifest, workspaces, files, assets);
	assertJpwbRequiredRootCommands(configuredCommands);
	assertJpwbAssuranceCommandExact(
		configuredCommands,
		'csaa:analyze:static-module-impact-candidates',
		JPWB_STATIC_MODULE_IMPACT_CANDIDATE_REPORT_COMMAND
	);
	assertJpwbAssuranceCommandExact(
		configuredCommands,
		'csaa:analyze:working-source-edit-impact-candidates',
		JPWB_WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_COMMAND
	);
	assertJpwbAssuranceCommandExact(
		configuredCommands,
		'csaa:semantic:smoke:conditional-export-resolution',
		JPWB_CONDITIONAL_EXPORT_RESOLUTION_ONLY_SMOKE_COMMAND
	);
	assertJpwbAssuranceCommandExact(
		configuredCommands,
		'csaa:semantic:smoke:declaration-context-analysis',
		JPWB_DECLARATION_CONTEXT_ANALYSIS_ONLY_SMOKE_COMMAND
	);
	assertJpwbAssuranceCommandExact(
		configuredCommands,
		'csaa:analyze:declaration-context',
		JPWB_DECLARATION_CONTEXT_REPORT_COMMAND
	);
	assertJpwbAssuranceCommandExact(
		configuredCommands,
		'csaa:semantic:smoke:source-origin-correlation',
		JPWB_SOURCE_ORIGIN_CORRELATION_ONLY_SMOKE_COMMAND
	);
	assertJpwbAssuranceCommandExact(
		configuredCommands,
		'csaa:semantic:smoke:module-resolution-trace',
		JPWB_MODULE_RESOLUTION_TRACE_ONLY_SMOKE_COMMAND
	);
	assertJpwbAssuranceCommandExact(
		configuredCommands,
		'csaa:analyze:arrow-command-census',
		JPWB_ARROW_COMMAND_CENSUS_REPORT_COMMAND
	);
	assertJpwbAssuranceCommandExact(
		configuredCommands,
		'csaa:analyze:command-handler-graph',
		JPWB_COMMAND_HANDLER_GRAPH_REPORT_COMMAND
	);
	assertJpwbAssuranceCommandExact(
		configuredCommands,
		'csaa:analyze:command-dispatch-topology',
		JPWB_COMMAND_DISPATCH_TOPOLOGY_REPORT_COMMAND
	);
	assertJpwbAssuranceCommandExact(
		configuredCommands,
		'csaa:analyze:command-event-contract-overlay',
		JPWB_COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_COMMAND
	);
	assertJpwbAssuranceCommandExact(
		configuredCommands,
		'csaa:analyze:guard-enforcement-ledger',
		JPWB_GUARD_ENFORCEMENT_LEDGER_REPORT_COMMAND
	);
	assertJpwbAssuranceCommandExact(
		configuredCommands,
		'csaa:analyze:guard-classification-overlay',
		JPWB_GUARD_CLASSIFICATION_OVERLAY_REPORT_COMMAND
	);
	assertJpwbAssuranceCommandExact(
		configuredCommands,
		'csaa:analyze:call-graph',
		JPWB_CALL_GRAPH_REPORT_COMMAND
	);
	assertJpwbAssuranceCommandExact(
		configuredCommands,
		'csaa:analyze:module-dependency',
		JPWB_MODULE_DEPENDENCY_REPORT_COMMAND
	);
	assertJpwbAssuranceCommandExact(
		configuredCommands,
		'csaa:analyze:semantic-source-query',
		JPWB_SEMANTIC_SOURCE_QUERY_REPORT_COMMAND
	);
	assertJpwbAssuranceCommandExact(
		configuredCommands,
		'csaa:analyze:logical-graph-composition',
		JPWB_LOGICAL_GRAPH_COMPOSITION_REPORT_COMMAND
	);
	assertJpwbAssuranceCommandExact(
		configuredCommands,
		'csaa:analyze:module-resolution-trace',
		JPWB_MODULE_RESOLUTION_TRACE_REPORT_COMMAND
	);
	assertJpwbAssuranceCommandExact(
		configuredCommands,
		'csaa:semantic:smoke:logical-graph-composition',
		JPWB_LOGICAL_GRAPH_COMPOSITION_ONLY_SMOKE_COMMAND
	);
	assertJpwbAssuranceCommandExact(
		configuredCommands,
		'csaa:semantic:smoke:project-context-graph',
		JPWB_PROJECT_CONTEXT_GRAPH_ONLY_SMOKE_COMMAND
	);
	assertJpwbAssuranceCommandExact(
		configuredCommands,
		'csaa:analyze:project-context',
		JPWB_PROJECT_CONTEXT_REPORT_COMMAND
	);
	assertJpwbAssuranceCommandExact(
		configuredCommands,
		'csaa:analyze:read-write-access',
		JPWB_READ_WRITE_ACCESS_REPORT_COMMAND
	);
	assertJpwbAssuranceCommandExact(
		configuredCommands,
		'csaa:semantic:smoke:structural-scc',
		JPWB_STRUCTURAL_SCC_ONLY_SMOKE_COMMAND
	);
	assertJpwbAssuranceCommandExact(
		configuredCommands,
		'csaa:semantic:smoke:structural-module-reachability',
		JPWB_STRUCTURAL_MODULE_REACHABILITY_ONLY_SMOKE_COMMAND
	);
	assertJpwbAssuranceCommandExact(
		configuredCommands,
		'csaa:analyze:structural-module-reachability',
		JPWB_STRUCTURAL_MODULE_REACHABILITY_REPORT_COMMAND
	);
	const selectedPaths = new Set(files.map((file) => file.path));
	assertRequiredSelectedPaths(
		selectedPaths,
		WORKING_CHANGE_SET_PROVENANCE,
		'Required JPWB Git-bound Working Change Set implementation or verification source'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		TYPESCRIPT_SEMANTIC_PROVENANCE,
		'Required JPWB TypeScript semantic implementation source'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		TYPESCRIPT_CALL_GRAPH_REPORT_PROVENANCE,
		'Required JPWB TypeScript call-graph report facade or verification source'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		TYPESCRIPT_MODULE_DEPENDENCY_REPORT_PROVENANCE,
		'Required JPWB TypeScript module-dependency report facade or verification source'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		TYPESCRIPT_SEMANTIC_SOURCE_QUERY_PROVENANCE,
		'Required JPWB TypeScript semantic-source query facade or verification source'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		TYPESCRIPT_READ_WRITE_ACCESS_GRAPH_PROVENANCE,
		'Required JPWB TypeScript read/write access graph implementation source'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		TYPESCRIPT_READ_WRITE_ACCESS_REPORT_PROVENANCE,
		'Required JPWB TypeScript read/write access report facade or verification source'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		JPWB_COMMAND_HANDLER_GRAPH_PROVENANCE,
		'Required JPWB command-handler static projection implementation source'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		JPWB_COMMAND_HANDLER_GRAPH_REPORT_PROVENANCE,
		'Required JPWB command-handler graph report facade or verification source'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		[
			...JPWB_COMMAND_DISPATCH_TOPOLOGY_PROVENANCE,
			...JPWB_COMMAND_DISPATCH_RETAINED_CENSUS_REFERENCE
		],
		'Required JPWB command-dispatch static topology implementation or retained reference'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		JPWB_COMMAND_DISPATCH_TOPOLOGY_REPORT_PROVENANCE,
		'Required JPWB command-dispatch topology report facade or verification source'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		[...JPWB_ARROW_COMMAND_CENSUS_PROVENANCE, ...JPWB_ARROW_COMMAND_CENSUS_RETAINED_PROVENANCE],
		'Required JPWB arrow-command census implementation or retained-authority artifact'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		JPWB_ARROW_COMMAND_CENSUS_REPORT_PROVENANCE,
		'Required JPWB arrow-command census report facade or verification source'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		[
			...JPWB_GUARD_ENFORCEMENT_LEDGER_PROVENANCE,
			...JPWB_GUARD_ENFORCEMENT_LEDGER_RETAINED_PROVENANCE
		],
		'Required JPWB guard-enforcement-ledger implementation or retained-authority artifact'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		JPWB_GUARD_ENFORCEMENT_LEDGER_REPORT_PROVENANCE,
		'Required JPWB guard-enforcement-ledger report facade or verification source'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		JPWB_GUARD_CLASSIFICATION_OVERLAY_PROVENANCE,
		'Required JPWB guard-classification static overlay implementation source'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		JPWB_GUARD_CLASSIFICATION_OVERLAY_REPORT_PROVENANCE,
		'Required JPWB guard-classification overlay report facade or verification source'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		[
			...JPWB_COMMAND_EVENT_CONTRACT_OVERLAY_PROVENANCE,
			...JPWB_COMMAND_EVENT_CONTRACT_OVERLAY_INPUT_PROVENANCE
		],
		'Required JPWB command-event-contract static overlay implementation or exact input'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		JPWB_COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROVENANCE,
		'Required JPWB command-event-contract overlay report facade or verification source'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		JPWB_STATE_MACHINE_GRAPH_PROVENANCE,
		'Required JPWB state-machine graph implementation source'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		JPWB_STATE_MACHINE_GRAPH_REPORT_PROVENANCE,
		'Required JPWB state-machine graph report facade or verification source'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		TYPESCRIPT_STRUCTURAL_SCC_ANALYSIS_PROVENANCE,
		'Required JPWB structural SCC analysis implementation source'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		TYPESCRIPT_STRUCTURAL_SCC_REPORT_PROVENANCE,
		'Required JPWB structural SCC report facade or verification source'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		TYPESCRIPT_STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_PROVENANCE,
		'Required JPWB structural module reachability analysis implementation source'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		TYPESCRIPT_STRUCTURAL_MODULE_REACHABILITY_REPORT_PROVENANCE,
		'Required JPWB structural module reachability report facade or verification source'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		TYPESCRIPT_STATIC_MODULE_IMPACT_CANDIDATE_REPORT_PROVENANCE,
		'Required JPWB static module impact-candidate report facade or verification source'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		TYPESCRIPT_WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_PROVENANCE,
		'Required JPWB working-source-edit impact-candidate report facade or verification source'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		TYPESCRIPT_LOGICAL_GRAPH_COMPOSITION_PROVENANCE,
		'Required JPWB logical graph composition implementation or verification source'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		TYPESCRIPT_LOGICAL_GRAPH_COMPOSITION_REPORT_PROVENANCE,
		'Required JPWB logical graph composition report facade or verification source'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		TYPESCRIPT_PROJECT_CONTEXT_GRAPH_PROVENANCE,
		'Required JPWB project context graph implementation or verification source'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		TYPESCRIPT_PROJECT_CONTEXT_REPORT_PROVENANCE,
		'Required JPWB project context report facade or verification source'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		TYPESCRIPT_CONDITIONAL_EXPORT_RESOLUTION_PROVENANCE,
		'Required JPWB conditional export resolution implementation or verification source'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		TYPESCRIPT_MODULE_RESOLUTION_TRACE_PROVENANCE,
		'Required JPWB module resolution trace implementation or verification source'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		TYPESCRIPT_MODULE_RESOLUTION_TRACE_REPORT_PROVENANCE,
		'Required JPWB module resolution trace report facade or verification source'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		TYPESCRIPT_DECLARATION_CONTEXT_ANALYSIS_PROVENANCE,
		'Required JPWB declaration context analysis implementation or verification source'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		TYPESCRIPT_DECLARATION_CONTEXT_REPORT_PROVENANCE,
		'Required JPWB declaration context report facade or verification source'
	);
	assertRequiredSelectedPaths(
		selectedPaths,
		TYPESCRIPT_SOURCE_ORIGIN_CORRELATION_PROVENANCE,
		'Required JPWB source origin correlation implementation or verification source'
	);
	assertJpwbTestPopulations(subject);
	assertJpwbGeneratedContext(subject, configuredCommands);
}

export function collectInventory(options: CollectInventoryOptions): InventoryDocument {
	const resolvedSubject = projectSubjectForInventory(options.repositoryRoot);
	const rootManifest = readJsonObject(
		resolvedSubject,
		'package.json',
		'root manifest package.json'
	);
	const workspaces = projectWorkspaces(resolvedSubject);
	const perimeter = resolvedSubject.descriptor.perimeter;
	const selectedFiles = projectSelectedFiles(resolvedSubject);
	if (selectedFiles.length === 0) throw new Error('Selected file manifest is empty');
	const configuredCommands = commands(rootManifest, workspaces);
	const assets = verificationAssets(resolvedSubject, selectedFiles, configuredCommands);
	if (options.requireJpwbPopulations) {
		assertJpwbNonVacuity(
			resolvedSubject,
			rootManifest,
			workspaces,
			selectedFiles,
			assets,
			configuredCommands
		);
	}
	const inventory: InventoryDocument = {
		artifactPopulations: artifactPopulations(selectedFiles, resolvedSubject),
		assuranceSurfaces: assuranceSurfaces(resolvedSubject, selectedFiles, configuredCommands),
		capabilities: capabilities(selectedFiles),
		commands: configuredCommands,
		dependencyBoundary: dependencyBoundary(resolvedSubject, selectedFiles, rootManifest),
		generator: { id: INVENTORY_GENERATOR_ID, version: INVENTORY_GENERATOR_VERSION },
		providers: providerInventory(resolvedSubject, selectedFiles, configuredCommands),
		schemaVersion: INVENTORY_SCHEMA_VERSION,
		subject: {
			configurationDigest: resolvedSubject.descriptor.configurationDigest,
			configurationPreimage: subjectConfigurationPreimage(
				resolvedSubject.artifacts,
				resolvedSubject.generatedContexts,
				resolvedSubject.projects,
				resolvedSubject.testPopulations,
				resolvedSubject.workspaces
			),
			dirtyState: 'UNKNOWN',
			exclusionPolicyIds: resolvedSubject.descriptor.exclusionPolicyIds,
			excludedClasses: projectExclusionRecords(resolvedSubject),
			fileManifestDigest: resolvedSubject.descriptor.fileManifestDigest,
			generatedContexts: resolvedSubject.generatedContexts,
			parentRevision: null,
			perimeter,
			repositoryRoot: '.',
			revision: null,
			resolutionCompleteness:
				resolvedSubject.projects.some((project) => project.status === 'PARTIAL') ||
				resolvedSubject.diagnostics.some((item) => item.severity !== 'INFO')
					? 'PARTIAL'
					: 'COMPLETE',
			resolutionDiagnostics: resolvedSubject.diagnostics,
			schemaVersion: resolvedSubject.descriptor.schemaVersion,
			selectedFileCount: selectedFiles.length,
			selectedFiles,
			subjectId: resolvedSubject.descriptor.subjectId,
			subjectKind: 'WORKTREE'
		},
		typescriptProjects: projectTypeScriptProjects(resolvedSubject),
		unknowns: [
			{
				provenance: ['subject.dirtyState'],
				statement:
					'Git revision and dirty-state classification are not used as a generation prerequisite and remain UNKNOWN.'
			},
			{
				provenance: ['commands[*].state'],
				statement: 'Configured commands are inventoried but NOT_RUN by inventory generation.'
			},
			{
				provenance: canonicalProvenance(
					...TYPESCRIPT_SEMANTIC_PROVENANCE,
					...TYPESCRIPT_MODULE_GRAPH_PROVENANCE,
					...TYPESCRIPT_MODULE_DEPENDENCY_REPORT_PROVENANCE,
					...TYPESCRIPT_SEMANTIC_SOURCE_QUERY_PROVENANCE,
					...TYPESCRIPT_CALL_GRAPH_PROVENANCE,
					...TYPESCRIPT_CALL_GRAPH_REPORT_PROVENANCE,
					...TYPESCRIPT_LOGICAL_GRAPH_COMPOSITION_PROVENANCE,
					...TYPESCRIPT_LOGICAL_GRAPH_COMPOSITION_REPORT_PROVENANCE,
					...TYPESCRIPT_PROJECT_CONTEXT_GRAPH_PROVENANCE,
					...TYPESCRIPT_PROJECT_CONTEXT_REPORT_PROVENANCE,
					...TYPESCRIPT_CONDITIONAL_EXPORT_RESOLUTION_PROVENANCE,
					...TYPESCRIPT_MODULE_RESOLUTION_TRACE_PROVENANCE,
					...TYPESCRIPT_MODULE_RESOLUTION_TRACE_REPORT_PROVENANCE,
					...TYPESCRIPT_DECLARATION_CONTEXT_ANALYSIS_PROVENANCE,
					...TYPESCRIPT_DECLARATION_CONTEXT_REPORT_PROVENANCE,
					...TYPESCRIPT_SOURCE_ORIGIN_CORRELATION_PROVENANCE,
					...TYPESCRIPT_READ_WRITE_ACCESS_GRAPH_PROVENANCE,
					...TYPESCRIPT_READ_WRITE_ACCESS_REPORT_PROVENANCE,
					...TYPESCRIPT_STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_PROVENANCE,
					...TYPESCRIPT_STRUCTURAL_MODULE_REACHABILITY_REPORT_PROVENANCE,
					...TYPESCRIPT_STATIC_MODULE_IMPACT_CANDIDATE_REPORT_PROVENANCE,
					...TYPESCRIPT_WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_PROVENANCE,
					...TYPESCRIPT_STRUCTURAL_SCC_ANALYSIS_PROVENANCE,
					...TYPESCRIPT_STRUCTURAL_SCC_REPORT_PROVENANCE,
					...JPWB_COMMAND_DISPATCH_TOPOLOGY_PROVENANCE,
					...JPWB_COMMAND_DISPATCH_TOPOLOGY_REPORT_PROVENANCE,
					...JPWB_COMMAND_EVENT_CONTRACT_OVERLAY_PROVENANCE,
					...JPWB_COMMAND_EVENT_CONTRACT_OVERLAY_INPUT_PROVENANCE,
					...JPWB_COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROVENANCE,
					...JPWB_COMMAND_HANDLER_GRAPH_PROVENANCE,
					...JPWB_COMMAND_HANDLER_GRAPH_REPORT_PROVENANCE,
					...JPWB_STATE_MACHINE_GRAPH_PROVENANCE,
					...JPWB_STATE_MACHINE_GRAPH_REPORT_PROVENANCE,
					...JPWB_ARROW_COMMAND_CENSUS_PROVENANCE,
					...JPWB_ARROW_COMMAND_CENSUS_REPORT_PROVENANCE,
					...JPWB_GUARD_ENFORCEMENT_LEDGER_PROVENANCE,
					...JPWB_GUARD_ENFORCEMENT_LEDGER_REPORT_PROVENANCE,
					...JPWB_GUARD_CLASSIFICATION_OVERLAY_PROVENANCE,
					...JPWB_GUARD_CLASSIFICATION_OVERLAY_REPORT_PROVENANCE,
					...DEPENDENCY_CRUISER_CORROBORATION_PROVENANCE,
					...RUNTIME_TRACE_PROVENANCE,
					...HYBRID_RUNTIME_EVALUATION_PROVENANCE,
					...VITEST_V8_COVERAGE_INGESTION_PROVENANCE,
					...JPWB_NATIVE_SECURITY_PROVENANCE,
					...ESLINT_RESULT_INGESTION_PROVENANCE,
					...VITEST_RESULT_INGESTION_PROVENANCE,
					...FOUR_VALUED_QUERY_OPERATION_PROVENANCE,
					...MODULE_CODE_SLICE_PROVENANCE,
					...SEMANTIC_SNAPSHOT_COMPARISON_PROVENANCE,
					...HARMONIZATION_RULE_EVALUATION_PROVENANCE,
					...HARMONIZATION_BENCHMARK_ACCOUNTING_PROVENANCE,
					...JPWB_HARMONIZATION_NATIVE_PROJECTION_PROVENANCE,
					...CODING_AGENT_CLI_PROCESS_PROVENANCE,
					...CONTENT_ADDRESSED_PERSISTENCE_PROVENANCE,
					...ADVANCED_CPG_PROVIDER_DISPOSITION_PROVENANCE,
					...CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_PROVENANCE,
					'capabilities#advanced-cpg-provider-disposition',
					'capabilities#arrow-command-census',
					'capabilities#call-graph',
					'capabilities#coding-agent-cli-process',
					'capabilities#command-dispatch-static-topology',
					'capabilities#command-event-contract-static-overlay',
					'capabilities#command-handler-static-projection',
					'capabilities#content-addressed-persistence',
					'capabilities#current-dependency-cruiser-differential',
					'capabilities#eslint-result-ingestion',
					'capabilities#four-valued-query-operation',
					'capabilities#guard-enforcement-ledger',
					'capabilities#guard-classification-static-overlay',
					'capabilities#dependency-graph',
					'capabilities#harmonization-benchmark-accounting',
					'capabilities#harmonization-first-increment-rule-evaluation',
					'capabilities#hybrid-runtime-evaluation',
					'capabilities#jpwb-harmonization-native-projection',
					'capabilities#logical-graph-composition',
					'capabilities#module-code-slice',
					'capabilities#project-context-graph',
					'capabilities#runtime-traces',
					'capabilities#security-query',
					'capabilities#conditional-export-resolution',
					'capabilities#declaration-context-analysis',
					'capabilities#module-resolution-trace',
					'capabilities#source-origin-correlation',
					'capabilities#read-write-access-graph',
					'capabilities#semantic-source-query',
					'capabilities#semantic-snapshot-comparison',
					'capabilities#state-machine-graph',
					'capabilities#test-coverage-ingestion',
					'capabilities#vitest-result-ingestion',
					'capabilities#working-source-edit-impact-candidates',
					'capabilities#structural-module-reachability-analysis',
					'capabilities#structural-scc-analysis',
					'capabilities#symbol-table',
					'capabilities#typescript-ast',
					'capabilities#type-graph'
				),
				statement:
					`The preliminary semantic-source-query report facade exposes one explicitly selected retained ${SEMANTIC_SOURCE_QUERY_POPULATION} population, fixed safe scalar-field and operator registries, exact T/F/U/C equality, exact nonempty case-sensitive logicalPath prefix comparison with no path normalization/glob/regex/segment inference, unary NOT, and nonempty ordered AND/OR semantics, whole-AST validation, ${SEMANTIC_SOURCE_QUERY_EXECUTION_MODE}-only node-total evaluation, applicability partitions, and all six independent epistemic dimensions. Evaluation closure is limited to retained validated semantic sources, global closure remains OPEN, dynamic evidence is explicitly NOT_APPLICABLE, and zero supported matches do not establish global absence. Its configured command csaa:analyze:semantic-source-query is CONFIGURED_NOT_RUN by inventory generation; the facade remains PARTIAL and IMPLEMENTATION_LOCAL_UNREGISTERED and does not complete CAP-029, DWP-005, DWP-006, G5, a registered JAN-CSAA-007 operation, findings, or disposition. ` +
					`The preliminary static-module-impact-candidates facade binds one caller-declared whole-source EDIT seed and expected artifact SHA-256 to one current captured source, reuses one reverse CAP-027 traversal, and emits only POSSIBLE importer candidates with complete seed-to-candidate witnesses over unchanged native importer-to-imported edges. Global impact closure remains OPEN; the caller working-change identity is not independently validated; unvisited or zero-candidate nodes receive no non-impact state; and ${STATIC_MODULE_IMPACT_CANDIDATE_FULL_CAP_031}, DWP-005/DWP-006 completion, G5/G6, findings, gates, remediation, safe removal, and behavior preservation remain NOT_CLAIMED. Its configured command csaa:analyze:static-module-impact-candidates is CONFIGURED_NOT_RUN by inventory generation. ` +
					`The preliminary working-source-edit-impact-candidates facade path-locally binds one raw immutable HEAD blob and exact matching stage-zero index entry to one fatally decoded UTF-8 current FrozenSubject artifact, without executing Git status or filters or classifying repository-wide dirty state, then embeds the predecessor static-module POSSIBLE importer report verbatim. Its maxGitOperationDurationMs is one aggregate monotonic wall budget across all Git invocations in each complete observation; the child environment retains only narrow operating-system essentials and the resolved Git executable directory, while the host-installed Git executable and OS process launch remain ambient trust boundaries. Every terminal stdout envelope after request admission is maxResultBytes-bounded, with variable-size evidence omitted from a compact unavailable refusal when necessary. Its initial Git observation, exact FrozenSubject binding and final currentness recheck, and final Git reobservation are selected-source-only currentness; complete WorkingChangeSet identity, full CAP-031, DWP-005/DWP-006 completion, gates, runtime impact, provider qualification, and safe-removal proof remain NOT_CLAIMED. Its configured command csaa:analyze:working-source-edit-impact-candidates is CONFIGURED_NOT_RUN by inventory generation. ` +
					`The preliminary command-dispatch-topology report facade exposes the exact same-subject COMMANDS-to-HANDLERS static projection, full retained-arrow and command-handler predecessor evidence, and candidate-only dispatch handler edges while preserving PARTIAL/OPEN status and all upstream limitations. Its configured command csaa:analyze:command-dispatch-topology is CONFIGURED_NOT_RUN by inventory generation. ` +
					`The preliminary guard-classification-overlay report facade exposes the exact same-subject retained-arrow, command-handler, retained-guard, generated-state, and guard-classification evidence while preserving PARTIAL/OPEN status, retained verifier authority, candidate factory associations, helper/no-command frontiers, and explicit non-consumption of command-dispatch and command-event evidence. Its configured command csaa:analyze:guard-classification-overlay is CONFIGURED_NOT_RUN by inventory generation. ` +
					`The preliminary command-event-contract-overlay report facade exposes the exact same-subject retained-arrow, command-handler, COMMANDS/EVENTS registry, vocabulary, retained event-census, and command-event overlay evidence while preserving PARTIAL/OPEN status, retained event-surface authority, exact/candidate/unresolved predecessor attribution, an empty CAP-028 inference lane, dated static EMITTED meaning, and explicit non-consumption of command-dispatch, guard-enforcement, and guard-classification evidence. Its configured command csaa:analyze:command-event-contract-overlay is CONFIGURED_NOT_RUN by inventory generation. ` +
					`The preliminary logical-graph-composition report facade exposes one exact same-subject project-context, module-dependency, call, and two-layer reference-only composition evidence set while preserving PARTIAL/OPEN status, every predecessor limitation, and no query, slice, impact, finding, remediation, dead-code, safe-removal, DWP completion, registered-operation, or gate authority. Its configured command csaa:analyze:logical-graph-composition is CONFIGURED_NOT_RUN by inventory generation. ` +
					"TypeScript compiler roots from DWP-002 are consumed by current DWP-003 frozen Program construction and TS_PROJECT/TS_SYNTAX/TS_SYMBOL/TS_TYPE extraction. Semantic-snapshot duration enforcement uses a wall-anchored monotonic operation clock; maxDurationMs remains a caller-supplied operation budget and runaway guard, not an empirical runtime, expected duration, product ceiling, or SLO. The first seventeen bounded DWP-004 increments implement the validated compiler module-dependency projection, pure exact-schema-validated dependency-cruiser 16.10.4 output normalization and context-bound comparison, a deliberately partial static call graph with total call-site/frontier accounting, an implementation-local generated JPWB state-machine topology projection, an exact FrozenSubject- and executor-bound wrapper around the retained arrow-command census, a Program-local read/write access projection with explicit unsupported frontiers, a static JPWB command-registry-to-handler projection with separately preserved deterministic and candidate attribution lanes, a compositional static command-bus topology overlay with candidate-only references to predecessor handler targets, an exact FrozenSubject- and executor-bound wrapper around the retained guard-enforcement ledger, a compositional static guard-classification overlay that preserves retained judgments while reconciling exact transition, command-occurrence, anchor-containment, candidate factory, and helper-frontier evidence, a static command-event-contract overlay that reconciles generated command declarations and event schemas with exact vocabulary and dated retained event-surface evidence while preserving their distinct meanings, a deterministic structural SCC analysis that exactly partitions the selected independently validated directed module graph while preserving its explicit upstream-closure status, a deterministic static module-reachability traversal that is complete only within one independently validated graph and one explicit criterion while carrying that graph's upstream closure and limitations, a preliminary coding-agent report facade for that same CAP-027 slice over one explicit project/logical-path criterion and direction while preserving structural-only meaning and selected-captured-subject-only currentness, an exact reference-only semanticSourceId composition of independently validated module and call graph layers that preserves their identities, coverage, and limitations without constructing a universal code property graph, an exact FrozenSubject-bound project/program/source context projection with declared project-reference closure and no inferred variants, a bounded exact-key conditional-export resolution for one selected frozen workspace package, consumer source and Program, subpath, mode, platform, and ordered condition set with explicit unsupported frontiers, and a bounded exact resolved module-resolution trace for one literal bare workspace-package root import using an in-memory verified project-scoped compiler capture and exact types/NODE/IMPORT conditional-export predecessor. Preliminary DWP-005 coding-agent surfaces now include the bounded semantic-source query and one caller-declared whole-source static module impact-candidate projection over reverse CAP-027 reachability; neither completes DWP-005. Preliminary coding-agent report facades expose the complete bounded compiler module-dependency projection with every occurrence edge, the complete selected open static call projection with every retained invocation and candidate/frontier edge, the complete bounded generated JPWB state-machine topology projection for one exact generated source, the exact selected retained arrow-command census evidence and baseline comparison, the exact same-subject COMMANDS-to-HANDLERS static projection with retained arrow sites, occurrences, exact/candidate lanes, and explicit frontiers, the exact selected retained guard-enforcement-ledger audit and classification evidence, the exact same-subject retained guard, generated state, handler, and guard-classification overlay evidence, and the complete bounded Program-local read/write projection with exact project/source mappings while preserving PARTIAL capability status and all upstream closure limitations; zero recorded dependencies, callers, handlers, arrows, or accesses do not prove unused, dead, orphan, irrelevant, non-impacting, or safe-to-remove code. One preliminary coding-agent report command now composes the CAP-010/CAP-012/CAP-011 chain for one exact request while preserving its partial status and treating compiler-capture and CONTEXT_ONLY-target currentness as NOT_ASSESSED. One bounded DWP-003 semantic-completion increment implements only one exact zero-hop direct or one-hop same-root local-only package-root export declaration binding in the CAP-011 selected declaration target, with a complete same-root terminal declaration set and explicit empty augmentation and ambient-effect populations. A preliminary coding-agent report facade composes CAP-010/CAP-012/CAP-011/CAP-013 for one exact importer, workspace package, and export request, preserves the predecessor nonclaims as nested evidence, and limits final currentness to the selected captured subject while compiler capture and the CONTEXT_ONLY declaration target remain NOT_ASSESSED. A separate self-contained bounded DWP-003 semantic-completion increment implements only the strict flat external version-3 declaration-map source-origin slice over one exact FrozenSubject and StaticSemanticSnapshot, with no CAP-013 predecessor, no range inference, and caller-supplied target/map captures reconciled to an exact fresh declaration emission. Inventory generation executes or benchmarks none of these analysis providers and does not execute the retained event-surface gate; the preliminary semantic-source-query, static-module-impact-candidates, project-context, module-dependency, call-graph, state-machine-graph, arrow-command-census, command-handler-graph, command-dispatch-topology, guard-enforcement-ledger, guard-classification-overlay, command-event-contract-overlay, read/write-access, module-resolution-trace, declaration-context, structural SCC, or structural module-reachability report coding-agent commands; or the configured structural SCC, structural module-reachability, logical graph composition, project context graph, conditional export resolution, module resolution trace, declaration context analysis, and source origin correlation smoke commands. Cross-Program symbol or binding reconciliation, project variants beyond frozen ProgramRecipe witnesses, invocation-specific resolved signatures, JAN-CSAA-CAP-011 path-alias or module-resolution surfaces beyond the selected exact resolved-only slice, conditional-export patterns, arrays, package imports maps, external package maps, automatic undeclared loader conditions, broader declaration-file populations, cross-file or cross-Program merge analysis, module or global augmentation analysis, ambient-effect analysis, CAP-002 declaration or symbol consumption by the declaration-context slice, CAP-013 declaration-context consumption by the source-origin slice, source-map range inference or formats beyond the strict selected external declaration map, persistent or cross-revision filesystem freshness/currentness beyond the preliminary facades' final selected-captured-subject observation, compiler-capture or CONTEXT_ONLY-target filesystem currentness, checked-in build-output provenance or build authority from ignored local caller captures, CAP-023 generated-to-authored lineage, manifest/runtime dependency layers, graph algorithms beyond these bounded SCC, single-criterion module-reachability, and module-dependency-bounded may-slice analyses, graph composition beyond the exact declared two-layer mapping, control-flow and JAN-CSAA-CAP-007 data-flow graphs, generalized state-machine inference, broader JAN-CSAA-CAP-030 code slicing beyond the implemented module-dependency-bounded may-slice, runtime guard enforcement, runtime command dispatch, runtime event emission, and runtime command performability remain UNKNOWN, NOT_CLAIMED, or UNIMPLEMENTED." +
					' The additional working-source-edit-impact-candidates surface validates only one selected path-local raw edit before reusing the static module importer-candidate projection; none of the three preliminary DWP-005 surfaces completes DWP-005. Inventory generation also does not execute the working-source-edit-impact-candidates report command. ' +
					'The aggregate unexecuted preliminary report-command population includes semantic-source-query, static-module-impact-candidates, working-source-edit-impact-candidates, command-dispatch-topology, guard-classification-overlay, command-event-contract-overlay, and logical-graph-composition. ' +
					'The source-evidenced PARTIAL additions are a four-valued query facade, a dependency-bounded module may-slice, semantic-source comparison, 23-rule evaluation and native projection, all-75 benchmark accounting, five source-bound hybrid prerequisite rows plus bounded runtime/coverage/ESLint/Vitest imports, three native JPWB security rules, a seven-command coding-agent CLI/process surface, selected rebuildable content-addressed persistence with checked selection and cold/warm evidence, and broad-asymmetric plus exact-build-root dependency-cruiser profiles. Inventory generation executes none of them; current-run health for unexecuted provider/import surfaces, product performance thresholds or SLOs, external G10 acceptance, repository-wide G4/G5/G6 passage, and gate or analysis authority remain unclaimed. DWP-009 has only a dated local DEFER disposition with CodeQL and Joern unavailable in the recorded environment; it does not implement a code property graph.'
			},
			{
				provenance: canonicalProvenance(
					...EXISTING_GRAPH_RELEVANT_VERIFICATION_AUTHORITY,
					...JPWB_ARROW_COMMAND_CENSUS_PROVENANCE,
					...JPWB_ARROW_COMMAND_CENSUS_REPORT_PROVENANCE,
					...JPWB_GUARD_ENFORCEMENT_LEDGER_PROVENANCE,
					...JPWB_GUARD_ENFORCEMENT_LEDGER_RETAINED_PROVENANCE,
					...JPWB_GUARD_ENFORCEMENT_LEDGER_REPORT_PROVENANCE,
					...JPWB_COMMAND_DISPATCH_TOPOLOGY_PROVENANCE,
					...JPWB_COMMAND_DISPATCH_TOPOLOGY_REPORT_PROVENANCE,
					...JPWB_COMMAND_EVENT_CONTRACT_OVERLAY_PROVENANCE,
					...JPWB_COMMAND_EVENT_CONTRACT_OVERLAY_INPUT_PROVENANCE,
					...JPWB_COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROVENANCE,
					...JPWB_COMMAND_HANDLER_GRAPH_PROVENANCE,
					...JPWB_COMMAND_HANDLER_GRAPH_REPORT_PROVENANCE,
					...JPWB_GUARD_CLASSIFICATION_OVERLAY_PROVENANCE,
					...JPWB_GUARD_CLASSIFICATION_OVERLAY_REPORT_PROVENANCE,
					...TYPESCRIPT_CALL_GRAPH_PROVENANCE,
					...TYPESCRIPT_CALL_GRAPH_REPORT_PROVENANCE,
					...TYPESCRIPT_MODULE_DEPENDENCY_REPORT_PROVENANCE,
					...TYPESCRIPT_SEMANTIC_SOURCE_QUERY_PROVENANCE,
					...TYPESCRIPT_LOGICAL_GRAPH_COMPOSITION_PROVENANCE,
					...TYPESCRIPT_LOGICAL_GRAPH_COMPOSITION_REPORT_PROVENANCE,
					...TYPESCRIPT_PROJECT_CONTEXT_GRAPH_PROVENANCE,
					...TYPESCRIPT_PROJECT_CONTEXT_REPORT_PROVENANCE,
					...TYPESCRIPT_CONDITIONAL_EXPORT_RESOLUTION_PROVENANCE,
					...TYPESCRIPT_MODULE_RESOLUTION_TRACE_PROVENANCE,
					...TYPESCRIPT_MODULE_RESOLUTION_TRACE_REPORT_PROVENANCE,
					...TYPESCRIPT_DECLARATION_CONTEXT_ANALYSIS_PROVENANCE,
					...TYPESCRIPT_DECLARATION_CONTEXT_REPORT_PROVENANCE,
					...TYPESCRIPT_SOURCE_ORIGIN_CORRELATION_PROVENANCE,
					...TYPESCRIPT_READ_WRITE_ACCESS_GRAPH_PROVENANCE,
					...TYPESCRIPT_READ_WRITE_ACCESS_REPORT_PROVENANCE,
					...TYPESCRIPT_STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_PROVENANCE,
					...TYPESCRIPT_STRUCTURAL_MODULE_REACHABILITY_REPORT_PROVENANCE,
					...TYPESCRIPT_STATIC_MODULE_IMPACT_CANDIDATE_REPORT_PROVENANCE,
					...TYPESCRIPT_WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_PROVENANCE,
					...TYPESCRIPT_STRUCTURAL_SCC_ANALYSIS_PROVENANCE,
					...TYPESCRIPT_STRUCTURAL_SCC_REPORT_PROVENANCE,
					...JPWB_STATE_MACHINE_GRAPH_PROVENANCE,
					...JPWB_STATE_MACHINE_GRAPH_REPORT_PROVENANCE
				),
				statement: [
					'Existing graph-relevant verif censuses remain authoritative for their specialized repository gates.',
					`The arrow-command analyzer's ${ARROW_COMMAND_CENSUS_INTEGRATION_STRATEGY} integration strategy is IMPLEMENTED by bounded CSAA adapter ${ARROW_COMMAND_CENSUS_ADAPTER_ID} using method ${ARROW_COMMAND_CENSUS_METHOD}, while its source, exact baseline, tests, ${ARROW_COMMAND_CENSUS_VERIFIER_AUTHORITY} verifier authority, oracle, and gate effect remain unchanged.`,
					`The arrow-command-census report facade has analysis authority ${ARROW_COMMAND_CENSUS_REPORT_AUTHORITY}, authority transfer ${ARROW_COMMAND_CENSUS_REPORT_AUTHORITY_TRANSFER}, and gate effect ${ARROW_COMMAND_CENSUS_REPORT_GATE_EFFECT}; it neither holds nor transfers the retained census's ${ARROW_COMMAND_CENSUS_VERIFIER_AUTHORITY} verifier authority, does not replace its oracle or gate, does not execute the retained test gate or turn a baseline match into correctness proof, and confers no replacement equivalence, runtime performability, handler closure, graph-relation conformance, formal JAN-CSAA finding, repository-code dead/orphan classification, query, slicing, impact, comparison, or security-sandbox claim.`,
					`The guard-enforcement ledger's ${GUARD_ENFORCEMENT_LEDGER_INTEGRATION_STRATEGY} integration strategy is IMPLEMENTED by bounded CSAA adapter ${GUARD_ENFORCEMENT_LEDGER_ADAPTER_ID} using method ${GUARD_ENFORCEMENT_LEDGER_METHOD}; its retained analyzer, data, tests, ${GUARD_ENFORCEMENT_LEDGER_VERIFIER_AUTHORITY} verifier authority, oracle, and gate effect remain unchanged, and its Vitest authority is not executed by CSAA.`,
					`The guard-enforcement-ledger report facade has analysis authority ${GUARD_ENFORCEMENT_LEDGER_REPORT_AUTHORITY}, authority transfer ${GUARD_ENFORCEMENT_LEDGER_REPORT_AUTHORITY_TRANSFER}, and gate effect ${GUARD_ENFORCEMENT_LEDGER_REPORT_GATE_EFFECT}; it neither holds nor transfers retained verifier authority, does not execute the retained test gate, does not independently prove retained classifications or runtime enforcement, and confers no command refusal, dominance, reachability, effects, events, persistence, finding, query, slicing, impact, comparison, replacement-equivalence, full-conformance, or security-sandbox claim.`,
					`The guard-classification-overlay report facade has analysis authority ${GUARD_CLASSIFICATION_OVERLAY_REPORT_AUTHORITY}, authority transfer ${GUARD_CLASSIFICATION_OVERLAY_REPORT_AUTHORITY_TRANSFER}, and gate effect ${GUARD_CLASSIFICATION_OVERLAY_REPORT_GATE_EFFECT}; its distinct facade scope is ${GUARD_CLASSIFICATION_OVERLAY_REPORT_SCOPE}; it preserves PARTIAL/OPEN status, retained guard and arrow authority, candidate factory associations, helper and no-command-evidence frontiers, and selections commandDispatchTopology=${GUARD_CLASSIFICATION_OVERLAY_REPORT_SELECTION.commandDispatchTopology} and commandEventContractOverlay=${GUARD_CLASSIFICATION_OVERLAY_REPORT_SELECTION.commandEventContractOverlay}. It does not execute retained test gates and confers no runtime guard enforcement, refusal, dispatch, handler invocation or ownership, CFG dominance, reachability, path feasibility, effects, events, persistence, performability, query, slicing, impact, comparison, finding, remediation, safe removal, replacement equivalence, full conformance, provider qualification, or security-sandbox claim.`,
					'The static command-handler projection independently reconciles COMMANDS and HANDLERS and correlates retained sites.',
					`The command-handler-graph report facade has analysis authority ${COMMAND_HANDLER_GRAPH_REPORT_AUTHORITY}, authority transfer ${COMMAND_HANDLER_GRAPH_REPORT_AUTHORITY_TRANSFER}, and gate effect ${COMMAND_HANDLER_GRAPH_REPORT_GATE_EFFECT}; its distinct facade scope is ${COMMAND_HANDLER_GRAPH_REPORT_SCOPE}; it preserves the graph's PARTIAL/OPEN status and retained-arrow authority boundary and confers no runtime dispatch, handler invocation, performability, guard, effect, event, persistence, query, slicing, impact, comparison, architecture, finding, gate, safe-removal, replacement-equivalence, full-conformance, or security-sandbox claim.`,
					'The compositional command-bus topology overlay references that predecessor graph and binds the retained command-dispatch census artifact by exact identity, but does not execute, normalize, integrate, replace, or infer runtime behavior from that literal-presence proxy.',
					`The command-dispatch-topology report facade has analysis authority ${COMMAND_DISPATCH_TOPOLOGY_REPORT_AUTHORITY}, authority transfer ${COMMAND_DISPATCH_TOPOLOGY_REPORT_AUTHORITY_TRANSFER}, and gate effect ${COMMAND_DISPATCH_TOPOLOGY_REPORT_GATE_EFFECT}; its distinct facade scope is ${COMMAND_DISPATCH_TOPOLOGY_REPORT_SCOPE}; it preserves PARTIAL/OPEN status, retained census ${COMMAND_DISPATCH_TOPOLOGY_REPORT_SELECTION.retainedDispatchCensus}, and candidate-only edges and confers no runtime dispatch, path-feasibility, guard-rejection, payload-success, handler invocation, performability, project-context, query, slicing, impact, comparison, architecture, finding, gate, remediation, safe-removal, replacement-equivalence, full-conformance, or security-sandbox claim.`,
					'The static command-event-contract overlay binds the exact vocabulary and retained event-surface artifacts, reproduces only the supported BOUND formula and dated pinned EMITTED declaration, and does not execute or integrate the retained Vitest gate; its RETAINED_DELEGATED authority, oracle, baseline, and gate effect remain unchanged.',
					`The command-event-contract-overlay report facade has analysis authority ${COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_AUTHORITY}, authority transfer ${COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_AUTHORITY_TRANSFER}, and gate effect ${COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_GATE_EFFECT}; its distinct facade scope is ${COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SCOPE}; it preserves PARTIAL/OPEN status, retained event-surface authority, the exact/candidate/unresolved predecessor attribution boundary, the empty CAP-028 lane, and dated static EMITTED meaning. It parses and binds the exact retained census test bytes but does not execute that Vitest gate, and confers no handler ownership or invocation, runtime event construction or emission, payload compatibility, CFG path feasibility or reachability, effects, persistence, performability, query, slicing, impact, comparison, finding, remediation, safe removal, replacement equivalence, full conformance, provider qualification, or security-sandbox claim.`,
					`The structural SCC analysis has graph authority ${STRUCTURAL_SCC_ANALYSIS_GRAPH_AUTHORITY}, authority transfer ${STRUCTURAL_SCC_ANALYSIS_AUTHORITY_TRANSFER}, and gate effect ${STRUCTURAL_SCC_ANALYSIS_GATE_EFFECT}; it does not change retained verifier authority.`,
					`The structural module reachability analysis has graph authority ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_GRAPH_AUTHORITY}, authority transfer ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_AUTHORITY_TRANSFER}, and gate effect ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_GATE_EFFECT}; it changes no retained verifier authority. The preliminary structural module reachability report facade adds no authority; its final selected-captured-subject currentness does not create semantic-query, code-slice, change-impact, whole-program, irrelevance, non-impact, or safe-removal proof. Its complete static traversal is bounded to one independently validated graph and one explicit criterion, carries upstream closure, and is not JAN-CSAA-CAP-009 graph composition, JAN-CSAA-CAP-029 semantic query, or JAN-CSAA-CAP-030 code slicing.`,
					`The static module impact-candidate facade has analysis authority ${STATIC_MODULE_IMPACT_CANDIDATE_ANALYSIS_AUTHORITY}, authority transfer ${STATIC_MODULE_IMPACT_CANDIDATE_AUTHORITY_TRANSFER}, and gate effect ${STATIC_MODULE_IMPACT_CANDIDATE_GATE_EFFECT}; it retains ${STATIC_MODULE_IMPACT_CANDIDATE_CAPABILITY_STATUS} status and ${STATIC_MODULE_IMPACT_CANDIDATE_FULL_CAP_031} full CAP-031 conformance. Its direct/transitive vocabulary is structural distance only, every candidate remains POSSIBLE, and it confers no retained authority, definite breakage, non-impact, safe removal, behavior-preservation, finding, remediation, or gate claim.`,
					`The working-source-edit impact-candidate facade has analysis authority ${WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_ANALYSIS_AUTHORITY}, authority transfer ${WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_AUTHORITY_TRANSFER}, and gate effect ${WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_GATE_EFFECT}; it retains ${WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_CAPABILITY_STATUS} status and ${WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_FULL_CAP_031} full CAP-031 conformance. Its path-local raw edit observation does not establish a repository-wide WorkingChangeSetRecord, and its verbatim predecessor candidates remain POSSIBLE; it confers no provider qualification, runtime impact, finding, gate, non-impact, or safe-removal authority.`,
					`The logical graph composition has graph authority ${LOGICAL_GRAPH_COMPOSITION_GRAPH_AUTHORITY}, authority transfer ${LOGICAL_GRAPH_COMPOSITION_AUTHORITY_TRANSFER}, and gate effect ${LOGICAL_GRAPH_COMPOSITION_GATE_EFFECT}; freshness is ${LOGICAL_GRAPH_COMPOSITION_FRESHNESS}, currentness is ${LOGICAL_GRAPH_COMPOSITION_CURRENTNESS}, and it changes no retained verifier authority. Full JAN-CSAA-009 conformance is ${LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_009_CONFORMANCE}.`,
					`The logical-graph-composition report facade has analysis authority ${LOGICAL_GRAPH_COMPOSITION_REPORT_AUTHORITY}, authority transfer ${LOGICAL_GRAPH_COMPOSITION_REPORT_AUTHORITY_TRANSFER}, and gate effect ${LOGICAL_GRAPH_COMPOSITION_REPORT_GATE_EFFECT}; it remains preliminary and unregistered, preserves PARTIAL/OPEN status and every predecessor/report nonclaim, and confers no query, slice, impact, architecture, finding, remediation, dead-code, safe-removal, DWP completion, gate, merge, or disposition authority.`,
					`The semantic-source-query report facade has analysis authority ${SEMANTIC_SOURCE_QUERY_REPORT_AUTHORITY}, authority transfer ${SEMANTIC_SOURCE_QUERY_REPORT_AUTHORITY_TRANSFER}, and gate effect ${SEMANTIC_SOURCE_QUERY_REPORT_GATE_EFFECT}; it remains ${SEMANTIC_SOURCE_QUERY_REPORT_CAPABILITY_STATUS}, evaluates only the fixed retained ${SEMANTIC_SOURCE_QUERY_POPULATION} static-source population in ${SEMANTIC_SOURCE_QUERY_EXECUTION_MODE} mode, preserves OPEN global closure and explicit dynamic-evidence non-applicability, and confers no full CAP-029, DWP-005/DWP-006 completion, G5 or other gate, registered JAN-CSAA-007 operation, finding, remediation, or disposition authority.`,
					`The project context graph has graph authority ${PROJECT_CONTEXT_GRAPH_GRAPH_AUTHORITY}, authority transfer ${PROJECT_CONTEXT_GRAPH_AUTHORITY_TRANSFER}, and gate effect ${PROJECT_CONTEXT_GRAPH_GATE_EFFECT}; freshness is ${PROJECT_CONTEXT_GRAPH_FRESHNESS}, currentness is ${PROJECT_CONTEXT_GRAPH_CURRENTNESS}, and it changes no retained verifier authority. The preliminary project-context report facade adds no authority; its separate final selected-captured-subject currentness observation does not alter or promote those embedded graph fields. Full JAN-CSAA-010 conformance is ${PROJECT_CONTEXT_GRAPH_FULL_JAN_CSAA_010_CONFORMANCE}.`,
					`The conditional export resolution has resolution authority ${CONDITIONAL_EXPORT_RESOLUTION_AUTHORITY}, authority transfer ${CONDITIONAL_EXPORT_RESOLUTION_AUTHORITY_TRANSFER}, and gate effect ${CONDITIONAL_EXPORT_RESOLUTION_GATE_EFFECT}; freshness is ${CONDITIONAL_EXPORT_RESOLUTION_FRESHNESS}, currentness is ${CONDITIONAL_EXPORT_RESOLUTION_CURRENTNESS}, and it changes no retained verifier authority. Full JAN-CSAA-012 conformance is ${CONDITIONAL_EXPORT_RESOLUTION_FULL_JAN_CSAA_012_CONFORMANCE}.`,
					`The module resolution trace has resolution authority ${MODULE_RESOLUTION_TRACE_AUTHORITY}, authority transfer ${MODULE_RESOLUTION_TRACE_AUTHORITY_TRANSFER}, and gate effect ${MODULE_RESOLUTION_TRACE_GATE_EFFECT}; freshness is ${MODULE_RESOLUTION_TRACE_FRESHNESS}, currentness is ${MODULE_RESOLUTION_TRACE_CURRENTNESS}, and it changes no retained verifier authority. The preliminary module-resolution-trace report facade adds no authority; its final selected-captured-subject currentness observation does not assess compiler-capture or CONTEXT_ONLY-target filesystem currentness and does not alter or promote embedded predecessor fields. Full JAN-CSAA-011 conformance is ${MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_011_CONFORMANCE}, full JAN-CSAA-007 conformance is ${MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_007_CONFORMANCE}, and full JAN-CSAA-008 conformance is ${MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_008_CONFORMANCE}.`,
					`The declaration context analysis has analysis authority ${DECLARATION_CONTEXT_ANALYSIS_AUTHORITY}, authority transfer ${DECLARATION_CONTEXT_ANALYSIS_AUTHORITY_TRANSFER}, and gate effect ${DECLARATION_CONTEXT_ANALYSIS_GATE_EFFECT}; freshness is ${DECLARATION_CONTEXT_ANALYSIS_FRESHNESS}, currentness is ${DECLARATION_CONTEXT_ANALYSIS_CURRENTNESS}, and it changes no retained verifier authority. The preliminary declaration-context report facade adds no authority; its final selected-captured-subject currentness does not assess compiler-capture or CONTEXT_ONLY-target filesystem currentness and does not alter or promote embedded predecessor fields. Its selected same-root zero-hop direct or one-hop local-only explicit-ExportSpecifier declaration-binding slice is implemented without conferring authority over broader declaration, merge, augmentation, ambient-effect, CAP-002, or CAP-023 surfaces. Full JAN-CSAA-013 conformance is ${DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_013_CONFORMANCE}, full JAN-CSAA-007 conformance is ${DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_007_CONFORMANCE}, and full JAN-CSAA-008 conformance is ${DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_008_CONFORMANCE}.`,
					`The source origin correlation has analysis authority ${SOURCE_ORIGIN_CORRELATION_AUTHORITY}, authority transfer ${SOURCE_ORIGIN_CORRELATION_AUTHORITY_TRANSFER}, and gate effect ${SOURCE_ORIGIN_CORRELATION_GATE_EFFECT}; freshness is ${SOURCE_ORIGIN_CORRELATION_FRESHNESS}, currentness is ${SOURCE_ORIGIN_CORRELATION_CURRENTNESS}, and it changes no retained verifier authority. It accepts a self-contained FrozenSubject and StaticSemanticSnapshot request without a CAP-013 predecessor and implements only the strict external flat version-3 declaration-map slice over exact fresh re-emission and caller captures. The configured smoke's ignored local target and map captures are absent from FrozenSubject and are neither checked-in build-output provenance nor freshness, currentness, or build-authority evidence. Full JAN-CSAA-014 conformance is ${SOURCE_ORIGIN_CORRELATION_FULL_JAN_CSAA_014_CONFORMANCE}, full JAN-CSAA-007 conformance is ${SOURCE_ORIGIN_CORRELATION_FULL_JAN_CSAA_007_CONFORMANCE}, and full JAN-CSAA-008 conformance is ${SOURCE_ORIGIN_CORRELATION_FULL_JAN_CSAA_008_CONFORMANCE}.`,
					`The read/write-access report facade has analysis authority ${READ_WRITE_ACCESS_REPORT_AUTHORITY}, authority transfer ${READ_WRITE_ACCESS_REPORT_AUTHORITY_TRANSFER}, and gate effect ${READ_WRITE_ACCESS_REPORT_GATE_EFFECT}; it changes no retained verifier authority, does not promote the embedded PARTIAL/OPEN projection, and is not JAN-CSAA-CAP-007 data flow.`,
					`The module-dependency report facade has analysis authority ${MODULE_DEPENDENCY_REPORT_AUTHORITY}, authority transfer ${MODULE_DEPENDENCY_REPORT_AUTHORITY_TRANSFER}, and gate effect ${MODULE_DEPENDENCY_REPORT_GATE_EFFECT}; it changes no retained verifier authority, does not promote an embedded COMPLETE/CLOSED selected compiler projection to full CAP-004 or whole-program closure, and confers no query, slicing, impact, architecture, dead-code, or safe-removal conclusion.`,
					`The call-graph report facade has analysis authority ${CALL_GRAPH_REPORT_AUTHORITY}, authority transfer ${CALL_GRAPH_REPORT_AUTHORITY_TRANSFER}, and gate effect ${CALL_GRAPH_REPORT_GATE_EFFECT}; it changes no retained verifier authority, does not promote the embedded PARTIAL/OPEN graph to full CAP-005, exact or exhaustive callers, dispatch or entry closure, whole-program reachability, dead-code, or safe-removal proof.`,
					`The state-machine-graph report facade has analysis authority ${STATE_MACHINE_GRAPH_REPORT_AUTHORITY}, authority transfer ${STATE_MACHINE_GRAPH_REPORT_AUTHORITY_TRANSFER}, and gate effect ${STATE_MACHINE_GRAPH_REPORT_GATE_EFFECT}; it neither holds nor transfers the embedded graph's ${STATE_MACHINE_GRAPH_VERIFIER_AUTHORITY} specialized verifier authority, does not promote the embedded CAP-027 PARTIAL/OPEN and IMPLEMENTATION_LOCAL_UNREGISTERED projection, and confers no runtime behavior, command performability, guard enforcement, behavioral reachability, architecture, dead-code, or safe-removal proof.`,
					'The authority-resolution, aggregate-birth, command-dispatch, contract-number, dead-kernel, policy-evidence-requirement, and route-action census families remain delegated and unwrapped; event-surface remains delegated and exact-identity-bound but NOT_EXECUTED_BY_CSAA and NOT_INTEGRATED.',
					'Neither wrapper, preliminary report facades including semantic-source-query, static-module-impact-candidates, and working-source-edit-impact-candidates, any static overlay, partial call graph, structural SCC analysis, structural module reachability analysis, logical graph composition, project context graph, conditional export resolution, module resolution trace, declaration context analysis, source origin correlation, nor generated state-machine topology projection replaces, retires, weakens, or transfers retained authority.',
					'No such analysis establishes whole-program or behavioral reachability, assigns irrelevance or non-impact to unvisited nodes, identifies orphan or dead code, proves safe removal, supplies runtime evidence, changes a gate, or establishes full JAN-CSAA-007/008/009 conformance.',
					'Runtime guard enforcement, runtime dispatch, runtime event emission, runtime performability, replacement equivalence, and full graph-relation conformance remain unclaimed.'
				].join(' ')
			},
			{
				provenance: ['subject.excludedClasses'],
				statement:
					'Physical files under excluded build, cache, dependency, and generated-output trees are intentionally not enumerated; their included count is zero and their physical count remains UNKNOWN.'
			},
			{
				provenance: canonicalProvenance(
					...VITEST_V8_COVERAGE_INGESTION_PROVENANCE,
					'assuranceSurfaces.coverage.outputIdentity',
					'capabilities#test-coverage-ingestion'
				),
				statement:
					'The Vitest V8 coverage adapter is implemented, but inventory generation does not invoke it; coverage output identity and current-run coverage health remain UNKNOWN until a caller explicitly imports a validated output.'
			},
			{
				provenance: canonicalProvenance(
					...RUNTIME_TRACE_PROVENANCE,
					...JPWB_NATIVE_SECURITY_PROVENANCE,
					...ESLINT_RESULT_INGESTION_PROVENANCE,
					...VITEST_RESULT_INGESTION_PROVENANCE,
					'capabilities'
				),
				statement:
					'Runtime-trace, bounded native-security, ESLint, Vitest, and coverage import surfaces are implemented but not invoked by inventory generation; their current-run health remains NOT_RUN or UNKNOWN. Network execution remains unimplemented, and bounded native rules do not establish general security-query, taint, whole-program, or security-absence support.'
			}
		],
		verificationAssets: assets,
		workspaces
	};
	return inventory;
}
