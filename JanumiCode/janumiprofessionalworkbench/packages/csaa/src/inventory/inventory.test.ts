import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
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
	ARROW_COMMAND_CENSUS_REPORT_REGISTRY_STATUS,
	ARROW_COMMAND_CENSUS_REPORT_REQUEST_SCHEMA_VERSION,
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
	GUARD_ENFORCEMENT_LEDGER_RETAINED_VERIFIER_PATHS,
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
	STATIC_MODULE_IMPACT_CANDIDATE_PROPAGATION,
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_NONCLAIMS,
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_RESULT_SCHEMA_VERSION,
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_SAFETY_CEILINGS,
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_SCHEMA_VERSION,
	STATIC_MODULE_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION,
	STATIC_MODULE_IMPACT_CANDIDATE_UNASSESSED_PROPAGATION_FAMILIES
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
import { ARROW_COMMAND_CENSUS_RETAINED_VERIFIER_PATHS } from '../providers/jpwb-arrow-command-census/artifact-set.js';
import { collectInventory } from './collect-inventory.js';
import { projectSubjectForInventory } from './project-subject-for-inventory.js';
import {
	GENERATED_REGION_BEGIN,
	GENERATED_REGION_END,
	replaceGeneratedRegion,
	runInventory
} from './run-inventory.js';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const temporaryRoots: string[] = [];
const STRUCTURAL_SCC_ONLY_SMOKE_COMMAND =
	'CSAA_REPOSITORY_SMOKE=1 CSAA_REPOSITORY_SMOKE_PROFILE=STRUCTURAL CSAA_REPOSITORY_SMOKE_SUITE=STRUCTURAL_SCC vitest run --disableConsoleIntercept packages/csaa/src/semantic/repository-smoke.test.ts';
const STRUCTURAL_MODULE_REACHABILITY_ONLY_SMOKE_COMMAND =
	'CSAA_REPOSITORY_SMOKE=1 CSAA_REPOSITORY_SMOKE_PROFILE=STRUCTURAL CSAA_REPOSITORY_SMOKE_SUITE=STRUCTURAL_MODULE_REACHABILITY vitest run --disableConsoleIntercept packages/csaa/src/semantic/repository-smoke.test.ts';
const STRUCTURAL_MODULE_REACHABILITY_REPORT_COMMAND =
	'bun run scripts/csaa-structural-module-reachability.ts';
const STATIC_MODULE_IMPACT_CANDIDATE_REPORT_COMMAND =
	'bun run scripts/csaa-static-module-impact-candidates.ts';
const WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_COMMAND =
	'bun run scripts/csaa-working-source-edit-impact-candidates.ts';
const LOGICAL_GRAPH_COMPOSITION_ONLY_SMOKE_COMMAND =
	'CSAA_REPOSITORY_SMOKE=1 CSAA_REPOSITORY_SMOKE_PROFILE=FULL CSAA_REPOSITORY_SMOKE_SUITE=LOGICAL_GRAPH_COMPOSITION vitest run --disableConsoleIntercept packages/csaa/src/semantic/repository-smoke.test.ts';
const PROJECT_CONTEXT_GRAPH_ONLY_SMOKE_COMMAND =
	'CSAA_REPOSITORY_SMOKE=1 CSAA_REPOSITORY_SMOKE_PROFILE=STRUCTURAL CSAA_REPOSITORY_SMOKE_SUITE=PROJECT_CONTEXT_GRAPH vitest run --disableConsoleIntercept packages/csaa/src/semantic/repository-smoke.test.ts';
const PROJECT_CONTEXT_REPORT_COMMAND = 'bun run scripts/csaa-project-context.ts';
const MODULE_DEPENDENCY_REPORT_COMMAND = 'bun scripts/csaa-module-dependency.ts';
const SEMANTIC_SOURCE_QUERY_REPORT_COMMAND = 'bun scripts/csaa-semantic-source-query.ts';
const LOGICAL_GRAPH_COMPOSITION_REPORT_COMMAND = 'bun scripts/csaa-logical-graph-composition.ts';
const ARROW_COMMAND_CENSUS_REPORT_COMMAND = 'bun scripts/csaa-arrow-command-census.ts';
const COMMAND_HANDLER_GRAPH_REPORT_COMMAND = 'bun scripts/csaa-command-handler-graph.ts';
const COMMAND_DISPATCH_TOPOLOGY_REPORT_COMMAND = 'bun scripts/csaa-command-dispatch-topology.ts';
const COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_COMMAND =
	'bun scripts/csaa-command-event-contract-overlay.ts';
const GUARD_ENFORCEMENT_LEDGER_REPORT_COMMAND = 'bun scripts/csaa-guard-enforcement-ledger.ts';
const GUARD_CLASSIFICATION_OVERLAY_REPORT_COMMAND =
	'bun scripts/csaa-guard-classification-overlay.ts';
const CALL_GRAPH_REPORT_COMMAND = 'bun scripts/csaa-call-graph.ts';
const READ_WRITE_ACCESS_REPORT_COMMAND = 'bun scripts/csaa-read-write-access.ts';
const CONDITIONAL_EXPORT_RESOLUTION_ONLY_SMOKE_COMMAND =
	'CSAA_REPOSITORY_SMOKE=1 CSAA_REPOSITORY_SMOKE_PROFILE=STRUCTURAL CSAA_REPOSITORY_SMOKE_SUITE=CONDITIONAL_EXPORT_RESOLUTION vitest run --disableConsoleIntercept packages/csaa/src/semantic/repository-smoke.test.ts';
const MODULE_RESOLUTION_TRACE_ONLY_SMOKE_COMMAND =
	'CSAA_REPOSITORY_SMOKE=1 CSAA_REPOSITORY_SMOKE_PROFILE=STRUCTURAL CSAA_REPOSITORY_SMOKE_SUITE=MODULE_RESOLUTION_TRACE vitest run --disableConsoleIntercept packages/csaa/src/semantic/repository-smoke.test.ts';
const MODULE_RESOLUTION_TRACE_REPORT_COMMAND = 'bun scripts/csaa-module-resolution-trace.ts';
const DECLARATION_CONTEXT_ANALYSIS_ONLY_SMOKE_COMMAND =
	'CSAA_REPOSITORY_SMOKE=1 CSAA_REPOSITORY_SMOKE_PROFILE=STRUCTURAL CSAA_REPOSITORY_SMOKE_SUITE=DECLARATION_CONTEXT_ANALYSIS vitest run --disableConsoleIntercept packages/csaa/src/semantic/repository-smoke.test.ts';
const DECLARATION_CONTEXT_REPORT_COMMAND = 'bun scripts/csaa-declaration-context.ts';
const SOURCE_ORIGIN_CORRELATION_ONLY_SMOKE_COMMAND =
	'CSAA_REPOSITORY_SMOKE=1 CSAA_REPOSITORY_SMOKE_PROFILE=STRUCTURAL CSAA_REPOSITORY_SMOKE_SUITE=SOURCE_ORIGIN_CORRELATION vitest run --disableConsoleIntercept packages/csaa/src/semantic/repository-smoke.test.ts';
const LEGACY_STRUCTURAL_FULL_SUITE_SMOKE_COMMAND =
	'CSAA_REPOSITORY_SMOKE=1 CSAA_REPOSITORY_SMOKE_PROFILE=STRUCTURAL vitest run --disableConsoleIntercept packages/csaa/src/semantic/repository-smoke.test.ts';
const LEGACY_LOGICAL_GRAPH_COMPOSITION_SELECTORLESS_SMOKE_COMMAND =
	'CSAA_REPOSITORY_SMOKE=1 CSAA_REPOSITORY_SMOKE_PROFILE=FULL vitest run --disableConsoleIntercept packages/csaa/src/semantic/repository-smoke.test.ts';
const LOGICAL_GRAPH_COMPOSITION_PROVENANCE = [
	'packages/csaa/src/contracts/logical-graph-composition.ts',
	'packages/csaa/src/graph/build-logical-graph-composition.ts',
	'packages/csaa/src/graph/logical-graph-composition-canonical.ts',
	'packages/csaa/src/graph/validate-logical-graph-composition.ts',
	'packages/csaa/src/graph/build-logical-graph-composition.test.ts',
	'packages/csaa/src/graph/logical-graph-composition-coverage.test.ts',
	'packages/csaa/src/semantic/repository-smoke.test.ts'
] as const;
const LOGICAL_GRAPH_COMPOSITION_REPORT_PROVENANCE = [
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
const STRUCTURAL_MODULE_REACHABILITY_REPORT_PROVENANCE = [
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
const STATIC_MODULE_IMPACT_CANDIDATE_REPORT_PROVENANCE = [
	'packages/csaa/src/contracts/static-module-impact-candidate-report.ts',
	'packages/csaa/src/index.test.ts',
	'packages/csaa/src/index.ts',
	'packages/csaa/src/application/run-static-module-impact-candidate-report.ts',
	'packages/csaa/src/application/run-static-module-impact-candidate-report.test.ts',
	'packages/csaa/src/application/static-module-impact-candidate-command.test.ts',
	'scripts/csaa-static-module-impact-candidates.ts'
] as const;
const WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_PROVENANCE = [
	'packages/csaa/src/contracts/working-source-edit-impact-candidate-report.ts',
	'packages/csaa/src/impact/observe-working-source-edit.ts',
	'packages/csaa/src/impact/observe-working-source-edit.test.ts',
	'packages/csaa/src/semantic/monotonic-operation-clock.ts',
	'packages/csaa/src/application/run-working-source-edit-impact-candidate-report.ts',
	'packages/csaa/src/application/run-working-source-edit-impact-candidate-report.test.ts',
	'packages/csaa/src/application/working-source-edit-impact-candidate-command.test.ts',
	'packages/csaa/src/index.ts',
	'packages/csaa/src/index.test.ts',
	'scripts/csaa-working-source-edit-impact-candidates.ts'
] as const;
const PROJECT_CONTEXT_GRAPH_PROVENANCE = [
	'packages/csaa/src/contracts/project-context-graph.ts',
	'packages/csaa/src/graph/build-project-context-graph.ts',
	'packages/csaa/src/graph/project-context-graph-canonical.ts',
	'packages/csaa/src/graph/validate-project-context-graph.ts',
	'packages/csaa/src/graph/project-context-graph-fixture.test-support.ts',
	'packages/csaa/src/graph/build-project-context-graph.test.ts',
	'packages/csaa/src/graph/project-context-graph-coverage.test.ts',
	'packages/csaa/src/semantic/repository-smoke.test.ts'
] as const;
const PROJECT_CONTEXT_REPORT_PROVENANCE = [
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
const MODULE_DEPENDENCY_REPORT_PROVENANCE = [
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
const SEMANTIC_SOURCE_QUERY_PROVENANCE = [
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
const CALL_GRAPH_REPORT_PROVENANCE = [
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
const STATE_MACHINE_GRAPH_REPORT_PROVENANCE = [
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
const ARROW_COMMAND_CENSUS_REPORT_PROVENANCE = [
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
const COMMAND_HANDLER_GRAPH_REPORT_PROVENANCE = [
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
const COMMAND_DISPATCH_TOPOLOGY_REPORT_PROVENANCE = [
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
const COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROVENANCE = [
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
const GUARD_ENFORCEMENT_LEDGER_REPORT_PROVENANCE = [
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
const GUARD_CLASSIFICATION_OVERLAY_REPORT_PROVENANCE = [
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
const READ_WRITE_ACCESS_REPORT_PROVENANCE = [
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
const CONDITIONAL_EXPORT_RESOLUTION_PROVENANCE = [
	'packages/csaa/src/contracts/conditional-export-resolution.ts',
	'packages/csaa/src/resolution/build-conditional-export-resolution.ts',
	'packages/csaa/src/resolution/conditional-export-resolution-canonical.ts',
	'packages/csaa/src/resolution/validate-conditional-export-resolution.ts',
	'packages/csaa/src/resolution/conditional-export-resolution-fixture.test-support.ts',
	'packages/csaa/src/resolution/build-conditional-export-resolution.test.ts',
	'packages/csaa/src/resolution/conditional-export-resolution-coverage.test.ts',
	'packages/csaa/src/semantic/repository-smoke.test.ts'
] as const;
const MODULE_RESOLUTION_TRACE_PROVENANCE = [
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
const MODULE_RESOLUTION_TRACE_REPORT_PROVENANCE = [
	'packages/csaa/src/contracts/module-resolution-trace-report.ts',
	'packages/csaa/src/application/run-module-resolution-trace-report.ts',
	'packages/csaa/src/application/run-module-resolution-trace-command.ts',
	'packages/csaa/src/application/module-resolution-trace-progress-jsonl.ts',
	'packages/csaa/src/application/run-module-resolution-trace-report.test.ts',
	'packages/csaa/src/application/module-resolution-trace-progress-jsonl.test.ts',
	'packages/csaa/src/application/module-resolution-trace-command.test.ts',
	'scripts/csaa-module-resolution-trace.ts'
] as const;
const DECLARATION_CONTEXT_ANALYSIS_PROVENANCE = [
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
const DECLARATION_CONTEXT_REPORT_PROVENANCE = [
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
const SOURCE_ORIGIN_CORRELATION_PROVENANCE = [
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

function jpwbFixtureScriptCommand(name: string): string {
	if (name === 'csaa:semantic:smoke:conditional-export-resolution') {
		return CONDITIONAL_EXPORT_RESOLUTION_ONLY_SMOKE_COMMAND;
	}
	if (name === 'csaa:semantic:smoke:declaration-context-analysis') {
		return DECLARATION_CONTEXT_ANALYSIS_ONLY_SMOKE_COMMAND;
	}
	if (name === 'csaa:analyze:declaration-context') return DECLARATION_CONTEXT_REPORT_COMMAND;
	if (name === 'csaa:semantic:smoke:source-origin-correlation') {
		return SOURCE_ORIGIN_CORRELATION_ONLY_SMOKE_COMMAND;
	}
	if (name === 'csaa:semantic:smoke:module-resolution-trace') {
		return MODULE_RESOLUTION_TRACE_ONLY_SMOKE_COMMAND;
	}
	if (name === 'csaa:analyze:module-resolution-trace') {
		return MODULE_RESOLUTION_TRACE_REPORT_COMMAND;
	}
	if (name === 'csaa:semantic:smoke:logical-graph-composition') {
		return LOGICAL_GRAPH_COMPOSITION_ONLY_SMOKE_COMMAND;
	}
	if (name === 'csaa:semantic:smoke:project-context-graph') {
		return PROJECT_CONTEXT_GRAPH_ONLY_SMOKE_COMMAND;
	}
	if (name === 'csaa:analyze:project-context') return PROJECT_CONTEXT_REPORT_COMMAND;
	if (name === 'csaa:analyze:module-dependency') return MODULE_DEPENDENCY_REPORT_COMMAND;
	if (name === 'csaa:analyze:semantic-source-query') return SEMANTIC_SOURCE_QUERY_REPORT_COMMAND;
	if (name === 'csaa:analyze:logical-graph-composition')
		return LOGICAL_GRAPH_COMPOSITION_REPORT_COMMAND;
	if (name === 'csaa:analyze:arrow-command-census') return ARROW_COMMAND_CENSUS_REPORT_COMMAND;
	if (name === 'csaa:analyze:command-handler-graph') return COMMAND_HANDLER_GRAPH_REPORT_COMMAND;
	if (name === 'csaa:analyze:command-dispatch-topology')
		return COMMAND_DISPATCH_TOPOLOGY_REPORT_COMMAND;
	if (name === 'csaa:analyze:command-event-contract-overlay')
		return COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_COMMAND;
	if (name === 'csaa:analyze:guard-enforcement-ledger')
		return GUARD_ENFORCEMENT_LEDGER_REPORT_COMMAND;
	if (name === 'csaa:analyze:guard-classification-overlay')
		return GUARD_CLASSIFICATION_OVERLAY_REPORT_COMMAND;
	if (name === 'csaa:analyze:call-graph') return CALL_GRAPH_REPORT_COMMAND;
	if (name === 'csaa:analyze:read-write-access') return READ_WRITE_ACCESS_REPORT_COMMAND;
	if (name === 'csaa:semantic:smoke:structural-module-reachability') {
		return STRUCTURAL_MODULE_REACHABILITY_ONLY_SMOKE_COMMAND;
	}
	if (name === 'csaa:analyze:structural-module-reachability') {
		return STRUCTURAL_MODULE_REACHABILITY_REPORT_COMMAND;
	}
	if (name === 'csaa:analyze:static-module-impact-candidates') {
		return STATIC_MODULE_IMPACT_CANDIDATE_REPORT_COMMAND;
	}
	if (name === 'csaa:analyze:working-source-edit-impact-candidates') {
		return WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_COMMAND;
	}
	return name === 'csaa:semantic:smoke:structural-scc' ? STRUCTURAL_SCC_ONLY_SMOKE_COMMAND : 'true';
}

function write(root: string, path: string, content: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, content, 'utf8');
}

function fixture(): string {
	const root = mkdtempSync(join(tmpdir(), 'csaa-inventory-'));
	temporaryRoots.push(root);
	write(
		root,
		'package.json',
		JSON.stringify({
			name: 'fixture-workbench',
			private: true,
			scripts: { 'check-types': 'tsc --noEmit', test: 'vitest run' },
			workspaces: ['packages/*', 'apps/*']
		})
	);
	write(
		root,
		'packages/demo/package.json',
		JSON.stringify({
			name: '@fixture/demo',
			private: true,
			scripts: { build: 'tsc' },
			version: '0.0.0'
		})
	);
	write(root, 'packages/demo/src/index.ts', 'export const value = 1;\n');
	write(
		root,
		'packages/demo/tsconfig.json',
		'{ "compilerOptions": { "strict": true }, "include": ["src"] }\n'
	);
	write(
		root,
		'apps/demo/package.json',
		JSON.stringify({ name: '@fixture/app', private: true, version: '0.0.0' })
	);
	write(root, 'apps/demo/src/index.ts', 'export const app = true;\n');
	write(root, 'verif/example.test.ts', 'export const verification = true;\n');
	write(root, 'scripts/tool.ts', 'export const tool = true;\n');
	write(root, 'tsconfig.json', '{ "include": [] }\n');
	write(root, 'bun.lock', '    "typescript": ["typescript@5.9.3", ""],\n');
	write(
		root,
		'docs/ASTs and Code Analysis/JAN-CSAA-005 - JPWB TypeScript Repository Semantic Inventory and Conformance Mapping.md',
		`before\r\n${GENERATED_REGION_BEGIN}\r\nold\r\n${GENERATED_REGION_END}\r\nafter\r\n`
	);
	return root;
}

afterEach(() => {
	for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('inventory discovery and identity', () => {
	it('derives a non-empty inventory and exact domain-separated subject identity', () => {
		const root = fixture();
		const inventory = collectInventory({ repositoryRoot: root });
		expect(inventory.workspaces.map((workspace) => workspace.name)).toEqual([
			'@fixture/app',
			'@fixture/demo'
		]);
		expect(inventory.typescriptProjects.map((project) => project.path)).toEqual([
			'packages/demo/tsconfig.json',
			'tsconfig.json'
		]);
		expect(inventory.verificationAssets).toHaveLength(2);
		expect(inventory.subject.selectedFileCount).toBeGreaterThan(0);
		expect(inventory.subject.subjectId).toBe(projectSubjectForInventory(root).descriptor.subjectId);
	});

	it('matches verification command carriers by path token without basename substrings', () => {
		const root = fixture();
		write(
			root,
			'package.json',
			JSON.stringify({
				name: 'fixture-workbench',
				private: true,
				scripts: {
					'check-types': 'tsc --noEmit',
					'collision-check': 'bun scripts/report-ledger.ts',
					test: 'vitest run'
				},
				workspaces: ['packages/*', 'apps/*']
			})
		);
		write(root, 'scripts/report-ledger.ts', 'export const report = true;\n');
		write(root, 'scripts/mutants/ledger.ts', 'export const unrelated = true;\n');

		const inventory = collectInventory({ repositoryRoot: root });
		const commandCarrier = 'package.json#/scripts/collision-check';
		expect(
			inventory.verificationAssets.find((asset) => asset.path === 'scripts/report-ledger.ts')
				?.gateCarriers
		).toContain(commandCarrier);
		expect(
			inventory.verificationAssets.find((asset) => asset.path === 'scripts/mutants/ledger.ts')
				?.gateCarriers
		).not.toContain(commandCarrier);
	});

	it('distinguishes native CSAA analysis adapter invocations from retained gate scripts', () => {
		const root = fixture();
		write(
			root,
			'package.json',
			JSON.stringify({
				name: 'fixture-workbench',
				private: true,
				scripts: {
					'check-types': 'tsc --noEmit',
					'csaa:analyze:native-report': 'bun run scripts/csaa-native-report.ts',
					'fixture:gate': 'bun run scripts/fixture-gate.ts',
					test: 'vitest run'
				},
				workspaces: ['packages/*', 'apps/*']
			})
		);
		write(root, 'scripts/csaa-native-report.ts', 'export const report = true;\n');
		write(root, 'scripts/fixture-gate.ts', 'export const gate = true;\n');

		const inventory = collectInventory({ repositoryRoot: root });
		expect(
			inventory.verificationAssets.find((asset) => asset.path === 'scripts/csaa-native-report.ts')
		).toMatchObject({
			disposition: 'CSAA_NATIVE',
			gateCarriers: ['UNMAPPED'],
			role: 'ANALYZER'
		});
		expect(
			inventory.verificationAssets.find((asset) => asset.path === 'scripts/fixture-gate.ts')
		).toMatchObject({
			disposition: 'RETAIN_DELEGATED',
			gateCarriers: ['package.json#/scripts/fixture:gate'],
			role: 'SCRIPT'
		});
	});

	it('distinguishes a locked tool from configuration, gate wiring, and a CSAA adapter', () => {
		const inventory = collectInventory({ repositoryRoot: fixture() });
		const typescript = inventory.providers.find((provider) => provider.name === 'typescript');
		const dependencyCruiser = inventory.providers.find(
			(provider) => provider.name === 'dependency-cruiser'
		);
		expect(typescript).toMatchObject({
			adapterState: 'INVENTORY_INTEGRATED',
			configurationState: 'CONFIGURED',
			gateState: 'NOT_GATE_WIRED',
			installationState: 'LOCKED',
			version: '5.9.3'
		});
		expect(dependencyCruiser).toMatchObject({
			adapterState: 'UNIMPLEMENTED',
			configurationState: 'NOT_CONFIGURED',
			gateState: 'NOT_GATE_WIRED',
			installationState: 'NOT_LOCKED'
		});
	});

	it('reports bounded semantic and graph capability provenance without widening claims', () => {
		const inventory = collectInventory({ repositoryRoot: fixture() });
		const typescript = inventory.providers.find((provider) => provider.name === 'typescript');
		expect(typescript?.adapterCapabilities).toEqual([
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
			'logical-graph-composition',
			'module-resolution-trace',
			'project-context-graph',
			'read-write-access-projection',
			'semantic-source-query',
			'source-origin-correlation',
			'static-module-impact-candidates',
			'structural-module-reachability-analysis',
			'structural-scc-analysis',
			'working-source-edit-impact-candidates'
		]);
		expect(typescript?.provenance).toEqual(
			expect.arrayContaining([
				'packages/csaa/src/contracts/semantic.ts',
				'packages/csaa/src/providers/typescript/compiler-input-journal.ts',
				'packages/csaa/src/providers/typescript/extract-static-raw.ts',
				'packages/csaa/src/providers/typescript/extract-symbols.ts',
				'packages/csaa/src/providers/typescript/extract-types.ts',
				'packages/csaa/src/providers/typescript/frozen-compiler-host.ts',
				'packages/csaa/src/semantic/build-static-semantic-snapshot.ts',
				'packages/csaa/src/semantic/monotonic-operation-clock.ts',
				'packages/csaa/src/semantic/normalize-semantic-snapshot.ts',
				'packages/csaa/src/semantic/raw-semantic-model.ts',
				'packages/csaa/src/semantic/validate-snapshot.ts',
				'packages/csaa/src/contracts/command-event-contract-overlay.ts',
				'packages/csaa/src/graph/build-command-event-contract-overlay.ts',
				'packages/csaa/src/graph/command-event-contract-overlay-canonical.ts',
				'packages/csaa/src/graph/validate-command-event-contract-overlay.ts',
				'packages/csaa/src/semantic/repository-smoke.test.ts',
				COMMAND_EVENT_CONTRACT_OVERLAY_PROJECT_CONFIG_PATH,
				COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH,
				COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH,
				COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH,
				'packages/csaa/src/contracts/guard-classification-overlay.ts',
				'packages/csaa/src/graph/build-guard-classification-overlay.ts',
				'packages/csaa/src/graph/validate-guard-classification-overlay.ts',
				'packages/csaa/src/contracts/logical-graph-composition.ts',
				'packages/csaa/src/graph/build-logical-graph-composition.ts',
				'packages/csaa/src/graph/logical-graph-composition-canonical.ts',
				'packages/csaa/src/graph/validate-logical-graph-composition.ts',
				'packages/csaa/src/graph/build-logical-graph-composition.test.ts',
				'packages/csaa/src/graph/logical-graph-composition-coverage.test.ts',
				...PROJECT_CONTEXT_GRAPH_PROVENANCE,
				...PROJECT_CONTEXT_REPORT_PROVENANCE,
				...MODULE_DEPENDENCY_REPORT_PROVENANCE,
				...SEMANTIC_SOURCE_QUERY_PROVENANCE,
				...CALL_GRAPH_REPORT_PROVENANCE,
				...LOGICAL_GRAPH_COMPOSITION_REPORT_PROVENANCE,
				...COMMAND_HANDLER_GRAPH_REPORT_PROVENANCE,
				...COMMAND_DISPATCH_TOPOLOGY_REPORT_PROVENANCE,
				...COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROVENANCE,
				...GUARD_CLASSIFICATION_OVERLAY_REPORT_PROVENANCE,
				...READ_WRITE_ACCESS_REPORT_PROVENANCE,
				...CONDITIONAL_EXPORT_RESOLUTION_PROVENANCE,
				...MODULE_RESOLUTION_TRACE_PROVENANCE,
				...MODULE_RESOLUTION_TRACE_REPORT_PROVENANCE,
				...DECLARATION_CONTEXT_ANALYSIS_PROVENANCE,
				...SOURCE_ORIGIN_CORRELATION_PROVENANCE,
				...STATIC_MODULE_IMPACT_CANDIDATE_REPORT_PROVENANCE,
				...WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_PROVENANCE,
				'packages/csaa/src/contracts/structural-module-reachability-analysis.ts',
				'packages/csaa/src/graph/build-structural-module-reachability-analysis.ts',
				'packages/csaa/src/graph/structural-module-reachability-analysis-canonical.ts',
				'packages/csaa/src/graph/validate-structural-module-reachability-analysis.ts',
				'packages/csaa/src/graph/build-structural-module-reachability-analysis.test.ts',
				'packages/csaa/src/graph/structural-module-reachability-analysis-coverage.test.ts',
				'packages/csaa/src/contracts/structural-scc-analysis.ts',
				'packages/csaa/src/graph/build-structural-scc-analysis.ts',
				'packages/csaa/src/graph/structural-scc-analysis-canonical.ts',
				'packages/csaa/src/graph/validate-structural-scc-analysis.ts'
			])
		);
		expect(new Set(typescript!.provenance).size).toBe(typescript!.provenance.length);
		expect(typescript!.provenance).toEqual([...typescript!.provenance].sort());

		const capabilities = new Map(
			inventory.capabilities.map((capability) => [capability.id, capability])
		);
		for (const capability of capabilities.values()) {
			expect(new Set(capability.provenance).size).toBe(capability.provenance.length);
		}
		const semanticSourceQueryCapability = capabilities.get('semantic-source-query');
		expect(semanticSourceQueryCapability).toMatchObject({
			provider: 'typescript+implementation-local-semantic-source-query',
			state: 'PARTIAL'
		});
		for (const expectedProvenance of [
			...SEMANTIC_SOURCE_QUERY_PROVENANCE,
			'capabilities#typescript-ast',
			'package.json#/scripts/csaa:analyze:semantic-source-query'
		])
			expect(semanticSourceQueryCapability!.provenance.includes(expectedProvenance)).toBe(true);
		for (const boundary of [
			SEMANTIC_SOURCE_QUERY_OPERATION_VERSION,
			SEMANTIC_SOURCE_QUERY_ALGEBRA_VERSION,
			SEMANTIC_SOURCE_QUERY_CAPABILITY_STATUS,
			SEMANTIC_SOURCE_QUERY_EXECUTION_MODE,
			SEMANTIC_SOURCE_QUERY_POPULATION,
			JSON.stringify(SEMANTIC_SOURCE_QUERY_FIELDS),
			JSON.stringify(SEMANTIC_SOURCE_QUERY_OPERATORS),
			SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
			SEMANTIC_SOURCE_QUERY_REPORT_REQUEST_SCHEMA_VERSION,
			SEMANTIC_SOURCE_QUERY_REPORT_RESULT_SCHEMA_VERSION,
			SEMANTIC_SOURCE_QUERY_REPORT_SCHEMA_VERSION,
			SEMANTIC_SOURCE_QUERY_REPORT_CAPABILITY,
			SEMANTIC_SOURCE_QUERY_REPORT_CAPABILITY_STATUS,
			`analysis authority ${SEMANTIC_SOURCE_QUERY_REPORT_AUTHORITY}`,
			`authority transfer ${SEMANTIC_SOURCE_QUERY_REPORT_AUTHORITY_TRANSFER}`,
			`gate effect ${SEMANTIC_SOURCE_QUERY_REPORT_GATE_EFFECT}`,
			'exact scalar equality, exact nonempty case-sensitive logicalPath prefix comparison, unary NOT, and nonempty ordered AND/OR',
			'no path normalization, globbing, regular-expression matching, or path-segment inference',
			'Whole-AST validation precedes COMPLETE node-total evaluation',
			'CLOSED_FOR_RETAINED_VALIDATED_SEMANTIC_SOURCES',
			'OPEN global closure',
			'dynamic-evidence NOT_APPLICABLE',
			'Successful evidence is never truncated',
			'not full JAN-CSAA-CAP-029',
			'does not complete DWP-005 or DWP-006',
			'does not pass or activate G5',
			'not a registered JAN-CSAA-007 operation or OperationResponse',
			'creates no rule, finding, severity, remediation, gate, or disposition',
			'four-valued algebra helpers and evaluator',
			'CONFIGURED_NOT_RUN'
		])
			expect(semanticSourceQueryCapability!.explanation).toContain(boundary);
		for (const nonclaim of [
			...SEMANTIC_SOURCE_QUERY_NONCLAIMS,
			...SEMANTIC_SOURCE_QUERY_REPORT_NONCLAIMS
		])
			expect(semanticSourceQueryCapability!.explanation).toContain(nonclaim);
		const commandHandlerCapability = capabilities.get('command-handler-static-projection');
		expect(commandHandlerCapability).toBeDefined();
		expect(commandHandlerCapability!.provider).toBe('typescript+jpwb-arrow-command-census-overlay');
		expect(commandHandlerCapability!.state).toBe('PARTIAL');
		for (const expectedProvenance of [
			...COMMAND_HANDLER_GRAPH_REPORT_PROVENANCE,
			'package.json#/scripts/csaa:analyze:command-handler-graph'
		])
			expect(commandHandlerCapability!.provenance.includes(expectedProvenance)).toBe(true);
		for (const expected of [
			COMMAND_HANDLER_GRAPH_REPORT_OPERATION_VERSION,
			COMMAND_HANDLER_GRAPH_REPORT_REQUEST_SCHEMA_VERSION,
			COMMAND_HANDLER_GRAPH_REPORT_RESULT_SCHEMA_VERSION,
			COMMAND_HANDLER_GRAPH_REPORT_SCHEMA_VERSION,
			JSON.stringify(COMMAND_HANDLER_GRAPH_REPORT_SELECTION),
			COMMAND_HANDLER_GRAPH_REPORT_EXECUTION_SELECTION,
			`analysis authority is ${COMMAND_HANDLER_GRAPH_REPORT_AUTHORITY}`,
			`authority transfer is ${COMMAND_HANDLER_GRAPH_REPORT_AUTHORITY_TRANSFER}`,
			`gate effect is ${COMMAND_HANDLER_GRAPH_REPORT_GATE_EFFECT}`,
			'bounded semantic snapshot summary',
			'does not construct CAP-010 project-context projection evidence',
			'same-process FrozenSubject-and-semantic handoff',
			'successful evidence is never truncated',
			'CONFIGURED_NOT_RUN'
		])
			expect(commandHandlerCapability!.explanation).toContain(expected);
		for (const nonclaim of COMMAND_HANDLER_GRAPH_REPORT_NONCLAIMS)
			expect(commandHandlerCapability!.explanation).toContain(nonclaim);
		const retainedArrowProvenance = [...ARROW_COMMAND_CENSUS_RETAINED_VERIFIER_PATHS];
		const arrowCapability = capabilities.get('arrow-command-census');
		expect(arrowCapability).toBeDefined();
		expect(arrowCapability!.state).toBe('PARTIAL');
		for (const expectedProvenance of retainedArrowProvenance) {
			expect(arrowCapability!.provenance.includes(expectedProvenance)).toBe(true);
		}
		const guardCapability = capabilities.get('guard-enforcement-ledger');
		expect(guardCapability).toBeDefined();
		expect(guardCapability!.provider).toBe(GUARD_ENFORCEMENT_LEDGER_ADAPTER_ID);
		expect(guardCapability!.state).toBe('PARTIAL');
		for (const expectedProvenance of [
			...GUARD_ENFORCEMENT_LEDGER_RETAINED_VERIFIER_PATHS,
			...GUARD_ENFORCEMENT_LEDGER_REPORT_PROVENANCE,
			'package.json#/scripts/csaa:analyze:guard-enforcement-ledger',
			'packages/csaa/src/contracts/guard-enforcement-ledger.ts',
			'packages/csaa/src/providers/jpwb-arrow-command-census/executor-environment.ts',
			'packages/csaa/src/providers/jpwb-guard-enforcement-ledger/artifact-set.ts',
			'packages/csaa/src/providers/jpwb-guard-enforcement-ledger/observe-guard-enforcement-ledger.ts',
			'packages/csaa/src/providers/jpwb-guard-enforcement-ledger/validate-guard-enforcement-ledger.ts'
		]) {
			expect(guardCapability!.provenance.includes(expectedProvenance)).toBe(true);
		}
		expect(guardCapability!.explanation).toContain(
			`exact adapter ${GUARD_ENFORCEMENT_LEDGER_ADAPTER_ID} and method ${GUARD_ENFORCEMENT_LEDGER_METHOD}`
		);
		expect(guardCapability!.explanation).toContain(
			`${GUARD_ENFORCEMENT_LEDGER_VERIFIER_AUTHORITY} verifier authority`
		);
		expect(guardCapability!.explanation).toContain('NOT_EXECUTED_BY_CSAA');
		expect(guardCapability!.explanation).toContain('runtime enforcement');
		expect(guardCapability!.explanation).toContain(
			'Process isolation is not a hostile-code security sandbox'
		);
		expect(guardCapability!.explanation).toContain(
			'retained subject initializers may execute inside the capsule'
		);
		expect(guardCapability!.explanation).toContain(
			GUARD_ENFORCEMENT_LEDGER_REPORT_OPERATION_VERSION
		);
		expect(guardCapability!.explanation).toContain(
			GUARD_ENFORCEMENT_LEDGER_REPORT_REQUEST_SCHEMA_VERSION
		);
		expect(guardCapability!.explanation).toContain(
			GUARD_ENFORCEMENT_LEDGER_REPORT_RESULT_SCHEMA_VERSION
		);
		expect(guardCapability!.explanation).toContain(GUARD_ENFORCEMENT_LEDGER_REPORT_SCHEMA_VERSION);
		expect(guardCapability!.explanation).toContain(
			JSON.stringify(GUARD_ENFORCEMENT_LEDGER_REPORT_SELECTION)
		);
		expect(guardCapability!.explanation).toContain(
			GUARD_ENFORCEMENT_LEDGER_REPORT_EXECUTION_SELECTION
		);
		expect(guardCapability!.explanation).toContain(
			`capability status is ${GUARD_ENFORCEMENT_LEDGER_REPORT_CAPABILITY_STATUS}`
		);
		expect(guardCapability!.explanation).toContain(
			`registry status is ${GUARD_ENFORCEMENT_LEDGER_REPORT_REGISTRY_STATUS}`
		);
		expect(guardCapability!.explanation).toContain(
			`scope is ${GUARD_ENFORCEMENT_LEDGER_REPORT_SCOPE}`
		);
		expect(guardCapability!.explanation).toContain(
			`analysis authority is ${GUARD_ENFORCEMENT_LEDGER_REPORT_AUTHORITY}`
		);
		expect(guardCapability!.explanation).toContain(
			`authority transfer is ${GUARD_ENFORCEMENT_LEDGER_REPORT_AUTHORITY_TRANSFER}`
		);
		expect(guardCapability!.explanation).toContain(
			`gate effect is ${GUARD_ENFORCEMENT_LEDGER_REPORT_GATE_EFFECT}`
		);
		expect(guardCapability!.explanation).toContain('successful evidence is never truncated');
		expect(guardCapability!.explanation).toContain('selected-captured-subject currentness');
		for (const nonclaim of GUARD_ENFORCEMENT_LEDGER_REPORT_NONCLAIMS)
			expect(guardCapability!.explanation).toContain(nonclaim);
		for (const expectedProvenance of [
			...retainedArrowProvenance,
			'capabilities#arrow-command-census',
			'capabilities#symbol-table',
			'capabilities#typescript-ast',
			'packages/csaa/src/contracts/command-handler-graph.ts',
			'packages/csaa/src/contracts/semantic.ts',
			'packages/csaa/src/graph/build-command-handler-graph.ts',
			'packages/csaa/src/graph/validate-command-handler-graph.ts',
			'packages/csaa/src/providers/typescript/extract-static-raw.ts',
			'packages/csaa/src/providers/typescript/extract-symbols.ts',
			'packages/csaa/src/semantic/normalize-semantic-snapshot.ts',
			'packages/csaa/src/semantic/validate-snapshot.ts'
		]) {
			expect(commandHandlerCapability!.provenance.includes(expectedProvenance)).toBe(true);
		}
		expect(
			commandHandlerCapability!.provenance.includes(
				'packages/csaa/src/providers/typescript/extract-types.ts'
			)
		).toBe(false);
		expect(commandHandlerCapability!.explanation).toContain('runtime performability');
		const commandDispatchCapability = capabilities.get('command-dispatch-static-topology');
		expect(commandDispatchCapability).toBeDefined();
		expect(commandDispatchCapability!.provider).toBe('typescript+command-handler-graph-overlay');
		expect(commandDispatchCapability!.state).toBe('PARTIAL');
		for (const expectedProvenance of [
			...COMMAND_DISPATCH_TOPOLOGY_REPORT_PROVENANCE,
			'capabilities#command-handler-static-projection',
			'capabilities#symbol-table',
			'capabilities#typescript-ast',
			'package.json#/scripts/csaa:analyze:command-dispatch-topology',
			'packages/csaa/src/contracts/command-dispatch-topology.ts',
			'packages/csaa/src/graph/build-command-dispatch-topology.ts',
			'packages/csaa/src/graph/command-dispatch-topology-canonical.ts',
			'packages/csaa/src/graph/validate-command-dispatch-topology.ts',
			'verif/command-dispatch-census.test.ts'
		]) {
			expect(commandDispatchCapability!.provenance.includes(expectedProvenance)).toBe(true);
		}
		expect(
			commandDispatchCapability!.provenance.includes(
				'packages/csaa/src/providers/typescript/extract-types.ts'
			)
		).toBe(false);
		for (const boundary of [
			COMMAND_DISPATCH_TOPOLOGY_REPORT_OPERATION_VERSION,
			COMMAND_DISPATCH_TOPOLOGY_REPORT_REQUEST_SCHEMA_VERSION,
			COMMAND_DISPATCH_TOPOLOGY_REPORT_RESULT_SCHEMA_VERSION,
			COMMAND_DISPATCH_TOPOLOGY_REPORT_SCHEMA_VERSION,
			JSON.stringify(COMMAND_DISPATCH_TOPOLOGY_REPORT_SELECTION),
			COMMAND_DISPATCH_TOPOLOGY_REPORT_EXECUTION_SELECTION,
			`distinct facade scope is ${COMMAND_DISPATCH_TOPOLOGY_REPORT_SCOPE}`,
			`analysis authority is ${COMMAND_DISPATCH_TOPOLOGY_REPORT_AUTHORITY}`,
			`authority transfer is ${COMMAND_DISPATCH_TOPOLOGY_REPORT_AUTHORITY_TRANSFER}`,
			`gate effect is ${COMMAND_DISPATCH_TOPOLOGY_REPORT_GATE_EFFECT}`,
			'same-process nonserialized command-handler pipeline handoff',
			'full retained-arrow observation, command-handler graph, and command-dispatch topology evidence',
			'successful evidence is never truncated',
			'CONFIGURED_NOT_RUN',
			'NOT_EXECUTED_BY_CSAA',
			'NOT_INTEGRATED',
			'runtime dispatch',
			'full JAN-CSAA-007/008 conformance'
		])
			expect(commandDispatchCapability!.explanation).toContain(boundary);
		for (const nonclaim of COMMAND_DISPATCH_TOPOLOGY_REPORT_NONCLAIMS)
			expect(commandDispatchCapability!.explanation).toContain(nonclaim);
		const guardOverlayCapability = capabilities.get('guard-classification-static-overlay');
		expect(guardOverlayCapability).toBeDefined();
		expect(guardOverlayCapability).toMatchObject({
			provider: 'typescript+retained-guard-state-handler-overlay',
			state: 'PARTIAL'
		});
		for (const expectedProvenance of [
			...GUARD_CLASSIFICATION_OVERLAY_REPORT_PROVENANCE,
			'capabilities#arrow-command-census',
			'capabilities#command-handler-static-projection',
			'capabilities#guard-enforcement-ledger',
			'capabilities#state-machine-graph',
			'capabilities#symbol-table',
			'capabilities#typescript-ast',
			'packages/csaa/src/contracts/guard-classification-overlay.ts',
			'packages/csaa/src/graph/build-guard-classification-overlay.ts',
			'packages/csaa/src/graph/guard-classification-overlay-canonical.ts',
			'packages/csaa/src/graph/validate-guard-classification-overlay.ts',
			'packages/csaa/src/semantic/repository-smoke.test.ts',
			'package.json#/scripts/csaa:semantic:smoke:guard-classification',
			'package.json#/scripts/csaa:analyze:guard-classification-overlay',
			...GUARD_ENFORCEMENT_LEDGER_RETAINED_VERIFIER_PATHS
		])
			expect(guardOverlayCapability!.provenance.includes(expectedProvenance)).toBe(true);
		for (const boundary of [
			GUARD_CLASSIFICATION_OVERLAY_REPORT_OPERATION_VERSION,
			GUARD_CLASSIFICATION_OVERLAY_REPORT_REQUEST_SCHEMA_VERSION,
			GUARD_CLASSIFICATION_OVERLAY_REPORT_RESULT_SCHEMA_VERSION,
			GUARD_CLASSIFICATION_OVERLAY_REPORT_SCHEMA_VERSION,
			JSON.stringify(GUARD_CLASSIFICATION_OVERLAY_REPORT_SELECTION),
			GUARD_CLASSIFICATION_OVERLAY_REPORT_EXECUTION_SELECTION,
			`distinct facade scope is ${GUARD_CLASSIFICATION_OVERLAY_REPORT_SCOPE}`,
			`analysis authority is ${GUARD_CLASSIFICATION_OVERLAY_REPORT_AUTHORITY}`,
			`authority transfer is ${GUARD_CLASSIFICATION_OVERLAY_REPORT_AUTHORITY_TRANSFER}`,
			`gate effect is ${GUARD_CLASSIFICATION_OVERLAY_REPORT_GATE_EFFECT}`,
			GUARD_CLASSIFICATION_OVERLAY_REPORT_STATE_SOURCE.logicalPath,
			GUARD_CLASSIFICATION_OVERLAY_REPORT_STATE_SOURCE.projectConfigPath,
			'same-process nonserialized command-handler pipeline handoff',
			'full retained-arrow, command-handler, guard, state-observation, state-graph, and overlay evidence',
			'successful evidence is never truncated',
			'Dispatch topology and command-event evidence remain explicitly NOT_CONSUMED',
			'without promotion',
			'CONFIGURED_NOT_RUN',
			'stale retained line numbers',
			'JAN-CSAA-CAP-027 derivation evidence',
			'candidate-only JAN-CSAA-CAP-028 inference evidence',
			'neither invokes nor executes handlers',
			'handler ownership',
			'helper citations remain explicit frontiers',
			'runtime enforcement or performability',
			'full JAN-CSAA-007/008 conformance'
		])
			expect(guardOverlayCapability!.explanation).toContain(boundary);
		for (const nonclaim of GUARD_CLASSIFICATION_OVERLAY_REPORT_NONCLAIMS)
			expect(guardOverlayCapability!.explanation).toContain(nonclaim);
		const commandEventCapability = capabilities.get('command-event-contract-static-overlay');
		expect(commandEventCapability).toMatchObject({
			provider: 'typescript+command-handler-graph+jpwb-event-contract-overlay',
			state: 'PARTIAL'
		});
		for (const expectedProvenance of [
			...COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROVENANCE,
			'capabilities#arrow-command-census',
			'capabilities#command-handler-static-projection',
			'capabilities#symbol-table',
			'capabilities#typescript-ast',
			'packages/csaa/src/contracts/command-event-contract-overlay.ts',
			'packages/csaa/src/graph/build-command-event-contract-overlay.ts',
			'packages/csaa/src/graph/command-event-contract-overlay-canonical.ts',
			'packages/csaa/src/graph/validate-command-event-contract-overlay.ts',
			'packages/csaa/src/semantic/repository-smoke.test.ts',
			COMMAND_EVENT_CONTRACT_OVERLAY_PROJECT_CONFIG_PATH,
			COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH,
			COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH,
			COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH,
			'package.json#/scripts/csaa:semantic:smoke:command-event-contract',
			'package.json#/scripts/csaa:analyze:command-event-contract-overlay'
		])
			expect(commandEventCapability!.provenance.includes(expectedProvenance)).toBe(true);
		for (const boundary of [
			COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_OPERATION_VERSION,
			COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_REQUEST_SCHEMA_VERSION,
			COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_RESULT_SCHEMA_VERSION,
			COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SCHEMA_VERSION,
			JSON.stringify(COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SELECTION),
			COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_EXECUTION_SELECTION,
			`distinct facade scope is ${COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SCOPE}`,
			`analysis authority is ${COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_AUTHORITY}`,
			`authority transfer is ${COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_AUTHORITY_TRANSFER}`,
			`gate effect is ${COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_GATE_EFFECT}`,
			'implementation-local unregistered preliminary coding-agent report facade',
			'facade and embedded overlay remain PARTIAL/OPEN and IMPLEMENTATION_LOCAL_UNREGISTERED',
			'Final CURRENT_FOR_CAPTURED_SUBJECT is scoped to SELECTED_CAPTURED_SUBJECT_ONLY',
			'establishes neither persistent nor cross-revision currentness',
			'same-process nonserialized command-handler pipeline handoff',
			'full retained-arrow, command-handler, registry, vocabulary, retained-census, and command-event overlay evidence',
			'successful evidence is never truncated',
			'Command-dispatch topology, guard-enforcement ledger, and guard-classification evidence remain explicitly NOT_CONSUMED',
			'exact test bytes are parsed and bound as dated static evidence',
			'bounded best-effort JSONL progress transport is excluded from report identity and evidence',
			'CONFIGURED_NOT_RUN',
			'primary and additional command-declared event links',
			'dated pinned EMITTED set',
			'JAN-CSAA-CAP-027 derivation lane',
			'referenced predecessor handler attributions remain visibly exact, candidate, or unresolved without promotion',
			"overlay's JAN-CSAA-CAP-028 inference lane is present but empty",
			'adds no candidate relationship or runtime conclusion',
			'RETAINED_DELEGATED',
			'NOT_EXECUTED_BY_CSAA',
			'NOT_INTEGRATED',
			'handler ownership',
			'neither invokes nor executes a handler',
			'event construction or emission',
			'payload compatibility',
			'full JAN-CSAA-007/008 conformance',
			'not fresh runtime evidence'
		])
			expect(commandEventCapability!.explanation).toContain(boundary);
		for (const nonclaim of COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_NONCLAIMS)
			expect(commandEventCapability!.explanation).toContain(nonclaim);
		expect(
			commandEventCapability!.provenance.includes(
				'packages/csaa/src/providers/typescript/extract-types.ts'
			)
		).toBe(false);
		const structuralSccCapability = capabilities.get('structural-scc-analysis');
		expect(structuralSccCapability).toMatchObject({
			provider: 'typescript+validated-module-dependency-graph-scc',
			state: 'PARTIAL'
		});
		for (const expectedProvenance of [
			'packages/csaa/src/application/run-structural-scc-report.test.ts',
			'packages/csaa/src/application/run-structural-scc-report.ts',
			'packages/csaa/src/application/structural-scc-command.test.ts',
			'packages/csaa/src/application/structural-scc-progress-jsonl.test.ts',
			'packages/csaa/src/application/structural-scc-progress-jsonl.ts',
			'packages/csaa/test-fixtures/structural-scc-command/tsconfig.json',
			'packages/csaa/test-fixtures/structural-scc-command/a.ts',
			'packages/csaa/test-fixtures/structural-scc-command/b.ts',
			'packages/csaa/test-fixtures/structural-scc-command/leaf.ts',
			'capabilities#dependency-graph',
			'capabilities#symbol-table',
			'capabilities#typescript-ast',
			'packages/csaa/src/contracts/graph.ts',
			'packages/csaa/src/contracts/semantic.ts',
			'packages/csaa/src/contracts/structural-scc-analysis.ts',
			'packages/csaa/src/contracts/structural-scc-report.ts',
			'packages/csaa/src/graph/build-module-dependency-graph.ts',
			'packages/csaa/src/graph/build-structural-scc-analysis.ts',
			'packages/csaa/src/graph/structural-scc-analysis-canonical.ts',
			'packages/csaa/src/graph/validate-graph.ts',
			'packages/csaa/src/graph/validate-structural-scc-analysis.ts',
			'packages/csaa/src/providers/typescript/extract-static-raw.ts',
			'packages/csaa/src/providers/typescript/extract-symbols.ts',
			'packages/csaa/src/semantic/repository-smoke.test.ts',
			'package.json#/scripts/csaa:semantic:smoke:structural-scc',
			'package.json#/scripts/csaa:analyze:structural-scc',
			'scripts/csaa-structural-scc.ts'
		])
			expect(structuralSccCapability!.provenance.includes(expectedProvenance)).toBe(true);
		for (const exactBoundary of [
			STRUCTURAL_SCC_ANALYSIS_METHOD,
			STRUCTURAL_SCC_ANALYSIS_CAPABILITY,
			STRUCTURAL_SCC_ANALYSIS_CAPABILITY_STATUS,
			STRUCTURAL_SCC_ANALYSIS_GRAPH_AUTHORITY,
			STRUCTURAL_SCC_ANALYSIS_AUTHORITY_TRANSFER,
			STRUCTURAL_SCC_ANALYSIS_GATE_EFFECT,
			STRUCTURAL_SCC_ANALYSIS_FULL_JAN_CSAA_007_CONFORMANCE,
			STRUCTURAL_SCC_ANALYSIS_FULL_JAN_CSAA_008_CONFORMANCE,
			STRUCTURAL_SCC_ANALYSIS_SELECTION.nodePopulation,
			STRUCTURAL_SCC_ANALYSIS_SELECTION.edgePopulation,
			STRUCTURAL_SCC_ANALYSIS_SELECTION.direction,
			...STRUCTURAL_SCC_ANALYSIS_NONCLAIMS,
			STRUCTURAL_SCC_REPORT_OPERATION_VERSION,
			STRUCTURAL_SCC_REPORT_REQUEST_SCHEMA_VERSION,
			STRUCTURAL_SCC_REPORT_RESULT_SCHEMA_VERSION,
			STRUCTURAL_SCC_REPORT_SCHEMA_VERSION,
			...STRUCTURAL_SCC_REPORT_NONCLAIMS
		])
			expect(structuralSccCapability!.explanation).toContain(exactBoundary);
		for (const boundary of [
			'independently validated TypeScript module-dependency graph',
			'preserving parallel edges and self-loops',
			'Structural closure is exact only for the selected validated graph',
			'implementation-local preliminary report facade',
			'not a registered JAN-CSAA-007 OperationResponse',
			'progress transport is excluded from report identity and evidence',
			'coding-agent command csaa:analyze:structural-scc',
			'dedicated structural SCC-only smoke command',
			'CONFIGURED_NOT_RUN by inventory generation'
		])
			expect(structuralSccCapability!.explanation).toContain(boundary);
		const structuralModuleReachabilityCapability = capabilities.get(
			'structural-module-reachability-analysis'
		);
		expect(structuralModuleReachabilityCapability).toMatchObject({
			provider: 'typescript+validated-module-dependency-graph-reachability',
			state: 'PARTIAL'
		});
		for (const expectedProvenance of [
			...STRUCTURAL_MODULE_REACHABILITY_REPORT_PROVENANCE,
			'capabilities#dependency-graph',
			'capabilities#symbol-table',
			'capabilities#typescript-ast',
			'packages/csaa/src/contracts/graph.ts',
			'packages/csaa/src/contracts/semantic.ts',
			'packages/csaa/src/contracts/structural-module-reachability-analysis.ts',
			'packages/csaa/src/graph/build-module-dependency-graph.ts',
			'packages/csaa/src/graph/build-structural-module-reachability-analysis.ts',
			'packages/csaa/src/graph/structural-module-reachability-analysis-canonical.ts',
			'packages/csaa/src/graph/validate-graph.ts',
			'packages/csaa/src/graph/validate-structural-module-reachability-analysis.ts',
			'packages/csaa/src/graph/build-structural-module-reachability-analysis.test.ts',
			'packages/csaa/src/graph/structural-module-reachability-analysis-coverage.test.ts',
			'packages/csaa/src/providers/typescript/extract-static-raw.ts',
			'packages/csaa/src/providers/typescript/extract-symbols.ts',
			'packages/csaa/src/semantic/repository-smoke.test.ts',
			'package.json#/scripts/csaa:semantic:smoke:structural-module-reachability',
			'package.json#/scripts/csaa:analyze:structural-module-reachability'
		])
			expect(structuralModuleReachabilityCapability!.provenance.includes(expectedProvenance)).toBe(
				true
			);
		for (const exactBoundary of [
			STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_METHOD,
			STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_CAPABILITY,
			STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_CAPABILITY_STATUS,
			STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_GRAPH_AUTHORITY,
			STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_AUTHORITY_TRANSFER,
			STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_GATE_EFFECT,
			STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_FULL_JAN_CSAA_007_CONFORMANCE,
			STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_FULL_JAN_CSAA_008_CONFORMANCE,
			STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION.nodePopulation,
			STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION.edgePopulation,
			STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION.parallelEdges,
			STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION.witnessPolicy,
			...STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_NONCLAIMS,
			STRUCTURAL_MODULE_REACHABILITY_REPORT_OPERATION_VERSION,
			STRUCTURAL_MODULE_REACHABILITY_REPORT_REQUEST_SCHEMA_VERSION,
			STRUCTURAL_MODULE_REACHABILITY_REPORT_RESULT_SCHEMA_VERSION,
			STRUCTURAL_MODULE_REACHABILITY_REPORT_SCHEMA_VERSION,
			...STRUCTURAL_MODULE_REACHABILITY_REPORT_NONCLAIMS
		])
			expect(structuralModuleReachabilityCapability!.explanation).toContain(exactBoundary);
		for (const boundary of [
			'The thirteenth bounded DWP-004 increment',
			'one independently validated TypeScript module-dependency graph and one explicit graph-node criterion',
			'complete-or-unavailable',
			'successful static traversal is NOT_TRUNCATED',
			'structural closure is exact only within that one validated graph and criterion',
			'upstream closure may remain OPEN',
			'Unvisited nodes have no irrelevance or non-impact meaning',
			'implementation-local preliminary coding-agent report facade',
			'one explicit bounded project set plus one exact project/logical-path criterion and one FORWARD or REVERSE direction',
			'runs the partial CAP-027 analysis',
			'maxResultBytes-bounded admitted partial',
			'bounded predecessor-forest witness evidence',
			'CURRENT_FOR_CAPTURED_SUBJECT is scoped to SELECTED_CAPTURED_SUBJECT_ONLY',
			'not the stable JAN-CSAA-007 query envelope',
			'does not complete DWP-005 or DWP-006',
			'bounded best-effort JSONL progress transport is excluded from report identity and evidence',
			'machine-facing coding-agent invocation bun run --silent csaa:analyze:structural-module-reachability',
			'package root publicly exports the analysis builder plus the report contract, runner, progress-event schema, and transport schema/limits/types',
			'JSONL progress writer and executable command adapter remain trust-bound implementation details and are not package-root exports',
			'dedicated structural module-reachability-only smoke command',
			'CONFIGURED_NOT_RUN by inventory generation'
		])
			expect(structuralModuleReachabilityCapability!.explanation).toContain(boundary);
		const staticModuleImpactCandidateCapability = capabilities.get(
			'static-module-impact-candidates'
		);
		expect(staticModuleImpactCandidateCapability).toMatchObject({
			provider: 'typescript+validated-reverse-module-impact-candidates',
			state: 'PARTIAL'
		});
		for (const expectedProvenance of [
			...STATIC_MODULE_IMPACT_CANDIDATE_REPORT_PROVENANCE,
			...STRUCTURAL_MODULE_REACHABILITY_REPORT_PROVENANCE,
			'capabilities#dependency-graph',
			'capabilities#structural-module-reachability-analysis',
			'capabilities#symbol-table',
			'capabilities#typescript-ast',
			'packages/csaa/src/contracts/graph.ts',
			'packages/csaa/src/contracts/semantic.ts',
			'packages/csaa/src/contracts/structural-module-reachability-analysis.ts',
			'packages/csaa/src/graph/build-module-dependency-graph.ts',
			'packages/csaa/src/graph/build-structural-module-reachability-analysis.ts',
			'packages/csaa/src/graph/structural-module-reachability-analysis-canonical.ts',
			'packages/csaa/src/graph/validate-graph.ts',
			'packages/csaa/src/graph/validate-structural-module-reachability-analysis.ts',
			'packages/csaa/src/providers/typescript/extract-static-raw.ts',
			'packages/csaa/src/providers/typescript/extract-symbols.ts',
			'package.json#/scripts/csaa:analyze:static-module-impact-candidates'
		])
			expect(staticModuleImpactCandidateCapability!.provenance.includes(expectedProvenance)).toBe(
				true
			);
		for (const exactBoundary of [
			STATIC_MODULE_IMPACT_CANDIDATE_CAPABILITY,
			STATIC_MODULE_IMPACT_CANDIDATE_CAPABILITY_STATUS,
			STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
			STATIC_MODULE_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION,
			STATIC_MODULE_IMPACT_CANDIDATE_METHOD,
			STATIC_MODULE_IMPACT_CANDIDATE_PROPAGATION.candidatePopulation,
			STATIC_MODULE_IMPACT_CANDIDATE_PROPAGATION.relationFamily,
			STATIC_MODULE_IMPACT_CANDIDATE_PROPAGATION.nativeEdgeOrientation,
			...STATIC_MODULE_IMPACT_CANDIDATE_PROPAGATION.relationKinds,
			...STATIC_MODULE_IMPACT_CANDIDATE_UNASSESSED_PROPAGATION_FAMILIES,
			...STATIC_MODULE_IMPACT_CANDIDATE_NEXT_EVIDENCE,
			STATIC_MODULE_IMPACT_CANDIDATE_FULL_CAP_031,
			STATIC_MODULE_IMPACT_CANDIDATE_ANALYSIS_AUTHORITY,
			STATIC_MODULE_IMPACT_CANDIDATE_AUTHORITY_TRANSFER,
			STATIC_MODULE_IMPACT_CANDIDATE_GATE_EFFECT,
			STATIC_MODULE_IMPACT_CANDIDATE_REPORT_SCHEMA_VERSION,
			STATIC_MODULE_IMPACT_CANDIDATE_REPORT_RESULT_SCHEMA_VERSION,
			STATIC_MODULE_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
			STATIC_MODULE_IMPACT_CANDIDATE_REPORT_SAFETY_CEILINGS.maxCandidateWitnessHops.toLocaleString(
				'en-US'
			),
			...STATIC_MODULE_IMPACT_CANDIDATE_REPORT_NONCLAIMS
		])
			expect(staticModuleImpactCandidateCapability!.explanation).toContain(exactBoundary);
		for (const boundary of [
			'A second preliminary implementation-local unregistered DWP-005 increment',
			'one current captured artifact, subject, semantic snapshot, semantic source, project, Program, graph node, and source graph',
			'Every importer is impact-epistemic POSSIBLE',
			'direct and transitive labels describe structural distance only',
			'Every positive candidate includes one complete canonical shortest seed-to-candidate reverse-traversal witness',
			'requires budgets.maxCandidateWitnessHops with an absolute safety ceiling of 16,384 cumulative duplicated witness hops',
			'before path allocation, preflights the smaller caller limit and a remaining-result allowance after the exact predecessor bytes, a 65,536-byte outer-envelope reservation, and a 4,096-byte per-hop resource reservation',
			'Unvisited nodes receive no impact or irrelevance state',
			'a zero-candidate result is not non-impact',
			'global impact closure remains OPEN',
			'caller-declared working-change identity is not independently validated',
			'no change content or cross-snapshot diff is analyzed',
			'not a ChangeSeedRecord, ChangeImpactResultRecord, registered JAN-CSAA-007 operation, DWP-005/DWP-006 completion, or G5/G6 gate evidence',
			'predecessor CAP-027 progress is reused unchanged and excluded from terminal identity',
			'final outer FrozenSubject currentness recheck follows report construction and result-size admission',
			'fails closed unless the exact captured predecessor subject remains CURRENT',
			'machine-facing coding-agent invocation bun run --silent csaa:analyze:static-module-impact-candidates',
			'package root exports the contract, runner, and exit-code helper',
			'CONFIGURED_NOT_RUN by inventory generation'
		])
			expect(staticModuleImpactCandidateCapability!.explanation).toContain(boundary);
		const workingSourceEditImpactCandidateCapability = capabilities.get(
			'working-source-edit-impact-candidates'
		);
		expect(workingSourceEditImpactCandidateCapability).toMatchObject({
			provider: 'git+typescript+validated-working-source-edit-impact-candidates',
			state: 'PARTIAL'
		});
		for (const expectedProvenance of [
			...WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_PROVENANCE,
			...STATIC_MODULE_IMPACT_CANDIDATE_REPORT_PROVENANCE,
			'capabilities#static-module-impact-candidates',
			'package.json#/scripts/csaa:analyze:working-source-edit-impact-candidates'
		])
			expect(
				workingSourceEditImpactCandidateCapability!.provenance.includes(expectedProvenance)
			).toBe(true);
		for (const exactBoundary of [
			WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_CAPABILITY,
			WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_CAPABILITY_STATUS,
			WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
			WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION,
			WORKING_SOURCE_EDIT_OBSERVATION_METHOD,
			WORKING_SOURCE_EDIT_OBSERVATION_SCHEMA_VERSION,
			WORKING_SOURCE_EDIT_TEXTUAL_CHANGE_METHOD,
			WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_METHOD,
			...WORKING_SOURCE_EDIT_OBSERVATION_EXCLUSIONS,
			...WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_NEXT_EVIDENCE,
			WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_FULL_CAP_031,
			WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_ANALYSIS_AUTHORITY,
			WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_AUTHORITY_TRANSFER,
			WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_GATE_EFFECT,
			WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_SCHEMA_VERSION,
			WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_RESULT_SCHEMA_VERSION,
			WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
			WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_SAFETY_CEILINGS.maxResultBytes.toLocaleString(
				'en-US'
			),
			...WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_NONCLAIMS
		])
			expect(workingSourceEditImpactCandidateCapability!.explanation).toContain(exactBoundary);
		for (const boundary of [
			'A third preliminary implementation-local unregistered DWP-005 increment',
			'exact stage-zero index blob and regular-file mode to match that HEAD tree entry',
			'does not execute git status or porcelain',
			'binds the current bytes by path, byte count, and SHA-256 to the exact FrozenSubject artifact',
			'Every predecessor importer candidate remains POSSIBLE',
			'global impact closure remains OPEN',
			'final exact Git reobservation after composition and result-size admission',
			'not a repository-wide WorkingChangeSetRecord, ChangeSeedRecord, ChangeImpactResultRecord, or revision comparison',
			'machine-facing coding-agent invocation bun run --silent csaa:analyze:working-source-edit-impact-candidates',
			'Git observer, executable adapter, private exact-subject predecessor handoff, and reused predecessor JSONL writer remain trust-bound implementation details',
			'CONFIGURED_NOT_RUN by inventory generation'
		])
			expect(workingSourceEditImpactCandidateCapability!.explanation).toContain(boundary);
		const logicalGraphCompositionCapability = capabilities.get('logical-graph-composition');
		expect(logicalGraphCompositionCapability).toMatchObject({
			provider: 'typescript+validated-module-and-call-graph-composition',
			state: 'PARTIAL'
		});
		for (const expectedProvenance of [
			'capabilities#call-graph',
			'capabilities#dependency-graph',
			'capabilities#project-context-graph',
			'capabilities#symbol-table',
			'capabilities#typescript-ast',
			'capabilities#type-graph',
			'package.json#/scripts/csaa:semantic:smoke:logical-graph-composition',
			'package.json#/scripts/csaa:analyze:logical-graph-composition',
			...LOGICAL_GRAPH_COMPOSITION_REPORT_PROVENANCE,
			'packages/csaa/src/contracts/logical-graph-composition.ts',
			'packages/csaa/src/graph/build-logical-graph-composition.ts',
			'packages/csaa/src/graph/logical-graph-composition-canonical.ts',
			'packages/csaa/src/graph/validate-logical-graph-composition.ts',
			'packages/csaa/src/graph/build-logical-graph-composition.test.ts',
			'packages/csaa/src/graph/logical-graph-composition-coverage.test.ts',
			'packages/csaa/src/semantic/repository-smoke.test.ts',
			'packages/csaa/src/contracts/graph.ts',
			'packages/csaa/src/graph/build-module-dependency-graph.ts',
			'packages/csaa/src/graph/ids.ts',
			'packages/csaa/src/graph/module-dependency-content.ts',
			'packages/csaa/src/graph/module-dependency-input.ts',
			'packages/csaa/src/graph/validate-graph.ts',
			'packages/csaa/src/contracts/call-graph.ts',
			'packages/csaa/src/graph/build-call-graph.ts',
			'packages/csaa/src/graph/call-graph-content.ts',
			'packages/csaa/src/graph/call-graph-ids.ts',
			'packages/csaa/src/graph/call-graph-input.ts',
			'packages/csaa/src/graph/validate-call-graph.ts'
		])
			expect(logicalGraphCompositionCapability!.provenance.includes(expectedProvenance)).toBe(true);
		expect(new Set(logicalGraphCompositionCapability!.provenance).size).toBe(
			logicalGraphCompositionCapability!.provenance.length
		);
		expect(logicalGraphCompositionCapability!.provenance).toEqual(
			[...logicalGraphCompositionCapability!.provenance].sort()
		);
		for (const exactBoundary of [
			LOGICAL_GRAPH_COMPOSITION_METHOD,
			LOGICAL_GRAPH_COMPOSITION_CAPABILITY,
			LOGICAL_GRAPH_COMPOSITION_CAPABILITY_STATUS,
			LOGICAL_GRAPH_COMPOSITION_GRAPH_AUTHORITY,
			LOGICAL_GRAPH_COMPOSITION_AUTHORITY_TRANSFER,
			LOGICAL_GRAPH_COMPOSITION_GATE_EFFECT,
			LOGICAL_GRAPH_COMPOSITION_FRESHNESS,
			LOGICAL_GRAPH_COMPOSITION_CURRENTNESS,
			LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_009_CONFORMANCE,
			LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_007_CONFORMANCE,
			LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_008_CONFORMANCE,
			LOGICAL_GRAPH_COMPOSITION_REPORT_OPERATION_VERSION,
			LOGICAL_GRAPH_COMPOSITION_REPORT_REQUEST_SCHEMA_VERSION,
			LOGICAL_GRAPH_COMPOSITION_REPORT_SCHEMA_VERSION,
			LOGICAL_GRAPH_COMPOSITION_REPORT_RESULT_SCHEMA_VERSION,
			LOGICAL_GRAPH_COMPOSITION_REPORT_AUTHORITY,
			LOGICAL_GRAPH_COMPOSITION_REPORT_AUTHORITY_TRANSFER,
			LOGICAL_GRAPH_COMPOSITION_REPORT_GATE_EFFECT,
			LOGICAL_GRAPH_COMPOSITION_REPORT_FULL_CAPABILITY,
			JSON.stringify(LOGICAL_GRAPH_COMPOSITION_REPORT_SELECTION),
			LOGICAL_GRAPH_COMPOSITION_SELECTION.moduleNodePopulation,
			LOGICAL_GRAPH_COMPOSITION_SELECTION.callNodePopulation,
			LOGICAL_GRAPH_COMPOSITION_SELECTION.joinKey,
			LOGICAL_GRAPH_COMPOSITION_SELECTION.crossLinkRelation,
			LOGICAL_GRAPH_COMPOSITION_SELECTION.compositionMode,
			LOGICAL_GRAPH_COMPOSITION_SELECTION.conflictTreatment,
			...LOGICAL_GRAPH_COMPOSITION_SELECTION.consistencyFields,
			...LOGICAL_GRAPH_COMPOSITION_SELECTION.layerOrder,
			...LOGICAL_GRAPH_COMPOSITION_NONCLAIMS,
			...LOGICAL_GRAPH_COMPOSITION_REPORT_NONCLAIMS
		])
			expect(logicalGraphCompositionCapability!.explanation).toContain(exactBoundary);
		for (const boundary of [
			'The fourteenth bounded DWP-004 increment',
			'one independently validated TypeScript module-dependency graph and one independently validated TypeScript call graph',
			'exact reference-only semanticSourceId join',
			'without copying predecessor nodes or edges',
			'total mapping with explicit empty unmatched and conflict populations',
			'Source-layer graph identities, semantic-snapshot identities, coverage, health, epistemic state, closure, and limitations are preserved without promotion',
			'complete only for the declared mapping',
			'not for a universal or materialized code property graph',
			'implementation-local preliminary coding-agent report facade',
			'one exact same-subject project-context, module-dependency, call, and two-layer reference-only composition evidence set',
			'remains preliminary and unregistered',
			'preserves PARTIAL/OPEN status and every predecessor limitation',
			'final currentness check only for the selected captured subject',
			'does not claim query, slice, impact, finding, remediation, dead-code, safe-removal, DWP-004/DWP-005/DWP-006 completion, G4/G5/G6 passage, or a registered JAN-CSAA-007 operation envelope',
			'bounded best-effort JSONL progress transport is excluded from report identity and evidence',
			'machine-facing coding-agent invocation bun run --silent csaa:analyze:logical-graph-composition',
			'package root exports the report contract, runner, progress-event schema, and transport schema/limits/types',
			'parsed-request command adapter and JSONL progress writer remain trust-bound implementation details and are not package-root exports',
			'dedicated FULL-profile logical-graph-composition-only smoke command',
			'CONFIGURED_NOT_RUN by inventory generation'
		])
			expect(logicalGraphCompositionCapability!.explanation).toContain(boundary);
		const projectContextGraphCapability = capabilities.get('project-context-graph');
		expect(projectContextGraphCapability).toMatchObject({
			provider: 'typescript+frozen-project-context-projection',
			state: 'PARTIAL'
		});
		for (const expectedProvenance of [
			...PROJECT_CONTEXT_GRAPH_PROVENANCE,
			...PROJECT_CONTEXT_REPORT_PROVENANCE,
			'capabilities#symbol-table',
			'capabilities#typescript-ast',
			'package.json#/scripts/csaa:semantic:smoke:project-context-graph',
			'package.json#/scripts/csaa:analyze:project-context'
		])
			expect(projectContextGraphCapability!.provenance.includes(expectedProvenance)).toBe(true);
		expect(new Set(projectContextGraphCapability!.provenance).size).toBe(
			projectContextGraphCapability!.provenance.length
		);
		expect(projectContextGraphCapability!.provenance).toEqual(
			[...projectContextGraphCapability!.provenance].sort()
		);
		for (const exactBoundary of [
			PROJECT_CONTEXT_GRAPH_METHOD,
			PROJECT_CONTEXT_GRAPH_CAPABILITY,
			PROJECT_CONTEXT_GRAPH_CAPABILITY_STATUS,
			PROJECT_CONTEXT_GRAPH_GRAPH_AUTHORITY,
			PROJECT_CONTEXT_GRAPH_AUTHORITY_TRANSFER,
			PROJECT_CONTEXT_GRAPH_GATE_EFFECT,
			PROJECT_CONTEXT_GRAPH_FRESHNESS,
			PROJECT_CONTEXT_GRAPH_CURRENTNESS,
			PROJECT_CONTEXT_GRAPH_FULL_JAN_CSAA_010_CONFORMANCE,
			PROJECT_CONTEXT_GRAPH_SELECTION.projectPopulation,
			PROJECT_CONTEXT_GRAPH_SELECTION.programPopulation,
			PROJECT_CONTEXT_GRAPH_SELECTION.sourcePopulation,
			PROJECT_CONTEXT_GRAPH_SELECTION.projectReferencePopulation,
			PROJECT_CONTEXT_GRAPH_SELECTION.referenceResolutionBasis,
			PROJECT_CONTEXT_GRAPH_SELECTION.variantPolicy,
			PROJECT_CONTEXT_GRAPH_SELECTION.effectiveConfigurationPolicy,
			...PROJECT_CONTEXT_GRAPH_SELECTION.membershipRelations,
			...PROJECT_CONTEXT_GRAPH_NONCLAIMS,
			PROJECT_CONTEXT_REPORT_OPERATION_VERSION,
			PROJECT_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION,
			PROJECT_CONTEXT_REPORT_RESULT_SCHEMA_VERSION,
			PROJECT_CONTEXT_REPORT_SCHEMA_VERSION,
			...PROJECT_CONTEXT_REPORT_NONCLAIMS
		])
			expect(projectContextGraphCapability!.explanation).toContain(exactBoundary);
		for (const boundary of [
			'The fifteenth bounded DWP-004 increment',
			'one exact FrozenSubject and one independently validated static semantic snapshot',
			'every declared project reference resolves within the selected project population',
			'outside-selected and unresolved populations are explicitly empty',
			'no additional build, test, browser, SSR, generated, or consumer variant is inferred',
			'implementation-local preliminary report facade',
			'one explicit bounded project set',
			'maxResultBytes-bounded admitted partial',
			'small refusal envelopes remain emit-able',
			'facade-level CURRENT_FOR_CAPTURED_SUBJECT observation is scoped to SELECTED_CAPTURED_SUBJECT_ONLY',
			'does not alter or promote the embedded graph',
			'not a registered JAN-CSAA-007 OperationResponse',
			'bounded best-effort JSONL progress transport is excluded from report identity and evidence',
			'coding-agent command csaa:analyze:project-context',
			'dedicated STRUCTURAL-profile project-context-only smoke command',
			'CONFIGURED_NOT_RUN by inventory generation'
		])
			expect(projectContextGraphCapability!.explanation).toContain(boundary);
		const conditionalExportResolutionCapability = capabilities.get('conditional-export-resolution');
		expect(conditionalExportResolutionCapability).toMatchObject({
			provider: 'typescript+frozen-workspace-conditional-export-resolution',
			state: 'PARTIAL'
		});
		for (const expectedProvenance of [
			...CONDITIONAL_EXPORT_RESOLUTION_PROVENANCE,
			'capabilities#project-context-graph',
			'package.json#/scripts/csaa:semantic:smoke:conditional-export-resolution'
		])
			expect(conditionalExportResolutionCapability!.provenance).toContain(expectedProvenance);
		expect(new Set(conditionalExportResolutionCapability!.provenance).size).toBe(
			conditionalExportResolutionCapability!.provenance.length
		);
		expect(conditionalExportResolutionCapability!.provenance).toEqual(
			[...conditionalExportResolutionCapability!.provenance].sort()
		);
		for (const exactBoundary of [
			CONDITIONAL_EXPORT_RESOLUTION_METHOD,
			CONDITIONAL_EXPORT_RESOLUTION_CAPABILITY,
			CONDITIONAL_EXPORT_RESOLUTION_CAPABILITY_STATUS,
			CONDITIONAL_EXPORT_RESOLUTION_AUTHORITY,
			CONDITIONAL_EXPORT_RESOLUTION_AUTHORITY_TRANSFER,
			CONDITIONAL_EXPORT_RESOLUTION_GATE_EFFECT,
			CONDITIONAL_EXPORT_RESOLUTION_FRESHNESS,
			CONDITIONAL_EXPORT_RESOLUTION_CURRENTNESS,
			CONDITIONAL_EXPORT_RESOLUTION_FULL_JAN_CSAA_012_CONFORMANCE,
			JSON.stringify(CONDITIONAL_EXPORT_RESOLUTION_SELECTION),
			...CONDITIONAL_EXPORT_RESOLUTION_NONCLAIMS
		])
			expect(conditionalExportResolutionCapability!.explanation).toContain(exactBoundary);
		for (const boundary of [
			'The sixteenth bounded DWP-004 increment',
			'PARTIAL JAN-CSAA-CAP-012 slice',
			'one explicit consumer source and Program',
			'one exact selected FrozenSubject workspace package manifest',
			'preserves raw manifest declaration order and UTF-16 source spans',
			'binds a raw exports-value digest',
			'one context-specific decision',
			'explicit frontiers and never become a false resolution miss',
			'complete-or-unavailable under caller budgets and is never truncated',
			'dedicated STRUCTURAL-profile conditional-export-resolution-only smoke command',
			'CONFIGURED_NOT_RUN by inventory generation'
		])
			expect(conditionalExportResolutionCapability!.explanation).toContain(boundary);
		const moduleResolutionTraceCapability = capabilities.get('module-resolution-trace');
		expect(moduleResolutionTraceCapability).toMatchObject({
			provider: 'typescript+verified-project-capture-module-resolution-trace',
			state: 'PARTIAL'
		});
		for (const expectedProvenance of [
			...MODULE_RESOLUTION_TRACE_PROVENANCE,
			...MODULE_RESOLUTION_TRACE_REPORT_PROVENANCE,
			'capabilities#conditional-export-resolution',
			'capabilities#project-context-graph',
			'capabilities#symbol-table',
			'capabilities#typescript-ast',
			'package.json#/scripts/csaa:semantic:smoke:module-resolution-trace',
			'package.json#/scripts/csaa:analyze:module-resolution-trace'
		])
			expect(moduleResolutionTraceCapability!.provenance).toContain(expectedProvenance);
		expect(new Set(moduleResolutionTraceCapability!.provenance).size).toBe(
			moduleResolutionTraceCapability!.provenance.length
		);
		expect(moduleResolutionTraceCapability!.provenance).toEqual(
			[...moduleResolutionTraceCapability!.provenance].sort()
		);
		for (const exactBoundary of [
			MODULE_RESOLUTION_TRACE_METHOD,
			MODULE_RESOLUTION_TRACE_CAPABILITY,
			MODULE_RESOLUTION_TRACE_CAPABILITY_STATUS,
			MODULE_RESOLUTION_TRACE_AUTHORITY,
			MODULE_RESOLUTION_TRACE_AUTHORITY_TRANSFER,
			MODULE_RESOLUTION_TRACE_GATE_EFFECT,
			MODULE_RESOLUTION_TRACE_FRESHNESS,
			MODULE_RESOLUTION_TRACE_CURRENTNESS,
			MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_011_CONFORMANCE,
			MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_007_CONFORMANCE,
			MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_008_CONFORMANCE,
			JSON.stringify(MODULE_RESOLUTION_TRACE_SELECTION),
			...MODULE_RESOLUTION_TRACE_NONCLAIMS,
			MODULE_RESOLUTION_TRACE_REPORT_OPERATION_VERSION,
			MODULE_RESOLUTION_TRACE_REPORT_REQUEST_SCHEMA_VERSION,
			MODULE_RESOLUTION_TRACE_REPORT_RESULT_SCHEMA_VERSION,
			MODULE_RESOLUTION_TRACE_REPORT_SCHEMA_VERSION,
			JSON.stringify(MODULE_RESOLUTION_TRACE_REPORT_SELECTION),
			...MODULE_RESOLUTION_TRACE_REPORT_NONCLAIMS
		])
			expect(moduleResolutionTraceCapability!.explanation).toContain(exactBoundary);
		for (const boundary of [
			'The seventeenth bounded DWP-004 increment',
			'one exact literal bare workspace-package root value, non-type-only IMPORT occurrence',
			'newly constructed conditional-export predecessor with explicit types condition, NODE platform, and IMPORT mode',
			'fixed report selection',
			'packages/rph-application/src/command-bus.ts importing @janumipwb/rph-contracts',
			'packages/rph-contracts/dist/index.d.ts',
			'exact verified project-scoped in-memory capture',
			'derives candidates bijectively only from MODULE_RESOLUTION-stage FILE_EXISTS attempts',
			'complete-or-unavailable under caller budgets, PARTIAL, and NOT_TRUNCATED',
			'serialization, structured cloning, persistence, and deserialized replay do not carry it',
			'implementation-local preliminary coding-agent facade',
			'one explicit bounded project set plus exact project/source/literal coordinate and bare workspace package',
			'constructs the validated CAP-010, CAP-012, and CAP-011 chain in one process',
			'maxResultBytes-bounded admitted partial',
			'full embedded predecessor evidence',
			'small refusal envelopes remain emit-able',
			'CURRENT_FOR_CAPTURED_SUBJECT is explicitly limited to SELECTED_CAPTURED_SUBJECT_ONLY',
			'compiler capture and the CONTEXT_ONLY target remain NOT_ASSESSED',
			'embedded freshness/currentness fields remain unchanged',
			'embedded trace retains its full predecessor nonclaim set, including CURRENTNESS_OR_FRESHNESS',
			'broad trace nonclaim is not copied into the facade nonclaim set',
			'not a registered JAN-CSAA-007 OperationResponse',
			'does not complete DWP-004, DWP-005, or DWP-006',
			'bounded best-effort JSONL progress transport is excluded from report identity and evidence',
			'machine-facing coding-agent invocation bun run --silent csaa:analyze:module-resolution-trace',
			'package root publicly exports buildModuleResolutionTrace and validateModuleResolutionTrace plus the report contract, runner, progress-event schema, and transport schema/limits/types',
			'JSONL progress writer, parsed-request executable adapter, attachVerifiedCompilerCaptureToStaticSemanticSnapshot, getStaticSemanticSnapshotCompilerProjectInputLookup, validateConstructedModuleResolutionTrace, and the mutable @internal moduleResolutionTraceTypeScriptPublicApi test seam remain trust-bound implementation details and are not package-root exports',
			'dedicated STRUCTURAL-profile module-resolution-trace-only smoke command',
			'CONFIGURED_NOT_RUN by inventory generation'
		])
			expect(moduleResolutionTraceCapability!.explanation).toContain(boundary);
		const declarationContextAnalysisCapability = capabilities.get('declaration-context-analysis');
		expect(declarationContextAnalysisCapability).toMatchObject({
			provider: 'typescript+verified-project-capture-declaration-context-analysis',
			state: 'PARTIAL'
		});
		for (const expectedProvenance of [
			...DECLARATION_CONTEXT_ANALYSIS_PROVENANCE,
			...DECLARATION_CONTEXT_REPORT_PROVENANCE,
			'capabilities#conditional-export-resolution',
			'capabilities#module-resolution-trace',
			'capabilities#project-context-graph',
			'capabilities#typescript-ast',
			'package.json#/scripts/csaa:semantic:smoke:declaration-context-analysis',
			'package.json#/scripts/csaa:analyze:declaration-context'
		])
			expect(declarationContextAnalysisCapability!.provenance).toContain(expectedProvenance);
		expect(new Set(declarationContextAnalysisCapability!.provenance).size).toBe(
			declarationContextAnalysisCapability!.provenance.length
		);
		expect(declarationContextAnalysisCapability!.provenance).toEqual(
			[...declarationContextAnalysisCapability!.provenance].sort()
		);
		for (const exactBoundary of [
			DECLARATION_CONTEXT_ANALYSIS_METHOD,
			DECLARATION_CONTEXT_ANALYSIS_CAPABILITY,
			DECLARATION_CONTEXT_ANALYSIS_CAPABILITY_STATUS,
			DECLARATION_CONTEXT_ANALYSIS_AUTHORITY,
			DECLARATION_CONTEXT_ANALYSIS_AUTHORITY_TRANSFER,
			DECLARATION_CONTEXT_ANALYSIS_GATE_EFFECT,
			DECLARATION_CONTEXT_ANALYSIS_FRESHNESS,
			DECLARATION_CONTEXT_ANALYSIS_CURRENTNESS,
			DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_013_CONFORMANCE,
			DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_007_CONFORMANCE,
			DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_008_CONFORMANCE,
			JSON.stringify(DECLARATION_CONTEXT_ANALYSIS_SELECTION),
			...DECLARATION_CONTEXT_ANALYSIS_NONCLAIMS,
			DECLARATION_CONTEXT_REPORT_OPERATION_VERSION,
			DECLARATION_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION,
			DECLARATION_CONTEXT_REPORT_RESULT_SCHEMA_VERSION,
			DECLARATION_CONTEXT_REPORT_SCHEMA_VERSION,
			JSON.stringify(DECLARATION_CONTEXT_REPORT_SELECTION),
			...DECLARATION_CONTEXT_REPORT_NONCLAIMS
		])
			expect(declarationContextAnalysisCapability!.explanation).toContain(exactBoundary);
		for (const boundary of [
			'The bounded DWP-003 semantic-completion increment',
			'one exact package-root export name',
			'JAN-CSAA-CAP-001',
			'JAN-CSAA-CAP-010',
			'JAN-CSAA-CAP-011',
			'JAN-CSAA-CAP-012',
			'CAP-002 declaration and symbol identities are explicitly forbidden inputs',
			'accepts only a zero-hop direct root export or one same-root local-only ExportSpecifier without a module specifier',
			'exactly one selected export binding, one terminal checker symbol',
			'complete same-root terminal declaration set',
			'Cross-file declarations or merges, reexports, multi-hop or indirect alias bindings',
			'augmentation and ambient-effect output populations are explicitly empty',
			'complete-or-unavailable under caller budgets, PARTIAL, and NOT_TRUNCATED',
			'elapsed wall-clock budget brackets synchronous predecessor-validator and public-TypeScript capability calls',
			'does not claim preemptive cancellation inside those separately bounded calls',
			'package root publicly exports buildDeclarationContextAnalysis and validateDeclarationContextAnalysis',
			'immutable per-call @internal validateDeclarationContextAnalysisWithProviderForTesting provider-fault injection entry',
			'immutable @internal compareDeclarationContextAnalysisCanonicalValuesForTesting comparator probe',
			'createPrevalidatedVerifiedCompilerProjectInputHost',
			'callback-scoped withAttributedQueryForVerifiedHost borrowed-input path',
			'mutable @internal declarationContextAnalysisCompilerProgramCapability and declarationContextAnalysisTypeScriptPublicApi producer test seams',
			'progress-aware canonicalSemanticJsonWithProgress, canonicalSemanticJsonWitnessWithProgress, canonicalSemanticJsonPrefixedSha256, and compareCanonicalSemanticJsonStrings helpers',
			'callback-free one-argument canonicalSemanticJson and canonicalSemanticJsonWitness APIs remain package-root public and byte-compatible',
			'remain trust-bound implementation details and are not package-root exports',
			'implementation-local preliminary coding-agent report facade',
			'one explicit bounded project set plus one exact project/source/literal importer coordinate, one bare workspace package, and one exact package-root export name',
			'reuses the validated CAP-010/CAP-012/CAP-011 captured predecessor chain',
			'constructs one partial CAP-013 declaration context analysis',
			'maxResultBytes-bounded admitted partial',
			'full embedded project-context, conditional-export, module-resolution-trace, and declaration-context evidence',
			'CURRENT_FOR_CAPTURED_SUBJECT is scoped to SELECTED_CAPTURED_SUBJECT_ONLY',
			'compiler capture and the CONTEXT_ONLY declaration target remain NOT_ASSESSED',
			'preserves its predecessor nonclaims as nested evidence',
			'does not complete DWP-003, DWP-004, DWP-005, or DWP-006',
			'adds no authority',
			'bounded best-effort JSONL progress transport is excluded from report identity and evidence',
			'machine-facing coding-agent invocation bun run --silent csaa:analyze:declaration-context',
			'package root additionally exports the report contract, runner, progress-event schema, and transport schema/limits/types',
			'parsed-request command adapter, JSONL progress writer, internal inherited-request admission seam admitModuleResolutionTraceReportRequest, and internal predecessor capture seam captureModuleResolutionTraceReportPipeline remain trust-bound implementation details and are not package-root exports',
			'dedicated STRUCTURAL-profile declaration-context-analysis-only smoke command',
			'CONFIGURED_NOT_RUN by inventory generation'
		])
			expect(declarationContextAnalysisCapability!.explanation).toContain(boundary);
		const sourceOriginCorrelationCapability = capabilities.get('source-origin-correlation');
		expect(sourceOriginCorrelationCapability).toMatchObject({
			provider: 'typescript+verified-project-capture-source-origin-correlation',
			state: 'PARTIAL'
		});
		for (const expectedProvenance of [
			...SOURCE_ORIGIN_CORRELATION_PROVENANCE,
			'capabilities#typescript-ast',
			'package.json#/scripts/csaa:semantic:smoke:source-origin-correlation'
		])
			expect(sourceOriginCorrelationCapability!.provenance).toContain(expectedProvenance);
		expect(sourceOriginCorrelationCapability!.provenance).not.toContain(
			'capabilities#declaration-context-analysis'
		);
		expect(new Set(sourceOriginCorrelationCapability!.provenance).size).toBe(
			sourceOriginCorrelationCapability!.provenance.length
		);
		expect(sourceOriginCorrelationCapability!.provenance).toEqual(
			[...sourceOriginCorrelationCapability!.provenance].sort()
		);
		for (const exactBoundary of [
			SOURCE_ORIGIN_CORRELATION_METHOD,
			SOURCE_ORIGIN_CORRELATION_CAPABILITY,
			SOURCE_ORIGIN_CORRELATION_CAPABILITY_STATUS,
			SOURCE_ORIGIN_CORRELATION_AUTHORITY,
			SOURCE_ORIGIN_CORRELATION_AUTHORITY_TRANSFER,
			SOURCE_ORIGIN_CORRELATION_GATE_EFFECT,
			SOURCE_ORIGIN_CORRELATION_FRESHNESS,
			SOURCE_ORIGIN_CORRELATION_CURRENTNESS,
			SOURCE_ORIGIN_CORRELATION_FULL_JAN_CSAA_014_CONFORMANCE,
			SOURCE_ORIGIN_CORRELATION_FULL_JAN_CSAA_007_CONFORMANCE,
			SOURCE_ORIGIN_CORRELATION_FULL_JAN_CSAA_008_CONFORMANCE,
			JSON.stringify(SOURCE_ORIGIN_CORRELATION_SELECTION),
			...SOURCE_ORIGIN_CORRELATION_NONCLAIMS
		])
			expect(sourceOriginCorrelationCapability!.explanation).toContain(exactBoundary);
		for (const boundary of [
			'A second bounded DWP-003 semantic-completion increment',
			'self-contained request over one exact FrozenSubject and its exact StaticSemanticSnapshot',
			'has no capability predecessor and does not consume or depend on JAN-CSAA-CAP-013',
			'exactly one selected authored root source',
			'strictly decodes the complete flat external source-map v3 mappings population',
			'exact unique zero-width generated/authored location pairs and bidirectional correlations',
			'operation unavailable rather than producing a truncated or partially mapped result',
			'caller-supplied ignored local build-artifact captures that are absent from FrozenSubject',
			'not checked-in build outputs, FrozenSubject evidence, freshness evidence, or currentness evidence',
			'no declaration, source, build, finding, gate, or remediation authority is conferred',
			'complete for only the exact request selection, NOT_TRUNCATED',
			'package root publicly exports buildSourceOriginCorrelation and validateSourceOriginCorrelation',
			'dedicated STRUCTURAL-profile source-origin-correlation-only smoke command',
			'CONFIGURED_NOT_RUN by inventory generation'
		])
			expect(sourceOriginCorrelationCapability!.explanation).toContain(boundary);
		const typescriptAstCapability = capabilities.get('typescript-ast');
		expect(typescriptAstCapability).toBeDefined();
		expect(typescriptAstCapability!.provider).toBe('typescript');
		expect(typescriptAstCapability!.state).toBe('IMPLEMENTED');
		expect(
			typescriptAstCapability!.provenance.includes(
				'packages/csaa/src/semantic/monotonic-operation-clock.ts'
			)
		).toBe(true);
		expect(typescriptAstCapability!.explanation).toContain(
			'operation-wide duration budget is enforced from a wall-anchored monotonic elapsed-time clock'
		);
		expect(typescriptAstCapability!.explanation).toContain(
			'not a benchmark, product ceiling, expected duration, or SLO'
		);
		expect(capabilities.get('symbol-table')).toMatchObject({
			explanation:
				'The current DWP-003 provider implements Program-scoped TS_SYMBOL declarations, symbols, aliases, references, module resolutions, and module exports with normalized provenance and validation. Cross-Program symbol identity and binding reconciliation is not implemented for multi-project snapshots.',
			provider: 'typescript',
			provenance: [
				'packages/csaa/src/providers/typescript/extract-symbols.ts',
				'packages/csaa/src/semantic/raw-semantic-model.ts',
				'packages/csaa/src/semantic/normalize-semantic-snapshot.ts',
				'packages/csaa/src/semantic/validate-snapshot.ts'
			],
			state: 'PARTIAL'
		});
		expect(capabilities.get('type-graph')).toMatchObject({
			explanation: expect.stringContaining(
				'Program-local TS_TYPE records for types, type parameters, call and construct signatures'
			),
			provider: 'typescript',
			provenance: expect.arrayContaining([
				'packages/csaa/src/providers/typescript/extract-types.ts',
				'packages/csaa/src/semantic/normalize-semantic-snapshot.ts',
				'packages/csaa/src/semantic/validate-snapshot.ts'
			]),
			state: 'PARTIAL'
		});
		const dependencyGraphCapability = capabilities.get('dependency-graph');
		expect(dependencyGraphCapability).toBeDefined();
		expect(dependencyGraphCapability).toMatchObject({
			explanation: expect.stringContaining(
				'project every compiler-observed module occurrence into a validated TypeScript module-dependency graph'
			),
			provider: 'typescript',
			provenance: expect.arrayContaining([
				'packages/csaa/src/contracts/dependency-cruiser.ts',
				'packages/csaa/src/contracts/graph.ts',
				'packages/csaa/src/graph/build-module-dependency-graph.ts',
				'packages/csaa/src/graph/compare-dependency-providers.ts',
				'packages/csaa/src/providers/dependency-cruiser/normalize-output.ts',
				'packages/csaa/src/providers/dependency-cruiser/schema/cruise-result-16.10.4.schema.json',
				'packages/csaa/src/providers/dependency-cruiser/validate-raw-wire-schema.ts',
				'packages/csaa/src/graph/validate-graph.ts',
				...MODULE_DEPENDENCY_REPORT_PROVENANCE,
				'package.json#/scripts/csaa:analyze:module-dependency'
			]),
			state: 'PARTIAL'
		});
		const dependencyGraphExplanation = dependencyGraphCapability!.explanation;
		expect(dependencyGraphExplanation).toContain(MODULE_DEPENDENCY_REPORT_OPERATION_VERSION);
		expect(dependencyGraphExplanation).toContain(MODULE_DEPENDENCY_REPORT_REQUEST_SCHEMA_VERSION);
		expect(dependencyGraphExplanation).toContain(MODULE_DEPENDENCY_REPORT_RESULT_SCHEMA_VERSION);
		expect(dependencyGraphExplanation).toContain(MODULE_DEPENDENCY_REPORT_SCHEMA_VERSION);
		expect(dependencyGraphExplanation).toContain(
			JSON.stringify(MODULE_DEPENDENCY_REPORT_SELECTION)
		);
		expect(dependencyGraphExplanation).toContain(
			`analysis authority is ${MODULE_DEPENDENCY_REPORT_AUTHORITY}`
		);
		expect(dependencyGraphExplanation).toContain(
			`authority transfer is ${MODULE_DEPENDENCY_REPORT_AUTHORITY_TRANSFER}`
		);
		expect(dependencyGraphExplanation).toContain(
			`gate effect is ${MODULE_DEPENDENCY_REPORT_GATE_EFFECT}`
		);
		expect(dependencyGraphExplanation).toContain('successful graph evidence is never truncated');
		expect(dependencyGraphExplanation).toContain('embedded COMPLETE/CLOSED graph');
		expect(dependencyGraphExplanation).toContain('parsed-request command adapter');
		for (const nonclaim of MODULE_DEPENDENCY_REPORT_NONCLAIMS)
			expect(dependencyGraphExplanation).toContain(nonclaim);
		const callGraphCapability = capabilities.get('call-graph');
		expect(callGraphCapability).toBeDefined();
		const callGraphExplanation = callGraphCapability!.explanation;
		expect(callGraphCapability).toMatchObject({
			explanation: expect.stringContaining(
				'enumerates every retained TypeScript CALL, NEW, and TAGGED_TEMPLATE site'
			),
			provider: 'typescript',
			provenance: expect.arrayContaining([
				'packages/csaa/src/contracts/call-graph.ts',
				'packages/csaa/src/graph/build-call-graph.ts',
				'packages/csaa/src/graph/validate-call-graph.ts',
				...CALL_GRAPH_REPORT_PROVENANCE,
				'package.json#/scripts/csaa:analyze:call-graph'
			]),
			state: 'PARTIAL'
		});
		expect(callGraphExplanation).toContain(
			'exact structural/lexical ownership within the declared method'
		);
		expect(callGraphExplanation).toContain(
			'runtime caller and evaluation ownership remain coarsened'
		);
		expect(callGraphExplanation).toContain('not inferred from the structural ownership edge');
		expect(callGraphExplanation).toContain(CALL_GRAPH_REPORT_OPERATION_VERSION);
		expect(callGraphExplanation).toContain(CALL_GRAPH_REPORT_REQUEST_SCHEMA_VERSION);
		expect(callGraphExplanation).toContain(CALL_GRAPH_REPORT_RESULT_SCHEMA_VERSION);
		expect(callGraphExplanation).toContain(CALL_GRAPH_REPORT_SCHEMA_VERSION);
		expect(callGraphExplanation).toContain(JSON.stringify(CALL_GRAPH_REPORT_SELECTION));
		expect(callGraphExplanation).toContain(`analysis authority is ${CALL_GRAPH_REPORT_AUTHORITY}`);
		expect(callGraphExplanation).toContain(
			`authority transfer is ${CALL_GRAPH_REPORT_AUTHORITY_TRANSFER}`
		);
		expect(callGraphExplanation).toContain(`gate effect is ${CALL_GRAPH_REPORT_GATE_EFFECT}`);
		expect(callGraphExplanation).toContain('successful evidence is never truncated');
		expect(callGraphExplanation).toContain(
			'complete selected node, edge, and limitation populations'
		);
		expect(callGraphExplanation).toContain('parsed-request command adapter');
		for (const nonclaim of CALL_GRAPH_REPORT_NONCLAIMS)
			expect(callGraphExplanation).toContain(nonclaim);
		const stateMachineCapability = capabilities.get('state-machine-graph');
		expect(stateMachineCapability).toBeDefined();
		const stateMachineExplanation = stateMachineCapability!.explanation;
		expect(stateMachineCapability).toMatchObject({
			explanation: expect.stringContaining(
				'observes the exact frozen generated JPWB transition table without executing it'
			),
			provider: 'jpwb-generated-transition-table',
			provenance: expect.arrayContaining([
				'packages/csaa/src/contracts/state-machine-graph.ts',
				'packages/csaa/src/graph/build-state-machine-graph.ts',
				'packages/csaa/src/graph/validate-state-machine-graph.ts',
				...STATE_MACHINE_GRAPH_REPORT_PROVENANCE,
				'package.json#/scripts/csaa:analyze:state-machine-graph'
			]),
			state: 'PARTIAL'
		});
		expect(stateMachineExplanation).toContain(STATE_MACHINE_GRAPH_REPORT_OPERATION_VERSION);
		expect(stateMachineExplanation).toContain(STATE_MACHINE_GRAPH_REPORT_REQUEST_SCHEMA_VERSION);
		expect(stateMachineExplanation).toContain(STATE_MACHINE_GRAPH_REPORT_RESULT_SCHEMA_VERSION);
		expect(stateMachineExplanation).toContain(STATE_MACHINE_GRAPH_REPORT_SCHEMA_VERSION);
		expect(stateMachineExplanation).toContain(JSON.stringify(STATE_MACHINE_GRAPH_REPORT_SELECTION));
		expect(stateMachineExplanation).toContain(
			`analysis authority is ${STATE_MACHINE_GRAPH_REPORT_AUTHORITY}`
		);
		expect(stateMachineExplanation).toContain(
			`authority transfer is ${STATE_MACHINE_GRAPH_REPORT_AUTHORITY_TRANSFER}`
		);
		expect(stateMachineExplanation).toContain(
			`gate effect is ${STATE_MACHINE_GRAPH_REPORT_GATE_EFFECT}`
		);
		expect(stateMachineExplanation).toContain(
			`existing specialized verifier authority remains ${STATE_MACHINE_GRAPH_VERIFIER_AUTHORITY} and is neither held nor transferred by the facade`
		);
		expect(stateMachineExplanation).toContain('successful evidence is never truncated');
		expect(stateMachineExplanation).toContain('parsed-request command adapter');
		for (const nonclaim of STATE_MACHINE_GRAPH_REPORT_NONCLAIMS)
			expect(stateMachineExplanation).toContain(nonclaim);
		expect(arrowCapability!.provider).toBe(ARROW_COMMAND_CENSUS_ADAPTER_ID);
		for (const expectedProvenance of [
			'packages/csaa/src/contracts/arrow-command-census.ts',
			'packages/csaa/src/providers/jpwb-arrow-command-census/observe-arrow-command-census.ts',
			'packages/csaa/src/providers/jpwb-arrow-command-census/validate-arrow-command-census.ts',
			'verif/arrow-command-census.ts',
			'verif/arrow-command-census.baseline.json',
			...ARROW_COMMAND_CENSUS_REPORT_PROVENANCE,
			'package.json#/scripts/csaa:analyze:arrow-command-census'
		]) {
			expect(arrowCapability!.provenance.includes(expectedProvenance)).toBe(true);
		}
		expect(arrowCapability!.explanation).toContain(
			`exact adapter ${ARROW_COMMAND_CENSUS_ADAPTER_ID} and method ${ARROW_COMMAND_CENSUS_METHOD}`
		);
		expect(arrowCapability!.explanation).toContain(
			`${ARROW_COMMAND_CENSUS_VERIFIER_AUTHORITY} verifier authority`
		);
		expect(arrowCapability!.explanation).toContain(
			'process isolation rather than a hostile-code security sandbox'
		);
		expect(arrowCapability!.explanation).toContain(ARROW_COMMAND_CENSUS_REPORT_OPERATION_VERSION);
		expect(arrowCapability!.explanation).toContain(
			ARROW_COMMAND_CENSUS_REPORT_REQUEST_SCHEMA_VERSION
		);
		expect(arrowCapability!.explanation).toContain(
			ARROW_COMMAND_CENSUS_REPORT_RESULT_SCHEMA_VERSION
		);
		expect(arrowCapability!.explanation).toContain(ARROW_COMMAND_CENSUS_REPORT_SCHEMA_VERSION);
		expect(arrowCapability!.explanation).toContain(
			JSON.stringify(ARROW_COMMAND_CENSUS_REPORT_SELECTION)
		);
		expect(arrowCapability!.explanation).toContain(ARROW_COMMAND_CENSUS_REPORT_EXECUTION_SELECTION);
		expect(arrowCapability!.explanation).toContain(
			`capability status is ${ARROW_COMMAND_CENSUS_REPORT_CAPABILITY_STATUS}`
		);
		expect(arrowCapability!.explanation).toContain(
			`registry status is ${ARROW_COMMAND_CENSUS_REPORT_REGISTRY_STATUS}`
		);
		expect(arrowCapability!.explanation).toContain(`scope is ${ARROW_COMMAND_CENSUS_REPORT_SCOPE}`);
		expect(arrowCapability!.explanation).toContain(
			`analysis authority is ${ARROW_COMMAND_CENSUS_REPORT_AUTHORITY}`
		);
		expect(arrowCapability!.explanation).toContain(
			`authority transfer is ${ARROW_COMMAND_CENSUS_REPORT_AUTHORITY_TRANSFER}`
		);
		expect(arrowCapability!.explanation).toContain(
			`gate effect is ${ARROW_COMMAND_CENSUS_REPORT_GATE_EFFECT}`
		);
		expect(arrowCapability!.explanation).toContain('successful evidence is never truncated');
		expect(arrowCapability!.explanation).toContain('selected-captured-subject currentness');
		expect(arrowCapability!.explanation).toContain('Retained dead-covered and orphan labels');
		expect(arrowCapability!.explanation).toContain("report's parsed-request command adapter");
		for (const nonclaim of ARROW_COMMAND_CENSUS_REPORT_NONCLAIMS)
			expect(arrowCapability!.explanation).toContain(nonclaim);
		const readWriteCapability = capabilities.get('read-write-access-graph');
		expect(readWriteCapability).toBeDefined();
		const readWriteExplanation = readWriteCapability!.explanation;
		expect(readWriteCapability).toMatchObject({
			explanation: expect.stringContaining(
				'derives a validated Program-local read/write access graph'
			),
			provider: 'typescript',
			provenance: expect.arrayContaining([
				'packages/csaa/src/contracts/read-write-access-graph.ts',
				'packages/csaa/src/graph/build-read-write-access-graph.ts',
				'packages/csaa/src/graph/read-write-access-graph-canonical.ts',
				'packages/csaa/src/graph/validate-read-write-access-graph.ts',
				...READ_WRITE_ACCESS_REPORT_PROVENANCE,
				'package.json#/scripts/csaa:analyze:read-write-access'
			]),
			state: 'PARTIAL'
		});
		expect(readWriteExplanation).toContain('JAN-CSAA-CAP-007 data flow');
		expect(readWriteExplanation).toContain(
			'broader data-flow capability therefore remains UNIMPLEMENTED'
		);
		expect(readWriteExplanation).toContain(
			'write forms absent from the normalized assignment taxonomy are not classified as supported writes'
		);
		expect(readWriteExplanation).toContain(READ_WRITE_ACCESS_REPORT_OPERATION_VERSION);
		expect(readWriteExplanation).toContain(READ_WRITE_ACCESS_REPORT_REQUEST_SCHEMA_VERSION);
		expect(readWriteExplanation).toContain(READ_WRITE_ACCESS_REPORT_RESULT_SCHEMA_VERSION);
		expect(readWriteExplanation).toContain(READ_WRITE_ACCESS_REPORT_SCHEMA_VERSION);
		expect(readWriteExplanation).toContain(JSON.stringify(READ_WRITE_ACCESS_REPORT_SELECTION));
		expect(readWriteExplanation).toContain(
			`analysis authority is ${READ_WRITE_ACCESS_REPORT_AUTHORITY}`
		);
		expect(readWriteExplanation).toContain(
			`authority transfer is ${READ_WRITE_ACCESS_REPORT_AUTHORITY_TRANSFER}`
		);
		expect(readWriteExplanation).toContain(
			`gate effect is ${READ_WRITE_ACCESS_REPORT_GATE_EFFECT}`
		);
		expect(readWriteExplanation).toContain('successful graph evidence is never truncated');
		expect(readWriteExplanation).toContain('zero recorded population');
		expect(readWriteExplanation).toContain('parsed-request command adapter');
		for (const nonclaim of READ_WRITE_ACCESS_REPORT_NONCLAIMS)
			expect(readWriteExplanation).toContain(nonclaim);
		for (const id of ['code-property-graph', 'control-flow', 'data-flow', 'security-query']) {
			expect(capabilities.get(id)).toMatchObject({
				explanation: expect.stringContaining('no control-flow, data-flow'),
				provider: null,
				state: 'UNIMPLEMENTED'
			});
		}
		expect(
			inventory.unknowns.some((entry) =>
				entry.statement.includes('Program construction remains deferred')
			)
		).toBe(false);
		const semanticBoundaryEntry = inventory.unknowns.find((entry) =>
			entry.statement.includes('current DWP-003 frozen Program construction')
		);
		expect(semanticBoundaryEntry?.provenance).toEqual(
			expect.arrayContaining([
				COMMAND_EVENT_CONTRACT_OVERLAY_PROJECT_CONFIG_PATH,
				COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH,
				COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH,
				COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH,
				'capabilities#structural-module-reachability-analysis',
				'capabilities#structural-scc-analysis',
				'capabilities#logical-graph-composition',
				'capabilities#project-context-graph',
				'capabilities#conditional-export-resolution',
				'capabilities#declaration-context-analysis',
				'capabilities#module-resolution-trace',
				'capabilities#source-origin-correlation',
				...DECLARATION_CONTEXT_ANALYSIS_PROVENANCE,
				...DECLARATION_CONTEXT_REPORT_PROVENANCE,
				...MODULE_DEPENDENCY_REPORT_PROVENANCE,
				...SEMANTIC_SOURCE_QUERY_PROVENANCE,
				...CALL_GRAPH_REPORT_PROVENANCE,
				...LOGICAL_GRAPH_COMPOSITION_REPORT_PROVENANCE,
				...STATE_MACHINE_GRAPH_REPORT_PROVENANCE,
				...ARROW_COMMAND_CENSUS_REPORT_PROVENANCE,
				...COMMAND_HANDLER_GRAPH_REPORT_PROVENANCE,
				...COMMAND_DISPATCH_TOPOLOGY_REPORT_PROVENANCE,
				...COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROVENANCE,
				...GUARD_ENFORCEMENT_LEDGER_REPORT_PROVENANCE,
				...GUARD_CLASSIFICATION_OVERLAY_REPORT_PROVENANCE,
				...READ_WRITE_ACCESS_REPORT_PROVENANCE,
				...SOURCE_ORIGIN_CORRELATION_PROVENANCE,
				'packages/csaa/src/contracts/logical-graph-composition.ts',
				'packages/csaa/src/graph/build-logical-graph-composition.ts',
				'packages/csaa/src/graph/validate-logical-graph-composition.ts',
				'packages/csaa/src/contracts/project-context-graph.ts',
				'packages/csaa/src/graph/build-project-context-graph.ts',
				'packages/csaa/src/graph/validate-project-context-graph.ts',
				'packages/csaa/src/contracts/conditional-export-resolution.ts',
				'packages/csaa/src/resolution/build-conditional-export-resolution.ts',
				'packages/csaa/src/resolution/validate-conditional-export-resolution.ts',
				'packages/csaa/src/contracts/module-resolution-trace.ts',
				'packages/csaa/src/resolution/build-module-resolution-trace.ts',
				'packages/csaa/src/resolution/validate-module-resolution-trace.ts',
				...MODULE_RESOLUTION_TRACE_REPORT_PROVENANCE,
				'packages/csaa/src/semantic/compiler-capture-capability.ts',
				'packages/csaa/src/contracts/structural-module-reachability-analysis.ts',
				'packages/csaa/src/graph/build-structural-module-reachability-analysis.ts',
				'packages/csaa/src/graph/validate-structural-module-reachability-analysis.ts',
				...STRUCTURAL_MODULE_REACHABILITY_REPORT_PROVENANCE,
				...STATIC_MODULE_IMPACT_CANDIDATE_REPORT_PROVENANCE,
				...WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_PROVENANCE,
				'packages/csaa/src/contracts/structural-scc-analysis.ts',
				'packages/csaa/src/graph/build-structural-scc-analysis.ts',
				'packages/csaa/src/graph/validate-structural-scc-analysis.ts'
			])
		);
		const semanticBoundary = semanticBoundaryEntry?.statement;
		expect(semanticBoundary).toContain(
			`preliminary semantic-source-query report facade exposes one explicitly selected retained ${SEMANTIC_SOURCE_QUERY_POPULATION} population`
		);
		expect(semanticBoundary).toContain(
			'exact T/F/U/C equality, exact nonempty case-sensitive logicalPath prefix comparison with no path normalization/glob/regex/segment inference, unary NOT, and nonempty ordered AND/OR semantics'
		);
		expect(semanticBoundary).toContain(
			'whole-AST validation, COMPLETE-only node-total evaluation, applicability partitions, and all six independent epistemic dimensions'
		);
		expect(semanticBoundary).toContain(
			'Evaluation closure is limited to retained validated semantic sources, global closure remains OPEN, dynamic evidence is explicitly NOT_APPLICABLE, and zero supported matches do not establish global absence'
		);
		expect(semanticBoundary).toContain(
			'command csaa:analyze:semantic-source-query is CONFIGURED_NOT_RUN by inventory generation'
		);
		expect(semanticBoundary).toContain(
			'facade remains PARTIAL and IMPLEMENTATION_LOCAL_UNREGISTERED and does not complete CAP-029, DWP-005, DWP-006, G5, a registered JAN-CSAA-007 operation, findings, or disposition'
		);
		expect(semanticBoundary).toContain(
			'preliminary static-module-impact-candidates facade binds one caller-declared whole-source EDIT seed and expected artifact SHA-256 to one current captured source'
		);
		expect(semanticBoundary).toContain(
			'emits only POSSIBLE importer candidates with complete seed-to-candidate witnesses over unchanged native importer-to-imported edges'
		);
		expect(semanticBoundary).toContain(
			'Global impact closure remains OPEN; the caller working-change identity is not independently validated; unvisited or zero-candidate nodes receive no non-impact state'
		);
		expect(semanticBoundary).toContain(
			'command csaa:analyze:static-module-impact-candidates is CONFIGURED_NOT_RUN by inventory generation'
		);
		expect(semanticBoundary).toContain(
			'preliminary working-source-edit-impact-candidates facade path-locally binds one raw immutable HEAD blob and exact matching stage-zero index entry to one fatally decoded UTF-8 current FrozenSubject artifact'
		);
		expect(semanticBoundary).toContain(
			'complete WorkingChangeSet identity, full CAP-031, DWP-005/DWP-006 completion, gates, runtime impact, provider qualification, and safe-removal proof remain NOT_CLAIMED'
		);
		expect(semanticBoundary).toContain(
			'maxGitOperationDurationMs is one aggregate monotonic wall budget across all Git invocations in each complete observation'
		);
		expect(semanticBoundary).toContain(
			'Every terminal stdout envelope after request admission is maxResultBytes-bounded'
		);
		expect(semanticBoundary).toContain(
			'host-installed Git executable and OS process launch remain ambient trust boundaries'
		);
		expect(semanticBoundary).toContain(
			'command csaa:analyze:working-source-edit-impact-candidates is CONFIGURED_NOT_RUN by inventory generation'
		);
		expect(semanticBoundary).toContain('TS_PROJECT/TS_SYNTAX/TS_SYMBOL/TS_TYPE extraction');
		expect(semanticBoundary).toContain('wall-anchored monotonic operation clock');
		expect(semanticBoundary).toContain(
			'maxDurationMs remains a caller-supplied operation budget and runaway guard'
		);
		expect(semanticBoundary).toContain(
			'not an empirical runtime, expected duration, product ceiling, or SLO'
		);
		expect(semanticBoundary).toContain('first seventeen bounded DWP-004 increments implement');
		expect(semanticBoundary).toContain('a deliberately partial static call graph');
		expect(semanticBoundary).toContain(
			'complete bounded generated JPWB state-machine topology projection for one exact generated source'
		);
		expect(semanticBoundary).toContain(
			'exact selected retained arrow-command census evidence and baseline comparison'
		);
		expect(semanticBoundary).toContain(
			'exact same-subject COMMANDS-to-HANDLERS static projection with retained arrow sites, occurrences, exact/candidate lanes, and explicit frontiers'
		);
		expect(semanticBoundary).toContain(
			'exact same-subject COMMANDS-to-HANDLERS static projection, full retained-arrow and command-handler predecessor evidence, and candidate-only dispatch handler edges'
		);
		expect(semanticBoundary).toContain(
			'command csaa:analyze:command-dispatch-topology is CONFIGURED_NOT_RUN by inventory generation'
		);
		expect(semanticBoundary).toContain(
			'preliminary guard-classification-overlay report facade exposes the exact same-subject retained-arrow, command-handler, retained-guard, generated-state, and guard-classification evidence'
		);
		expect(semanticBoundary).toContain(
			'command csaa:analyze:guard-classification-overlay is CONFIGURED_NOT_RUN by inventory generation'
		);
		expect(semanticBoundary).toContain(
			'preliminary command-event-contract-overlay report facade exposes the exact same-subject retained-arrow, command-handler, COMMANDS/EVENTS registry, vocabulary, retained event-census, and command-event overlay evidence'
		);
		expect(semanticBoundary).toContain(
			'command csaa:analyze:command-event-contract-overlay is CONFIGURED_NOT_RUN by inventory generation'
		);
		expect(semanticBoundary).toContain(
			'preliminary logical-graph-composition report facade exposes one exact same-subject project-context, module-dependency, call, and two-layer reference-only composition evidence set'
		);
		expect(semanticBoundary).toContain(
			'preserving PARTIAL/OPEN status, every predecessor limitation, and no query, slice, impact, finding, remediation, dead-code, safe-removal, DWP completion, registered-operation, or gate authority'
		);
		expect(semanticBoundary).toContain(
			'command csaa:analyze:logical-graph-composition is CONFIGURED_NOT_RUN by inventory generation'
		);
		expect(semanticBoundary).toContain(
			'aggregate unexecuted preliminary report-command population includes semantic-source-query, static-module-impact-candidates, working-source-edit-impact-candidates, command-dispatch-topology, guard-classification-overlay, command-event-contract-overlay, and logical-graph-composition'
		);
		expect(semanticBoundary).toContain(
			'exact selected retained guard-enforcement-ledger audit and classification evidence'
		);
		expect(semanticBoundary).toContain(
			'complete bounded Program-local read/write projection with exact project/source mappings'
		);
		expect(semanticBoundary).toContain(
			'complete bounded compiler module-dependency projection with every occurrence edge'
		);
		expect(semanticBoundary).toContain('preserving PARTIAL capability status');
		expect(semanticBoundary).toContain(
			'preliminary semantic-source-query, static-module-impact-candidates, project-context, module-dependency, call-graph, state-machine-graph, arrow-command-census, command-handler-graph, command-dispatch-topology, guard-enforcement-ledger, guard-classification-overlay, command-event-contract-overlay, read/write-access'
		);
		expect(semanticBoundary).toContain(
			'implementation-local generated JPWB state-machine topology'
		);
		expect(semanticBoundary).toContain('wrapper around the retained arrow-command census');
		expect(semanticBoundary).toContain('Program-local read/write access projection');
		expect(semanticBoundary).toContain('static JPWB command-registry-to-handler projection');
		expect(semanticBoundary).toContain('compositional static command-bus topology overlay');
		expect(semanticBoundary).toContain('wrapper around the retained guard-enforcement ledger');
		expect(semanticBoundary).toContain('compositional static guard-classification overlay');
		expect(semanticBoundary).toContain('static command-event-contract overlay');
		expect(semanticBoundary).toContain('deterministic structural SCC analysis');
		expect(semanticBoundary).toContain('deterministic static module-reachability traversal');
		expect(semanticBoundary).toContain(
			'preliminary coding-agent report facade for that same CAP-027 slice over one explicit project/logical-path criterion and direction while preserving structural-only meaning and selected-captured-subject-only currentness'
		);
		expect(semanticBoundary).toContain(
			'exact reference-only semanticSourceId composition of independently validated module and call graph layers'
		);
		expect(semanticBoundary).toContain(
			'preserves their identities, coverage, and limitations without constructing a universal code property graph'
		);
		expect(semanticBoundary).toContain(
			'exact FrozenSubject-bound project/program/source context projection with declared project-reference closure and no inferred variants'
		);
		expect(semanticBoundary).toContain(
			'bounded exact-key conditional-export resolution for one selected frozen workspace package, consumer source and Program, subpath, mode, platform, and ordered condition set with explicit unsupported frontiers'
		);
		expect(semanticBoundary).toContain(
			'bounded exact resolved module-resolution trace for one literal bare workspace-package root import using an in-memory verified project-scoped compiler capture and exact types/NODE/IMPORT conditional-export predecessor'
		);
		expect(semanticBoundary).toContain(
			'One preliminary coding-agent report command now composes the CAP-010/CAP-012/CAP-011 chain for one exact request while preserving its partial status and treating compiler-capture and CONTEXT_ONLY-target currentness as NOT_ASSESSED'
		);
		expect(semanticBoundary).toContain(
			'One bounded DWP-003 semantic-completion increment implements only one exact zero-hop direct or one-hop same-root local-only package-root export declaration binding in the CAP-011 selected declaration target'
		);
		expect(semanticBoundary).toContain(
			'A preliminary coding-agent report facade composes CAP-010/CAP-012/CAP-011/CAP-013 for one exact importer, workspace package, and export request, preserves the predecessor nonclaims as nested evidence, and limits final currentness to the selected captured subject while compiler capture and the CONTEXT_ONLY declaration target remain NOT_ASSESSED'
		);
		expect(semanticBoundary).toContain(
			'A separate self-contained bounded DWP-003 semantic-completion increment implements only the strict flat external version-3 declaration-map source-origin slice over one exact FrozenSubject and StaticSemanticSnapshot, with no CAP-013 predecessor, no range inference, and caller-supplied target/map captures reconciled to an exact fresh declaration emission'
		);
		expect(semanticBoundary).toContain(
			"complete only within one independently validated graph and one explicit criterion while carrying that graph's upstream closure and limitations"
		);
		expect(semanticBoundary).toContain('does not execute the retained event-surface gate');
		expect(semanticBoundary).toContain(
			'preliminary semantic-source-query, static-module-impact-candidates, project-context, module-dependency, call-graph, state-machine-graph, arrow-command-census, command-handler-graph, command-dispatch-topology, guard-enforcement-ledger, guard-classification-overlay, command-event-contract-overlay, read/write-access, module-resolution-trace, declaration-context, structural SCC, or structural module-reachability report coding-agent commands'
		);
		expect(semanticBoundary).toContain(
			'configured structural SCC, structural module-reachability, logical graph composition, project context graph, conditional export resolution, module resolution trace, declaration context analysis, and source origin correlation smoke commands'
		);
		expect(semanticBoundary).toContain(
			'JAN-CSAA-CAP-011 path-alias or module-resolution surfaces beyond the selected exact resolved-only slice'
		);
		expect(semanticBoundary).toContain(
			'conditional-export patterns, arrays, package imports maps, external package maps, automatic undeclared loader conditions'
		);
		expect(semanticBoundary).toContain(
			'broader declaration-file populations, cross-file or cross-Program merge analysis, module or global augmentation analysis, ambient-effect analysis, CAP-002 declaration or symbol consumption by the declaration-context slice, CAP-013 declaration-context consumption by the source-origin slice'
		);
		expect(semanticBoundary).toContain(
			"source-map range inference or formats beyond the strict selected external declaration map, persistent or cross-revision filesystem freshness/currentness beyond the preliminary facades' final selected-captured-subject observation, compiler-capture or CONTEXT_ONLY-target filesystem currentness, checked-in build-output provenance or build authority from ignored local caller captures"
		);
		expect(semanticBoundary).toContain('JAN-CSAA-CAP-030 code slicing');
		expect(semanticBoundary).toContain(
			'graph algorithms beyond these bounded SCC and single-criterion module-reachability analyses'
		);
		expect(semanticBoundary).toContain(
			'graph composition beyond the exact declared two-layer mapping'
		);
		expect(semanticBoundary).toContain('JAN-CSAA-CAP-007 data-flow graphs');
		expect(semanticBoundary).toContain(
			'Inventory generation executes or benchmarks none of these analysis providers'
		);
		expect(semanticBoundary).toContain('generalized state-machine inference');
		const verificationAuthority = inventory.unknowns.find((entry) =>
			entry.statement.includes('Existing graph-relevant verif censuses remain authoritative')
		);
		for (const unknown of inventory.unknowns) {
			expect(new Set(unknown.provenance).size).toBe(unknown.provenance.length);
			expect(unknown.provenance).toEqual([...unknown.provenance].sort());
		}
		expect(verificationAuthority).toMatchObject({
			provenance: expect.arrayContaining([
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
				'verif/route-action-census.test.ts',
				'packages/csaa/src/graph/build-call-graph.ts',
				'packages/csaa/src/graph/build-command-handler-graph.ts',
				'packages/csaa/src/contracts/guard-classification-overlay.ts',
				'packages/csaa/src/graph/build-guard-classification-overlay.ts',
				'packages/csaa/src/graph/validate-guard-classification-overlay.ts',
				'packages/csaa/src/contracts/command-event-contract-overlay.ts',
				'packages/csaa/src/graph/build-command-event-contract-overlay.ts',
				'packages/csaa/src/graph/validate-command-event-contract-overlay.ts',
				COMMAND_EVENT_CONTRACT_OVERLAY_PROJECT_CONFIG_PATH,
				COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH,
				COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH,
				COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH,
				'packages/csaa/src/contracts/structural-module-reachability-analysis.ts',
				'packages/csaa/src/graph/build-structural-module-reachability-analysis.ts',
				'packages/csaa/src/graph/validate-structural-module-reachability-analysis.ts',
				...STRUCTURAL_MODULE_REACHABILITY_REPORT_PROVENANCE,
				...STATIC_MODULE_IMPACT_CANDIDATE_REPORT_PROVENANCE,
				...WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_PROVENANCE,
				'packages/csaa/src/contracts/structural-scc-analysis.ts',
				'packages/csaa/src/graph/build-structural-scc-analysis.ts',
				'packages/csaa/src/graph/validate-structural-scc-analysis.ts',
				'packages/csaa/src/contracts/logical-graph-composition.ts',
				'packages/csaa/src/graph/build-logical-graph-composition.ts',
				'packages/csaa/src/graph/validate-logical-graph-composition.ts',
				'packages/csaa/src/contracts/project-context-graph.ts',
				'packages/csaa/src/graph/build-project-context-graph.ts',
				'packages/csaa/src/graph/validate-project-context-graph.ts',
				...PROJECT_CONTEXT_REPORT_PROVENANCE,
				'packages/csaa/src/contracts/conditional-export-resolution.ts',
				'packages/csaa/src/resolution/build-conditional-export-resolution.ts',
				'packages/csaa/src/resolution/validate-conditional-export-resolution.ts',
				'packages/csaa/src/contracts/module-resolution-trace.ts',
				'packages/csaa/src/resolution/build-module-resolution-trace.ts',
				'packages/csaa/src/resolution/validate-module-resolution-trace.ts',
				...MODULE_RESOLUTION_TRACE_REPORT_PROVENANCE,
				...DECLARATION_CONTEXT_ANALYSIS_PROVENANCE,
				...DECLARATION_CONTEXT_REPORT_PROVENANCE,
				...SOURCE_ORIGIN_CORRELATION_PROVENANCE,
				...MODULE_DEPENDENCY_REPORT_PROVENANCE,
				...SEMANTIC_SOURCE_QUERY_PROVENANCE,
				...CALL_GRAPH_REPORT_PROVENANCE,
				...LOGICAL_GRAPH_COMPOSITION_REPORT_PROVENANCE,
				...STATE_MACHINE_GRAPH_REPORT_PROVENANCE,
				...ARROW_COMMAND_CENSUS_REPORT_PROVENANCE,
				...COMMAND_HANDLER_GRAPH_REPORT_PROVENANCE,
				...COMMAND_DISPATCH_TOPOLOGY_REPORT_PROVENANCE,
				...COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROVENANCE,
				...GUARD_ENFORCEMENT_LEDGER_REPORT_PROVENANCE,
				...GUARD_CLASSIFICATION_OVERLAY_REPORT_PROVENANCE,
				...READ_WRITE_ACCESS_REPORT_PROVENANCE,
				'packages/csaa/src/graph/validate-call-graph.ts'
			])
		});
		expect(verificationAuthority?.statement).toContain(
			'Neither wrapper, preliminary report facades including semantic-source-query, static-module-impact-candidates, and working-source-edit-impact-candidates, any static overlay, partial call graph, structural SCC analysis, structural module reachability analysis, logical graph composition, project context graph, conditional export resolution, module resolution trace, declaration context analysis, source origin correlation, nor generated state-machine topology projection replaces, retires, weakens, or transfers retained authority'
		);
		expect(verificationAuthority?.statement).toContain(
			`semantic-source-query report facade has analysis authority ${SEMANTIC_SOURCE_QUERY_REPORT_AUTHORITY}, authority transfer ${SEMANTIC_SOURCE_QUERY_REPORT_AUTHORITY_TRANSFER}, and gate effect ${SEMANTIC_SOURCE_QUERY_REPORT_GATE_EFFECT}`
		);
		expect(verificationAuthority?.statement).toContain(
			`remains ${SEMANTIC_SOURCE_QUERY_REPORT_CAPABILITY_STATUS}, evaluates only the fixed retained ${SEMANTIC_SOURCE_QUERY_POPULATION} static-source population in ${SEMANTIC_SOURCE_QUERY_EXECUTION_MODE} mode`
		);
		expect(verificationAuthority?.statement).toContain(
			'preserves OPEN global closure and explicit dynamic-evidence non-applicability'
		);
		expect(verificationAuthority?.statement).toContain(
			'confers no full CAP-029, DWP-005/DWP-006 completion, G5 or other gate, registered JAN-CSAA-007 operation, finding, remediation, or disposition authority'
		);
		expect(verificationAuthority?.statement).toContain(
			`structural SCC analysis has graph authority ${STRUCTURAL_SCC_ANALYSIS_GRAPH_AUTHORITY}, authority transfer ${STRUCTURAL_SCC_ANALYSIS_AUTHORITY_TRANSFER}, and gate effect ${STRUCTURAL_SCC_ANALYSIS_GATE_EFFECT}`
		);
		expect(verificationAuthority?.statement).toContain(
			`structural module reachability analysis has graph authority ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_GRAPH_AUTHORITY}, authority transfer ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_AUTHORITY_TRANSFER}, and gate effect ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_GATE_EFFECT}`
		);
		expect(verificationAuthority?.statement).toContain(
			'preliminary structural module reachability report facade adds no authority; its final selected-captured-subject currentness does not create semantic-query, code-slice, change-impact, whole-program, irrelevance, non-impact, or safe-removal proof'
		);
		expect(verificationAuthority?.statement).toContain(
			`static module impact-candidate facade has analysis authority ${STATIC_MODULE_IMPACT_CANDIDATE_ANALYSIS_AUTHORITY}, authority transfer ${STATIC_MODULE_IMPACT_CANDIDATE_AUTHORITY_TRANSFER}, and gate effect ${STATIC_MODULE_IMPACT_CANDIDATE_GATE_EFFECT}`
		);
		expect(verificationAuthority?.statement).toContain(
			`retains ${STATIC_MODULE_IMPACT_CANDIDATE_CAPABILITY_STATUS} status and ${STATIC_MODULE_IMPACT_CANDIDATE_FULL_CAP_031} full CAP-031 conformance`
		);
		expect(verificationAuthority?.statement).toContain(
			'direct/transitive vocabulary is structural distance only, every candidate remains POSSIBLE'
		);
		expect(verificationAuthority?.statement).toContain(
			`logical graph composition has graph authority ${LOGICAL_GRAPH_COMPOSITION_GRAPH_AUTHORITY}, authority transfer ${LOGICAL_GRAPH_COMPOSITION_AUTHORITY_TRANSFER}, and gate effect ${LOGICAL_GRAPH_COMPOSITION_GATE_EFFECT}`
		);
		expect(verificationAuthority?.statement).toContain(
			`logical-graph-composition report facade has analysis authority ${LOGICAL_GRAPH_COMPOSITION_REPORT_AUTHORITY}, authority transfer ${LOGICAL_GRAPH_COMPOSITION_REPORT_AUTHORITY_TRANSFER}, and gate effect ${LOGICAL_GRAPH_COMPOSITION_REPORT_GATE_EFFECT}`
		);
		expect(verificationAuthority?.statement).toContain(
			'remains preliminary and unregistered, preserves PARTIAL/OPEN status and every predecessor/report nonclaim'
		);
		expect(verificationAuthority?.statement).toContain(
			'confers no query, slice, impact, architecture, finding, remediation, dead-code, safe-removal, DWP completion, gate, merge, or disposition authority'
		);
		expect(verificationAuthority?.statement).toContain(
			`read/write-access report facade has analysis authority ${READ_WRITE_ACCESS_REPORT_AUTHORITY}, authority transfer ${READ_WRITE_ACCESS_REPORT_AUTHORITY_TRANSFER}, and gate effect ${READ_WRITE_ACCESS_REPORT_GATE_EFFECT}`
		);
		expect(verificationAuthority?.statement).toContain(
			`module-dependency report facade has analysis authority ${MODULE_DEPENDENCY_REPORT_AUTHORITY}, authority transfer ${MODULE_DEPENDENCY_REPORT_AUTHORITY_TRANSFER}, and gate effect ${MODULE_DEPENDENCY_REPORT_GATE_EFFECT}`
		);
		expect(verificationAuthority?.statement).toContain(
			`call-graph report facade has analysis authority ${CALL_GRAPH_REPORT_AUTHORITY}, authority transfer ${CALL_GRAPH_REPORT_AUTHORITY_TRANSFER}, and gate effect ${CALL_GRAPH_REPORT_GATE_EFFECT}`
		);
		expect(verificationAuthority?.statement).toContain(
			`state-machine-graph report facade has analysis authority ${STATE_MACHINE_GRAPH_REPORT_AUTHORITY}, authority transfer ${STATE_MACHINE_GRAPH_REPORT_AUTHORITY_TRANSFER}, and gate effect ${STATE_MACHINE_GRAPH_REPORT_GATE_EFFECT}`
		);
		expect(verificationAuthority?.statement).toContain(
			`arrow-command-census report facade has analysis authority ${ARROW_COMMAND_CENSUS_REPORT_AUTHORITY}, authority transfer ${ARROW_COMMAND_CENSUS_REPORT_AUTHORITY_TRANSFER}, and gate effect ${ARROW_COMMAND_CENSUS_REPORT_GATE_EFFECT}`
		);
		expect(verificationAuthority?.statement).toContain(
			`command-handler-graph report facade has analysis authority ${COMMAND_HANDLER_GRAPH_REPORT_AUTHORITY}, authority transfer ${COMMAND_HANDLER_GRAPH_REPORT_AUTHORITY_TRANSFER}, and gate effect ${COMMAND_HANDLER_GRAPH_REPORT_GATE_EFFECT}`
		);
		expect(verificationAuthority?.statement).toContain(
			`distinct facade scope is ${COMMAND_HANDLER_GRAPH_REPORT_SCOPE}`
		);
		expect(verificationAuthority?.statement).toContain(
			`command-dispatch-topology report facade has analysis authority ${COMMAND_DISPATCH_TOPOLOGY_REPORT_AUTHORITY}, authority transfer ${COMMAND_DISPATCH_TOPOLOGY_REPORT_AUTHORITY_TRANSFER}, and gate effect ${COMMAND_DISPATCH_TOPOLOGY_REPORT_GATE_EFFECT}`
		);
		expect(verificationAuthority?.statement).toContain(
			`distinct facade scope is ${COMMAND_DISPATCH_TOPOLOGY_REPORT_SCOPE}`
		);
		expect(verificationAuthority?.statement).toContain(
			`retained census ${COMMAND_DISPATCH_TOPOLOGY_REPORT_SELECTION.retainedDispatchCensus}`
		);
		expect(verificationAuthority?.statement).toContain(
			`command-event-contract-overlay report facade has analysis authority ${COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_AUTHORITY}, authority transfer ${COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_AUTHORITY_TRANSFER}, and gate effect ${COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_GATE_EFFECT}`
		);
		expect(verificationAuthority?.statement).toContain(
			`distinct facade scope is ${COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SCOPE}`
		);
		expect(verificationAuthority?.statement).toContain(
			'parses and binds the exact retained census test bytes but does not execute that Vitest gate'
		);
		expect(verificationAuthority?.statement).toContain(
			`guard-enforcement-ledger report facade has analysis authority ${GUARD_ENFORCEMENT_LEDGER_REPORT_AUTHORITY}, authority transfer ${GUARD_ENFORCEMENT_LEDGER_REPORT_AUTHORITY_TRANSFER}, and gate effect ${GUARD_ENFORCEMENT_LEDGER_REPORT_GATE_EFFECT}`
		);
		expect(verificationAuthority?.statement).toContain(
			`guard-classification-overlay report facade has analysis authority ${GUARD_CLASSIFICATION_OVERLAY_REPORT_AUTHORITY}, authority transfer ${GUARD_CLASSIFICATION_OVERLAY_REPORT_AUTHORITY_TRANSFER}, and gate effect ${GUARD_CLASSIFICATION_OVERLAY_REPORT_GATE_EFFECT}`
		);
		expect(verificationAuthority?.statement).toContain(
			`distinct facade scope is ${GUARD_CLASSIFICATION_OVERLAY_REPORT_SCOPE}`
		);
		expect(verificationAuthority?.statement).toContain(
			`commandDispatchTopology=${GUARD_CLASSIFICATION_OVERLAY_REPORT_SELECTION.commandDispatchTopology}`
		);
		expect(verificationAuthority?.statement).toContain(
			`commandEventContractOverlay=${GUARD_CLASSIFICATION_OVERLAY_REPORT_SELECTION.commandEventContractOverlay}`
		);
		expect(verificationAuthority?.statement).toContain(
			`neither holds nor transfers the retained census's ${ARROW_COMMAND_CENSUS_VERIFIER_AUTHORITY} verifier authority`
		);
		expect(verificationAuthority?.statement).toContain(
			'does not execute the retained test gate or turn a baseline match into correctness proof'
		);
		expect(verificationAuthority?.statement).toContain(
			'formal JAN-CSAA finding, repository-code dead/orphan classification'
		);
		expect(verificationAuthority?.statement).toContain(
			`neither holds nor transfers the embedded graph's ${STATE_MACHINE_GRAPH_VERIFIER_AUTHORITY} specialized verifier authority`
		);
		expect(verificationAuthority?.statement).toContain(
			`freshness is ${LOGICAL_GRAPH_COMPOSITION_FRESHNESS}, currentness is ${LOGICAL_GRAPH_COMPOSITION_CURRENTNESS}`
		);
		expect(verificationAuthority?.statement).toContain(
			`Full JAN-CSAA-009 conformance is ${LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_009_CONFORMANCE}`
		);
		expect(verificationAuthority?.statement).toContain(
			`project context graph has graph authority ${PROJECT_CONTEXT_GRAPH_GRAPH_AUTHORITY}, authority transfer ${PROJECT_CONTEXT_GRAPH_AUTHORITY_TRANSFER}, and gate effect ${PROJECT_CONTEXT_GRAPH_GATE_EFFECT}`
		);
		expect(verificationAuthority?.statement).toContain(
			`freshness is ${PROJECT_CONTEXT_GRAPH_FRESHNESS}, currentness is ${PROJECT_CONTEXT_GRAPH_CURRENTNESS}`
		);
		expect(verificationAuthority?.statement).toContain(
			'preliminary project-context report facade adds no authority; its separate final selected-captured-subject currentness observation does not alter or promote those embedded graph fields'
		);
		expect(verificationAuthority?.statement).toContain(
			`Full JAN-CSAA-010 conformance is ${PROJECT_CONTEXT_GRAPH_FULL_JAN_CSAA_010_CONFORMANCE}`
		);
		expect(verificationAuthority?.statement).toContain(
			`conditional export resolution has resolution authority ${CONDITIONAL_EXPORT_RESOLUTION_AUTHORITY}, authority transfer ${CONDITIONAL_EXPORT_RESOLUTION_AUTHORITY_TRANSFER}, and gate effect ${CONDITIONAL_EXPORT_RESOLUTION_GATE_EFFECT}`
		);
		expect(verificationAuthority?.statement).toContain(
			`freshness is ${CONDITIONAL_EXPORT_RESOLUTION_FRESHNESS}, currentness is ${CONDITIONAL_EXPORT_RESOLUTION_CURRENTNESS}`
		);
		expect(verificationAuthority?.statement).toContain(
			`Full JAN-CSAA-012 conformance is ${CONDITIONAL_EXPORT_RESOLUTION_FULL_JAN_CSAA_012_CONFORMANCE}`
		);
		expect(verificationAuthority?.statement).toContain(
			`module resolution trace has resolution authority ${MODULE_RESOLUTION_TRACE_AUTHORITY}, authority transfer ${MODULE_RESOLUTION_TRACE_AUTHORITY_TRANSFER}, and gate effect ${MODULE_RESOLUTION_TRACE_GATE_EFFECT}`
		);
		expect(verificationAuthority?.statement).toContain(
			`freshness is ${MODULE_RESOLUTION_TRACE_FRESHNESS}, currentness is ${MODULE_RESOLUTION_TRACE_CURRENTNESS}`
		);
		expect(verificationAuthority?.statement).toContain(
			'preliminary module-resolution-trace report facade adds no authority; its final selected-captured-subject currentness observation does not assess compiler-capture or CONTEXT_ONLY-target filesystem currentness and does not alter or promote embedded predecessor fields'
		);
		expect(verificationAuthority?.statement).toContain(
			`Full JAN-CSAA-011 conformance is ${MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_011_CONFORMANCE}, full JAN-CSAA-007 conformance is ${MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_007_CONFORMANCE}, and full JAN-CSAA-008 conformance is ${MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_008_CONFORMANCE}`
		);
		expect(verificationAuthority?.statement).toContain(
			`declaration context analysis has analysis authority ${DECLARATION_CONTEXT_ANALYSIS_AUTHORITY}, authority transfer ${DECLARATION_CONTEXT_ANALYSIS_AUTHORITY_TRANSFER}, and gate effect ${DECLARATION_CONTEXT_ANALYSIS_GATE_EFFECT}`
		);
		expect(verificationAuthority?.statement).toContain(
			`freshness is ${DECLARATION_CONTEXT_ANALYSIS_FRESHNESS}, currentness is ${DECLARATION_CONTEXT_ANALYSIS_CURRENTNESS}`
		);
		expect(verificationAuthority?.statement).toContain(
			'preliminary declaration-context report facade adds no authority; its final selected-captured-subject currentness does not assess compiler-capture or CONTEXT_ONLY-target filesystem currentness and does not alter or promote embedded predecessor fields'
		);
		expect(verificationAuthority?.statement).toContain(
			`Full JAN-CSAA-013 conformance is ${DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_013_CONFORMANCE}, full JAN-CSAA-007 conformance is ${DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_007_CONFORMANCE}, and full JAN-CSAA-008 conformance is ${DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_008_CONFORMANCE}`
		);
		expect(verificationAuthority?.statement).toContain(
			'selected same-root zero-hop direct or one-hop local-only explicit-ExportSpecifier declaration-binding slice is implemented without conferring authority over broader declaration, merge, augmentation, ambient-effect, CAP-002, or CAP-023 surfaces'
		);
		expect(verificationAuthority?.statement).toContain(
			`source origin correlation has analysis authority ${SOURCE_ORIGIN_CORRELATION_AUTHORITY}, authority transfer ${SOURCE_ORIGIN_CORRELATION_AUTHORITY_TRANSFER}, and gate effect ${SOURCE_ORIGIN_CORRELATION_GATE_EFFECT}`
		);
		expect(verificationAuthority?.statement).toContain(
			`freshness is ${SOURCE_ORIGIN_CORRELATION_FRESHNESS}, currentness is ${SOURCE_ORIGIN_CORRELATION_CURRENTNESS}`
		);
		expect(verificationAuthority?.statement).toContain(
			'without a CAP-013 predecessor and implements only the strict external flat version-3 declaration-map slice'
		);
		expect(verificationAuthority?.statement).toContain(
			'ignored local target and map captures are absent from FrozenSubject and are neither checked-in build-output provenance nor freshness, currentness, or build-authority evidence'
		);
		expect(verificationAuthority?.statement).toContain(
			`Full JAN-CSAA-014 conformance is ${SOURCE_ORIGIN_CORRELATION_FULL_JAN_CSAA_014_CONFORMANCE}, full JAN-CSAA-007 conformance is ${SOURCE_ORIGIN_CORRELATION_FULL_JAN_CSAA_007_CONFORMANCE}, and full JAN-CSAA-008 conformance is ${SOURCE_ORIGIN_CORRELATION_FULL_JAN_CSAA_008_CONFORMANCE}`
		);
		for (const boundary of [
			'complete static traversal is bounded to one independently validated graph and one explicit criterion, carries upstream closure',
			'not JAN-CSAA-CAP-009 graph composition, JAN-CSAA-CAP-029 semantic query, or JAN-CSAA-CAP-030 code slicing',
			'whole-program or behavioral reachability',
			'assigns irrelevance or non-impact to unvisited nodes',
			'identifies orphan or dead code',
			'proves safe removal',
			'supplies runtime evidence',
			'changes a gate',
			'full JAN-CSAA-007/008/009 conformance'
		])
			expect(verificationAuthority?.statement).toContain(boundary);
		expect(verificationAuthority?.statement).toContain(
			`guard-enforcement ledger's ${GUARD_ENFORCEMENT_LEDGER_INTEGRATION_STRATEGY} integration strategy is IMPLEMENTED`
		);
		expect(verificationAuthority?.statement).toContain(
			'does not execute, normalize, integrate, replace, or infer runtime behavior from that literal-presence proxy'
		);
		expect(verificationAuthority?.statement).toContain(
			'reproduces only the supported BOUND formula and dated pinned EMITTED declaration'
		);
		expect(verificationAuthority?.statement).toContain(
			'event-surface remains delegated and exact-identity-bound but NOT_EXECUTED_BY_CSAA and NOT_INTEGRATED'
		);
		expect(verificationAuthority?.statement).toContain(
			`${ARROW_COMMAND_CENSUS_INTEGRATION_STRATEGY} integration strategy is IMPLEMENTED by bounded CSAA adapter ${ARROW_COMMAND_CENSUS_ADAPTER_ID}`
		);
		expect(verificationAuthority?.statement).toContain(
			`${ARROW_COMMAND_CENSUS_VERIFIER_AUTHORITY} verifier authority`
		);
		expect(verificationAuthority?.statement).toContain('exact baseline, tests');
		for (const family of [
			'arrow-command',
			'authority-resolution',
			'aggregate-birth',
			'command-dispatch',
			'contract-number',
			'dead-kernel',
			'event-surface',
			'policy-evidence-requirement',
			'route-action'
		])
			expect(verificationAuthority?.statement).toContain(family);
	});

	it('rejects malformed and duplicate workspace manifests', () => {
		const malformed = fixture();
		write(malformed, 'packages/demo/package.json', '{ not-json');
		expect(() => collectInventory({ repositoryRoot: malformed })).toThrow(
			'Workspace manifest is malformed'
		);

		const duplicate = fixture();
		write(
			duplicate,
			'packages/other/package.json',
			JSON.stringify({ name: '@fixture/demo', private: true, version: '0.0.0' })
		);
		expect(() => collectInventory({ repositoryRoot: duplicate })).toThrow(
			'Workspace name @fixture/demo is ambiguous'
		);
	});

	it('fails closed on malformed root-manifest and coverage configuration shapes', () => {
		const unreadable = fixture();
		write(unreadable, 'package.json', '{ not-json');
		expect(() => collectInventory({ repositoryRoot: unreadable })).toThrow(
			'CSAA subject resolution incompatible: CONFIG_MALFORMED: Root package.json is not valid JSON.'
		);

		const nonObject = fixture();
		write(nonObject, 'package.json', '[]');
		expect(() => collectInventory({ repositoryRoot: nonObject })).toThrow(
			'root manifest package.json must be a JSON object'
		);

		const invalidScript = fixture();
		write(
			invalidScript,
			'package.json',
			JSON.stringify({
				name: 'fixture-workbench',
				private: true,
				scripts: { test: true },
				workspaces: ['packages/*', 'apps/*']
			})
		);
		expect(() => collectInventory({ repositoryRoot: invalidScript })).toThrow(
			'package.json#/scripts.test must be a string'
		);

		const invalidInclude = fixture();
		write(
			invalidInclude,
			'vitest.config.ts',
			'export default { test: { coverage: { include: [true] } } };\n'
		);
		expect(() => collectInventory({ repositoryRoot: invalidInclude })).toThrow(
			'vitest coverage include must be an array of strings'
		);

		const invalidThresholds = fixture();
		write(
			invalidThresholds,
			'vitest.config.ts',
			'export default { test: { coverage: { thresholds: [95] } } };\n'
		);
		expect(() => collectInventory({ repositoryRoot: invalidThresholds })).toThrow(
			'coverage thresholds must be a JSON object'
		);
	});

	it('reads only closed literal coverage configuration from the TypeScript AST', () => {
		const root = fixture();
		write(
			root,
			'vitest.config.ts',
			[
				'export default {',
				'  test: { coverage: {',
				'    provider: `v8`,',
				"    include: ['packages/*/src/**/*.ts'],",
				'    exclude: [],',
				'    thresholds: { statements: 95, branches: 83 },',
				'    1: true,',
				'    disabled: false',
				'  } }',
				'};'
			].join('\n')
		);
		const literal = collectInventory({ repositoryRoot: root });
		expect(literal.assuranceSurfaces.coverage).toMatchObject({
			exclude: [],
			include: ['packages/*/src/**/*.ts'],
			provider: 'v8',
			thresholds: { branches: 83, statements: 95 }
		});

		write(
			root,
			'vitest.config.ts',
			'const inherited = {}; export default { test: { coverage: { ...inherited } } };\n'
		);
		expect(collectInventory({ repositoryRoot: root }).assuranceSurfaces.coverage).toMatchObject({
			include: [],
			provider: null,
			thresholds: {}
		});

		write(
			root,
			'vitest.config.ts',
			"const key = 'coverage'; export default { test: { [key]: {} } };\n"
		);
		expect(
			collectInventory({ repositoryRoot: root }).assuranceSurfaces.coverage.provider
		).toBeNull();

		write(
			root,
			'vitest.config.ts',
			"const provider = 'v8'; export default { test: { coverage: { provider } } };\n"
		);
		expect(
			collectInventory({ repositoryRoot: root }).assuranceSurfaces.coverage.provider
		).toBeNull();
	});

	it('excludes derived output while responding to a synthetic workspace mutation', () => {
		const root = fixture();
		const before = collectInventory({ repositoryRoot: root });
		write(root, 'packages/demo/dist/ignored.ts', 'export const ignored = true;\n');
		write(root, 'apps/demo/e2e-results/trace.zip', 'sensitive derived trace\n');
		write(root, 'apps/demo/test-results/result.json', '{"derived":true}\n');
		write(root, 'apps/demo/playwright-report/index.html', '<p>derived</p>\n');
		write(root, 'scripts/mutants/.harvest.json', '{"transient":true}\n');
		write(root, 'scripts/mutants/.harvest-run.json', '{"transient":true}\n');
		write(root, 'scripts/mutants/.in-flight', 'transient journal\n');
		write(root, 'packages/demo/.env', 'TOKEN=secret-one\n');
		write(root, 'apps/demo/.env.local', 'TOKEN=secret-two\n');
		write(root, 'apps/demo/package/derived.js', 'export const derived = true;\n');
		write(root, 'apps/demo/vite.config.ts.timestamp-123.mjs', 'export default {};\n');
		write(root, 'packages/demo/tsconfig.tsbuildinfo', 'derived compiler state\n');
		const withExcluded = collectInventory({ repositoryRoot: root });
		expect(withExcluded.subject.fileManifestDigest).toBe(before.subject.fileManifestDigest);
		expect(
			withExcluded.subject.selectedFiles.some((file) =>
				/(?:\/dist\/|\/e2e-results\/|\/test-results\/|\/playwright-report\/)/.test(file.path)
			)
		).toBe(false);
		expect(
			withExcluded.subject.selectedFiles.some((file) =>
				/scripts\/mutants\/\.(?:harvest|in-flight)/.test(file.path)
			)
		).toBe(false);
		expect(
			withExcluded.subject.selectedFiles.some((file) => /(?:^|\/)\.env(?:\.|$)/.test(file.path))
		).toBe(false);
		expect(
			withExcluded.subject.selectedFiles.some((file) =>
				/(?:\/package\/|\.tsbuildinfo$|vite\.config\.(?:js|ts)\.timestamp-)/.test(file.path)
			)
		).toBe(false);

		write(
			root,
			'packages/new/package.json',
			JSON.stringify({ name: '@fixture/new', private: true, version: '0.0.0' })
		);
		write(root, 'packages/new/src/index.ts', 'export const added = true;\n');
		const changed = collectInventory({ repositoryRoot: root });
		expect(changed.workspaces).toHaveLength(before.workspaces.length + 1);
		expect(changed.subject.subjectId).not.toBe(before.subject.subjectId);
	});

	it('changes corresponding facts for tsconfig, tool-configuration, and analyzer mutations', () => {
		const root = fixture();
		const initial = collectInventory({ repositoryRoot: root });

		write(
			root,
			'packages/demo/tsconfig.json',
			'{ "compilerOptions": { "strict": false }, "include": ["src"] }\n'
		);
		const tsconfigChanged = collectInventory({ repositoryRoot: root });
		expect(
			tsconfigChanged.typescriptProjects.find(
				(project) => project.path === 'packages/demo/tsconfig.json'
			)?.compilerOptions.strict
		).toBe(false);
		expect(tsconfigChanged.subject.configurationDigest).not.toBe(
			initial.subject.configurationDigest
		);

		write(
			root,
			'vitest.config.ts',
			"export default { test: { coverage: { provider: 'v8', include: ['packages/*/src/**/*.ts'] } } };\n"
		);
		const toolChanged = collectInventory({ repositoryRoot: root });
		expect(toolChanged.assuranceSurfaces.coverage).toMatchObject({
			configurationPath: 'vitest.config.ts',
			include: ['packages/*/src/**/*.ts'],
			provider: 'v8'
		});
		expect(toolChanged.subject.subjectId).not.toBe(tsconfigChanged.subject.subjectId);

		const analyzerBefore = toolChanged.verificationAssets.find(
			(asset) => asset.path === 'verif/example.test.ts'
		)?.contentSha256;
		write(root, 'verif/example.test.ts', 'export const verification = false;\n');
		const analyzerChanged = collectInventory({ repositoryRoot: root });
		expect(
			analyzerChanged.verificationAssets.find((asset) => asset.path === 'verif/example.test.ts')
				?.contentSha256
		).not.toBe(analyzerBefore);
		expect(analyzerChanged.subject.subjectId).not.toBe(toolChanged.subject.subjectId);
	});
});

describe('generated product safety', () => {
	it('requires unique markers and preserves every byte outside them', () => {
		const source = `prefix\r\n${GENERATED_REGION_BEGIN}\r\nold\r\n${GENERATED_REGION_END}\r\nsuffix\r\n`;
		const rendered = replaceGeneratedRegion(source, 'new\nrows\n');
		expect(rendered).toBe(
			`prefix\r\n${GENERATED_REGION_BEGIN}\r\nnew\r\nrows\r\n${GENERATED_REGION_END}\r\nsuffix\r\n`
		);
		expect(() => replaceGeneratedRegion('no markers', 'new')).toThrow('exactly one begin marker');
		expect(() =>
			replaceGeneratedRegion(
				`${GENERATED_REGION_BEGIN}\n${GENERATED_REGION_BEGIN}\n${GENERATED_REGION_END}\n`,
				'new'
			)
		).toThrow('exactly one begin marker');
		expect(() =>
			replaceGeneratedRegion(`${GENERATED_REGION_END}\n${GENERATED_REGION_BEGIN}\n`, 'new')
		).toThrow('generated-region markers are reversed');
		expect(() =>
			replaceGeneratedRegion(`prefix${GENERATED_REGION_BEGIN}\n${GENERATED_REGION_END}\n`, 'new')
		).toThrow(`Generated-region marker is not on its own line: ${GENERATED_REGION_BEGIN}`);
		expect(() =>
			replaceGeneratedRegion(`${GENERATED_REGION_BEGIN}suffix\n${GENERATED_REGION_END}\n`, 'new')
		).toThrow(`Generated-region marker is not on its own line: ${GENERATED_REGION_BEGIN}`);
	});

	it('supports an in-memory JSON result and rejects publication without its controlled document', () => {
		const root = fixture();
		const result = runInventory({ mode: 'json', repositoryRoot: root });
		expect(result).toMatchObject({
			differences: [],
			mode: 'json',
			ok: true,
			subjectId: result.inventory.subject.subjectId
		});
		expect(JSON.parse(result.json).subject.subjectId).toBe(result.subjectId);
		const missingBaseline = runInventory({ mode: 'check', repositoryRoot: root });
		expect(missingBaseline.ok).toBe(false);
		expect(missingBaseline.differences).toEqual([
			expect.objectContaining({
				actualBytes: null,
				actualSha256: null,
				path: 'verif/csaa/jan-csaa-005.inventory.baseline.json'
			}),
			expect.objectContaining({
				path: 'docs/ASTs and Code Analysis/JAN-CSAA-005 - JPWB TypeScript Repository Semantic Inventory and Conformance Mapping.md'
			})
		]);
		expect(existsSync(join(root, 'verif', 'csaa', 'jan-csaa-005.inventory.baseline.json'))).toBe(
			false
		);

		rmSync(
			join(
				root,
				'docs',
				'ASTs and Code Analysis',
				'JAN-CSAA-005 - JPWB TypeScript Repository Semantic Inventory and Conformance Mapping.md'
			)
		);
		expect(() => runInventory({ mode: 'check', repositoryRoot: root })).toThrow(
			'JAN-CSAA-005 document is absent'
		);
	});

	it('writes byte-identical products, detects drift read-only, and rolls back an interrupted pair', () => {
		const root = fixture();
		const documentPath =
			'docs/ASTs and Code Analysis/JAN-CSAA-005 - JPWB TypeScript Repository Semantic Inventory and Conformance Mapping.md';
		const baselinePath = 'verif/csaa/jan-csaa-005.inventory.baseline.json';
		const first = runInventory({ mode: 'write', repositoryRoot: root });
		const firstDocument = readFileSync(join(root, ...documentPath.split('/')), 'utf8');
		const firstBaseline = readFileSync(join(root, ...baselinePath.split('/')), 'utf8');
		expect(firstDocument).toContain(first.subjectId);
		expect(JSON.parse(firstBaseline).subject.subjectId).toBe(first.subjectId);
		expect(runInventory({ mode: 'write', repositoryRoot: root }).subjectId).toBe(first.subjectId);
		expect(readFileSync(join(root, ...documentPath.split('/')), 'utf8')).toBe(firstDocument);
		expect(readFileSync(join(root, ...baselinePath.split('/')), 'utf8')).toBe(firstBaseline);
		expect(runInventory({ mode: 'check', repositoryRoot: root }).ok).toBe(true);

		write(root, 'packages/demo/src/index.ts', 'export const value = 2;\n');
		const beforeCheckDocument = readFileSync(join(root, ...documentPath.split('/')), 'utf8');
		const beforeCheckBaseline = readFileSync(join(root, ...baselinePath.split('/')), 'utf8');
		const stale = runInventory({ mode: 'check', repositoryRoot: root });
		expect(stale.ok).toBe(false);
		expect(stale.differences.map((entry) => entry.path)).toEqual([baselinePath, documentPath]);
		expect(readFileSync(join(root, ...documentPath.split('/')), 'utf8')).toBe(beforeCheckDocument);
		expect(readFileSync(join(root, ...baselinePath.split('/')), 'utf8')).toBe(beforeCheckBaseline);

		expect(() =>
			runInventory({
				afterFirstCommit: () => {
					throw new Error('injected interruption');
				},
				mode: 'write',
				repositoryRoot: root
			})
		).toThrow('injected interruption');
		expect(readFileSync(join(root, ...documentPath.split('/')), 'utf8')).toBe(beforeCheckDocument);
		expect(readFileSync(join(root, ...baselinePath.split('/')), 'utf8')).toBe(beforeCheckBaseline);
		expect(readdirSync(join(root, 'verif', 'csaa')).some((name) => name.endsWith('.tmp'))).toBe(
			false
		);
		expect(
			readdirSync(join(root, 'docs', 'ASTs and Code Analysis')).some((name) =>
				name.endsWith('.tmp')
			)
		).toBe(false);
	});

	it('keeps generated outputs outside their own subject preimage', () => {
		const root = fixture();
		const before = collectInventory({ repositoryRoot: root });
		write(root, 'verif/csaa/jan-csaa-005.inventory.baseline.json', '{"self":"different"}\n');
		const after = collectInventory({ repositoryRoot: root });
		expect(after.subject.fileManifestDigest).toBe(before.subject.fileManifestDigest);
		expect(
			after.subject.selectedFiles.some((file) => file.path.includes('jan-csaa-005.inventory'))
		).toBe(false);
	});
});

describe('JPWB population non-vacuity', () => {
	it('rejects each vacuous required JPWB population independently', () => {
		const completeScripts = Object.fromEntries(
			[
				'boundary',
				'check-types',
				'gate',
				'gate:fast',
				'lint',
				'test',
				'test:coverage',
				'csaa:semantic:smoke:conditional-export-resolution',
				'csaa:semantic:smoke:declaration-context-analysis',
				'csaa:analyze:declaration-context',
				'csaa:semantic:smoke:source-origin-correlation',
				'csaa:semantic:smoke:module-resolution-trace',
				'csaa:analyze:arrow-command-census',
				'csaa:analyze:command-handler-graph',
				'csaa:analyze:semantic-source-query',
				'csaa:analyze:command-dispatch-topology',
				'csaa:analyze:command-event-contract-overlay',
				'csaa:analyze:guard-enforcement-ledger',
				'csaa:analyze:guard-classification-overlay',
				'csaa:analyze:call-graph',
				'csaa:analyze:module-dependency',
				'csaa:analyze:logical-graph-composition',
				'csaa:analyze:module-resolution-trace',
				'csaa:semantic:smoke:command-event-contract',
				'csaa:semantic:smoke:guard-classification',
				'csaa:semantic:smoke:logical-graph-composition',
				'csaa:analyze:project-context',
				'csaa:analyze:read-write-access',
				'csaa:semantic:smoke:project-context-graph',
				'csaa:semantic:smoke:structural-module-reachability',
				'csaa:analyze:static-module-impact-candidates',
				'csaa:analyze:working-source-edit-impact-candidates',
				'csaa:analyze:structural-module-reachability',
				'csaa:semantic:smoke:structural-scc'
			].map((name) => [name, jpwbFixtureScriptCommand(name)])
		);
		const manifest = (workspaces: readonly string[] | undefined, scripts = completeScripts) =>
			JSON.stringify({
				name: 'janumi-professional-workbench',
				private: true,
				scripts,
				...(workspaces ? { workspaces } : {})
			});

		const wrongIdentity = fixture();
		expect(() =>
			collectInventory({ repositoryRoot: wrongIdentity, requireJpwbPopulations: true })
		).toThrow('JPWB inventory root manifest identity is absent or incompatible');

		const noWorkspaces = fixture();
		write(noWorkspaces, 'package.json', manifest(undefined));
		expect(() =>
			collectInventory({ repositoryRoot: noWorkspaces, requireJpwbPopulations: true })
		).toThrow('JPWB workspace population is empty');

		const noVerification = fixture();
		write(noVerification, 'package.json', manifest(['packages/*', 'apps/*']));
		rmSync(join(noVerification, 'verif', 'example.test.ts'));
		expect(() =>
			collectInventory({ repositoryRoot: noVerification, requireJpwbPopulations: true })
		).toThrow('JPWB top-level verif TypeScript population is empty');

		const noScripts = fixture();
		write(noScripts, 'package.json', manifest(['packages/*', 'apps/*']));
		rmSync(join(noScripts, 'scripts', 'tool.ts'));
		expect(() =>
			collectInventory({ repositoryRoot: noScripts, requireJpwbPopulations: true })
		).toThrow('JPWB scripts TypeScript population is empty');

		const missingCommand = fixture();
		write(
			missingCommand,
			'package.json',
			manifest(['packages/*', 'apps/*'], { 'check-types': 'true', test: 'true' })
		);
		expect(() =>
			collectInventory({ repositoryRoot: missingCommand, requireJpwbPopulations: true })
		).toThrow('Required JPWB assurance command is absent: boundary');

		const missingConditionalExportResolutionSmoke = fixture();
		write(
			missingConditionalExportResolutionSmoke,
			'package.json',
			manifest(
				['packages/*', 'apps/*'],
				Object.fromEntries(
					Object.entries(completeScripts).filter(
						([name]) => name !== 'csaa:semantic:smoke:conditional-export-resolution'
					)
				)
			)
		);
		expect(() =>
			collectInventory({
				repositoryRoot: missingConditionalExportResolutionSmoke,
				requireJpwbPopulations: true
			})
		).toThrow(
			'Required JPWB assurance command is absent: csaa:semantic:smoke:conditional-export-resolution'
		);

		const missingDeclarationContextAnalysisSmoke = fixture();
		write(
			missingDeclarationContextAnalysisSmoke,
			'package.json',
			manifest(
				['packages/*', 'apps/*'],
				Object.fromEntries(
					Object.entries(completeScripts).filter(
						([name]) => name !== 'csaa:semantic:smoke:declaration-context-analysis'
					)
				)
			)
		);
		expect(() =>
			collectInventory({
				repositoryRoot: missingDeclarationContextAnalysisSmoke,
				requireJpwbPopulations: true
			})
		).toThrow(
			'Required JPWB assurance command is absent: csaa:semantic:smoke:declaration-context-analysis'
		);

		const missingDeclarationContextReportCommand = fixture();
		write(
			missingDeclarationContextReportCommand,
			'package.json',
			manifest(
				['packages/*', 'apps/*'],
				Object.fromEntries(
					Object.entries(completeScripts).filter(
						([name]) => name !== 'csaa:analyze:declaration-context'
					)
				)
			)
		);
		expect(() =>
			collectInventory({
				repositoryRoot: missingDeclarationContextReportCommand,
				requireJpwbPopulations: true
			})
		).toThrow('Required JPWB assurance command is absent: csaa:analyze:declaration-context');

		const missingSourceOriginCorrelationSmoke = fixture();
		write(
			missingSourceOriginCorrelationSmoke,
			'package.json',
			manifest(
				['packages/*', 'apps/*'],
				Object.fromEntries(
					Object.entries(completeScripts).filter(
						([name]) => name !== 'csaa:semantic:smoke:source-origin-correlation'
					)
				)
			)
		);
		expect(() =>
			collectInventory({
				repositoryRoot: missingSourceOriginCorrelationSmoke,
				requireJpwbPopulations: true
			})
		).toThrow(
			'Required JPWB assurance command is absent: csaa:semantic:smoke:source-origin-correlation'
		);

		const missingModuleResolutionTraceSmoke = fixture();
		write(
			missingModuleResolutionTraceSmoke,
			'package.json',
			manifest(
				['packages/*', 'apps/*'],
				Object.fromEntries(
					Object.entries(completeScripts).filter(
						([name]) => name !== 'csaa:semantic:smoke:module-resolution-trace'
					)
				)
			)
		);
		expect(() =>
			collectInventory({
				repositoryRoot: missingModuleResolutionTraceSmoke,
				requireJpwbPopulations: true
			})
		).toThrow(
			'Required JPWB assurance command is absent: csaa:semantic:smoke:module-resolution-trace'
		);

		const missingModuleDependencyReportCommand = fixture();
		write(
			missingModuleDependencyReportCommand,
			'package.json',
			manifest(
				['packages/*', 'apps/*'],
				Object.fromEntries(
					Object.entries(completeScripts).filter(
						([name]) => name !== 'csaa:analyze:module-dependency'
					)
				)
			)
		);
		expect(() =>
			collectInventory({
				repositoryRoot: missingModuleDependencyReportCommand,
				requireJpwbPopulations: true
			})
		).toThrow('Required JPWB assurance command is absent: csaa:analyze:module-dependency');

		const missingSemanticSourceQueryReportCommand = fixture();
		write(
			missingSemanticSourceQueryReportCommand,
			'package.json',
			manifest(
				['packages/*', 'apps/*'],
				Object.fromEntries(
					Object.entries(completeScripts).filter(
						([name]) => name !== 'csaa:analyze:semantic-source-query'
					)
				)
			)
		);
		expect(() =>
			collectInventory({
				repositoryRoot: missingSemanticSourceQueryReportCommand,
				requireJpwbPopulations: true
			})
		).toThrow('Required JPWB assurance command is absent: csaa:analyze:semantic-source-query');

		const missingLogicalGraphCompositionReportCommand = fixture();
		write(
			missingLogicalGraphCompositionReportCommand,
			'package.json',
			manifest(
				['packages/*', 'apps/*'],
				Object.fromEntries(
					Object.entries(completeScripts).filter(
						([name]) => name !== 'csaa:analyze:logical-graph-composition'
					)
				)
			)
		);
		expect(() =>
			collectInventory({
				repositoryRoot: missingLogicalGraphCompositionReportCommand,
				requireJpwbPopulations: true
			})
		).toThrow('Required JPWB assurance command is absent: csaa:analyze:logical-graph-composition');

		const missingArrowCommandCensusReportCommand = fixture();
		write(
			missingArrowCommandCensusReportCommand,
			'package.json',
			manifest(
				['packages/*', 'apps/*'],
				Object.fromEntries(
					Object.entries(completeScripts).filter(
						([name]) => name !== 'csaa:analyze:arrow-command-census'
					)
				)
			)
		);
		expect(() =>
			collectInventory({
				repositoryRoot: missingArrowCommandCensusReportCommand,
				requireJpwbPopulations: true
			})
		).toThrow('Required JPWB assurance command is absent: csaa:analyze:arrow-command-census');

		const missingCommandHandlerGraphReportCommand = fixture();
		write(
			missingCommandHandlerGraphReportCommand,
			'package.json',
			manifest(
				['packages/*', 'apps/*'],
				Object.fromEntries(
					Object.entries(completeScripts).filter(
						([name]) => name !== 'csaa:analyze:command-handler-graph'
					)
				)
			)
		);
		expect(() =>
			collectInventory({
				repositoryRoot: missingCommandHandlerGraphReportCommand,
				requireJpwbPopulations: true
			})
		).toThrow('Required JPWB assurance command is absent: csaa:analyze:command-handler-graph');

		const missingCommandDispatchTopologyReportCommand = fixture();
		write(
			missingCommandDispatchTopologyReportCommand,
			'package.json',
			manifest(
				['packages/*', 'apps/*'],
				Object.fromEntries(
					Object.entries(completeScripts).filter(
						([name]) => name !== 'csaa:analyze:command-dispatch-topology'
					)
				)
			)
		);
		expect(() =>
			collectInventory({
				repositoryRoot: missingCommandDispatchTopologyReportCommand,
				requireJpwbPopulations: true
			})
		).toThrow('Required JPWB assurance command is absent: csaa:analyze:command-dispatch-topology');

		const missingCommandEventContractOverlayReportCommand = fixture();
		write(
			missingCommandEventContractOverlayReportCommand,
			'package.json',
			manifest(
				['packages/*', 'apps/*'],
				Object.fromEntries(
					Object.entries(completeScripts).filter(
						([name]) => name !== 'csaa:analyze:command-event-contract-overlay'
					)
				)
			)
		);
		expect(() =>
			collectInventory({
				repositoryRoot: missingCommandEventContractOverlayReportCommand,
				requireJpwbPopulations: true
			})
		).toThrow(
			'Required JPWB assurance command is absent: csaa:analyze:command-event-contract-overlay'
		);

		const missingGuardEnforcementLedgerReportCommand = fixture();
		write(
			missingGuardEnforcementLedgerReportCommand,
			'package.json',
			manifest(
				['packages/*', 'apps/*'],
				Object.fromEntries(
					Object.entries(completeScripts).filter(
						([name]) => name !== 'csaa:analyze:guard-enforcement-ledger'
					)
				)
			)
		);
		expect(() =>
			collectInventory({
				repositoryRoot: missingGuardEnforcementLedgerReportCommand,
				requireJpwbPopulations: true
			})
		).toThrow('Required JPWB assurance command is absent: csaa:analyze:guard-enforcement-ledger');

		const missingGuardClassificationOverlayReportCommand = fixture();
		write(
			missingGuardClassificationOverlayReportCommand,
			'package.json',
			manifest(
				['packages/*', 'apps/*'],
				Object.fromEntries(
					Object.entries(completeScripts).filter(
						([name]) => name !== 'csaa:analyze:guard-classification-overlay'
					)
				)
			)
		);
		expect(() =>
			collectInventory({
				repositoryRoot: missingGuardClassificationOverlayReportCommand,
				requireJpwbPopulations: true
			})
		).toThrow(
			'Required JPWB assurance command is absent: csaa:analyze:guard-classification-overlay'
		);

		const missingCallGraphReportCommand = fixture();
		write(
			missingCallGraphReportCommand,
			'package.json',
			manifest(
				['packages/*', 'apps/*'],
				Object.fromEntries(
					Object.entries(completeScripts).filter(([name]) => name !== 'csaa:analyze:call-graph')
				)
			)
		);
		expect(() =>
			collectInventory({
				repositoryRoot: missingCallGraphReportCommand,
				requireJpwbPopulations: true
			})
		).toThrow('Required JPWB assurance command is absent: csaa:analyze:call-graph');

		const missingModuleResolutionTraceReportCommand = fixture();
		write(
			missingModuleResolutionTraceReportCommand,
			'package.json',
			manifest(
				['packages/*', 'apps/*'],
				Object.fromEntries(
					Object.entries(completeScripts).filter(
						([name]) => name !== 'csaa:analyze:module-resolution-trace'
					)
				)
			)
		);
		expect(() =>
			collectInventory({
				repositoryRoot: missingModuleResolutionTraceReportCommand,
				requireJpwbPopulations: true
			})
		).toThrow('Required JPWB assurance command is absent: csaa:analyze:module-resolution-trace');

		const missingCommandEventSmoke = fixture();
		write(
			missingCommandEventSmoke,
			'package.json',
			manifest(
				['packages/*', 'apps/*'],
				Object.fromEntries(
					Object.entries(completeScripts).filter(
						([name]) => name !== 'csaa:semantic:smoke:command-event-contract'
					)
				)
			)
		);
		expect(() =>
			collectInventory({ repositoryRoot: missingCommandEventSmoke, requireJpwbPopulations: true })
		).toThrow(
			'Required JPWB assurance command is absent: csaa:semantic:smoke:command-event-contract'
		);

		const missingGuardClassificationSmoke = fixture();
		write(
			missingGuardClassificationSmoke,
			'package.json',
			manifest(
				['packages/*', 'apps/*'],
				Object.fromEntries(
					Object.entries(completeScripts).filter(
						([name]) => name !== 'csaa:semantic:smoke:guard-classification'
					)
				)
			)
		);
		expect(() =>
			collectInventory({
				repositoryRoot: missingGuardClassificationSmoke,
				requireJpwbPopulations: true
			})
		).toThrow(
			'Required JPWB assurance command is absent: csaa:semantic:smoke:guard-classification'
		);

		const missingLogicalGraphCompositionSmoke = fixture();
		write(
			missingLogicalGraphCompositionSmoke,
			'package.json',
			manifest(
				['packages/*', 'apps/*'],
				Object.fromEntries(
					Object.entries(completeScripts).filter(
						([name]) => name !== 'csaa:semantic:smoke:logical-graph-composition'
					)
				)
			)
		);
		expect(() =>
			collectInventory({
				repositoryRoot: missingLogicalGraphCompositionSmoke,
				requireJpwbPopulations: true
			})
		).toThrow(
			'Required JPWB assurance command is absent: csaa:semantic:smoke:logical-graph-composition'
		);

		const missingProjectContextGraphSmoke = fixture();
		write(
			missingProjectContextGraphSmoke,
			'package.json',
			manifest(
				['packages/*', 'apps/*'],
				Object.fromEntries(
					Object.entries(completeScripts).filter(
						([name]) => name !== 'csaa:semantic:smoke:project-context-graph'
					)
				)
			)
		);
		expect(() =>
			collectInventory({
				repositoryRoot: missingProjectContextGraphSmoke,
				requireJpwbPopulations: true
			})
		).toThrow(
			'Required JPWB assurance command is absent: csaa:semantic:smoke:project-context-graph'
		);

		const missingProjectContextReportCommand = fixture();
		write(
			missingProjectContextReportCommand,
			'package.json',
			manifest(
				['packages/*', 'apps/*'],
				Object.fromEntries(
					Object.entries(completeScripts).filter(
						([name]) => name !== 'csaa:analyze:project-context'
					)
				)
			)
		);
		expect(() =>
			collectInventory({
				repositoryRoot: missingProjectContextReportCommand,
				requireJpwbPopulations: true
			})
		).toThrow('Required JPWB assurance command is absent: csaa:analyze:project-context');

		const missingStructuralModuleReachabilitySmoke = fixture();
		write(
			missingStructuralModuleReachabilitySmoke,
			'package.json',
			manifest(
				['packages/*', 'apps/*'],
				Object.fromEntries(
					Object.entries(completeScripts).filter(
						([name]) => name !== 'csaa:semantic:smoke:structural-module-reachability'
					)
				)
			)
		);
		expect(() =>
			collectInventory({
				repositoryRoot: missingStructuralModuleReachabilitySmoke,
				requireJpwbPopulations: true
			})
		).toThrow(
			'Required JPWB assurance command is absent: csaa:semantic:smoke:structural-module-reachability'
		);

		const missingStaticModuleImpactCandidateReportCommand = fixture();
		write(
			missingStaticModuleImpactCandidateReportCommand,
			'package.json',
			manifest(
				['packages/*', 'apps/*'],
				Object.fromEntries(
					Object.entries(completeScripts).filter(
						([name]) => name !== 'csaa:analyze:static-module-impact-candidates'
					)
				)
			)
		);
		expect(() =>
			collectInventory({
				repositoryRoot: missingStaticModuleImpactCandidateReportCommand,
				requireJpwbPopulations: true
			})
		).toThrow(
			'Required JPWB assurance command is absent: csaa:analyze:static-module-impact-candidates'
		);

		const missingWorkingSourceEditImpactCandidateReportCommand = fixture();
		write(
			missingWorkingSourceEditImpactCandidateReportCommand,
			'package.json',
			manifest(
				['packages/*', 'apps/*'],
				Object.fromEntries(
					Object.entries(completeScripts).filter(
						([name]) => name !== 'csaa:analyze:working-source-edit-impact-candidates'
					)
				)
			)
		);
		expect(() =>
			collectInventory({
				repositoryRoot: missingWorkingSourceEditImpactCandidateReportCommand,
				requireJpwbPopulations: true
			})
		).toThrow(
			'Required JPWB assurance command is absent: csaa:analyze:working-source-edit-impact-candidates'
		);

		const missingStructuralModuleReachabilityReportCommand = fixture();
		write(
			missingStructuralModuleReachabilityReportCommand,
			'package.json',
			manifest(
				['packages/*', 'apps/*'],
				Object.fromEntries(
					Object.entries(completeScripts).filter(
						([name]) => name !== 'csaa:analyze:structural-module-reachability'
					)
				)
			)
		);
		expect(() =>
			collectInventory({
				repositoryRoot: missingStructuralModuleReachabilityReportCommand,
				requireJpwbPopulations: true
			})
		).toThrow(
			'Required JPWB assurance command is absent: csaa:analyze:structural-module-reachability'
		);

		const missingStructuralSccSmoke = fixture();
		write(
			missingStructuralSccSmoke,
			'package.json',
			manifest(
				['packages/*', 'apps/*'],
				Object.fromEntries(
					Object.entries(completeScripts).filter(
						([name]) => name !== 'csaa:semantic:smoke:structural-scc'
					)
				)
			)
		);
		expect(() =>
			collectInventory({
				repositoryRoot: missingStructuralSccSmoke,
				requireJpwbPopulations: true
			})
		).toThrow('Required JPWB assurance command is absent: csaa:semantic:smoke:structural-scc');

		const selectorlessConditionalExportResolutionSmoke = fixture();
		write(
			selectorlessConditionalExportResolutionSmoke,
			'package.json',
			manifest(['packages/*', 'apps/*'], {
				...completeScripts,
				'csaa:semantic:smoke:conditional-export-resolution':
					LEGACY_STRUCTURAL_FULL_SUITE_SMOKE_COMMAND
			})
		);
		expect(() =>
			collectInventory({
				repositoryRoot: selectorlessConditionalExportResolutionSmoke,
				requireJpwbPopulations: true
			})
		).toThrow(
			'Required JPWB assurance command is incompatible: csaa:semantic:smoke:conditional-export-resolution'
		);

		const selectorlessDeclarationContextAnalysisSmoke = fixture();
		write(
			selectorlessDeclarationContextAnalysisSmoke,
			'package.json',
			manifest(['packages/*', 'apps/*'], {
				...completeScripts,
				'csaa:semantic:smoke:declaration-context-analysis':
					LEGACY_STRUCTURAL_FULL_SUITE_SMOKE_COMMAND
			})
		);
		expect(() =>
			collectInventory({
				repositoryRoot: selectorlessDeclarationContextAnalysisSmoke,
				requireJpwbPopulations: true
			})
		).toThrow(
			'Required JPWB assurance command is incompatible: csaa:semantic:smoke:declaration-context-analysis'
		);

		const incompatibleDeclarationContextReportCommand = fixture();
		write(
			incompatibleDeclarationContextReportCommand,
			'package.json',
			manifest(['packages/*', 'apps/*'], {
				...completeScripts,
				'csaa:analyze:declaration-context': 'bun run scripts/wrong-declaration-context.ts'
			})
		);
		expect(() =>
			collectInventory({
				repositoryRoot: incompatibleDeclarationContextReportCommand,
				requireJpwbPopulations: true
			})
		).toThrow('Required JPWB assurance command is incompatible: csaa:analyze:declaration-context');

		const incompatibleSourceOriginCorrelationSmoke = fixture();
		write(
			incompatibleSourceOriginCorrelationSmoke,
			'package.json',
			manifest(['packages/*', 'apps/*'], {
				...completeScripts,
				'csaa:semantic:smoke:source-origin-correlation': LEGACY_STRUCTURAL_FULL_SUITE_SMOKE_COMMAND
			})
		);
		expect(() =>
			collectInventory({
				repositoryRoot: incompatibleSourceOriginCorrelationSmoke,
				requireJpwbPopulations: true
			})
		).toThrow(
			'Required JPWB assurance command is incompatible: csaa:semantic:smoke:source-origin-correlation'
		);

		const selectorlessModuleResolutionTraceSmoke = fixture();
		write(
			selectorlessModuleResolutionTraceSmoke,
			'package.json',
			manifest(['packages/*', 'apps/*'], {
				...completeScripts,
				'csaa:semantic:smoke:module-resolution-trace': LEGACY_STRUCTURAL_FULL_SUITE_SMOKE_COMMAND
			})
		);
		expect(() =>
			collectInventory({
				repositoryRoot: selectorlessModuleResolutionTraceSmoke,
				requireJpwbPopulations: true
			})
		).toThrow(
			'Required JPWB assurance command is incompatible: csaa:semantic:smoke:module-resolution-trace'
		);

		const incompatibleModuleResolutionTraceReportCommand = fixture();
		write(
			incompatibleModuleResolutionTraceReportCommand,
			'package.json',
			manifest(['packages/*', 'apps/*'], {
				...completeScripts,
				'csaa:analyze:module-resolution-trace': 'bun run scripts/wrong-module-resolution-trace.ts'
			})
		);
		expect(() =>
			collectInventory({
				repositoryRoot: incompatibleModuleResolutionTraceReportCommand,
				requireJpwbPopulations: true
			})
		).toThrow(
			'Required JPWB assurance command is incompatible: csaa:analyze:module-resolution-trace'
		);

		const incompatibleModuleDependencyReportCommand = fixture();
		write(
			incompatibleModuleDependencyReportCommand,
			'package.json',
			manifest(['packages/*', 'apps/*'], {
				...completeScripts,
				'csaa:analyze:module-dependency': 'bun scripts/wrong-module-dependency.ts'
			})
		);
		expect(() =>
			collectInventory({
				repositoryRoot: incompatibleModuleDependencyReportCommand,
				requireJpwbPopulations: true
			})
		).toThrow('Required JPWB assurance command is incompatible: csaa:analyze:module-dependency');

		const incompatibleSemanticSourceQueryReportCommand = fixture();
		write(
			incompatibleSemanticSourceQueryReportCommand,
			'package.json',
			manifest(['packages/*', 'apps/*'], {
				...completeScripts,
				'csaa:analyze:semantic-source-query': 'bun scripts/wrong-semantic-source-query.ts'
			})
		);
		expect(() =>
			collectInventory({
				repositoryRoot: incompatibleSemanticSourceQueryReportCommand,
				requireJpwbPopulations: true
			})
		).toThrow(
			'Required JPWB assurance command is incompatible: csaa:analyze:semantic-source-query'
		);

		const incompatibleLogicalGraphCompositionReportCommand = fixture();
		write(
			incompatibleLogicalGraphCompositionReportCommand,
			'package.json',
			manifest(['packages/*', 'apps/*'], {
				...completeScripts,
				'csaa:analyze:logical-graph-composition': 'bun scripts/wrong-logical-graph-composition.ts'
			})
		);
		expect(() =>
			collectInventory({
				repositoryRoot: incompatibleLogicalGraphCompositionReportCommand,
				requireJpwbPopulations: true
			})
		).toThrow(
			'Required JPWB assurance command is incompatible: csaa:analyze:logical-graph-composition'
		);

		const incompatibleArrowCommandCensusReportCommand = fixture();
		write(
			incompatibleArrowCommandCensusReportCommand,
			'package.json',
			manifest(['packages/*', 'apps/*'], {
				...completeScripts,
				'csaa:analyze:arrow-command-census': 'bun scripts/wrong-arrow-command-census.ts'
			})
		);
		expect(() =>
			collectInventory({
				repositoryRoot: incompatibleArrowCommandCensusReportCommand,
				requireJpwbPopulations: true
			})
		).toThrow('Required JPWB assurance command is incompatible: csaa:analyze:arrow-command-census');

		const incompatibleCommandHandlerGraphReportCommand = fixture();
		write(
			incompatibleCommandHandlerGraphReportCommand,
			'package.json',
			manifest(['packages/*', 'apps/*'], {
				...completeScripts,
				'csaa:analyze:command-handler-graph': 'bun scripts/wrong-command-handler-graph.ts'
			})
		);
		expect(() =>
			collectInventory({
				repositoryRoot: incompatibleCommandHandlerGraphReportCommand,
				requireJpwbPopulations: true
			})
		).toThrow(
			'Required JPWB assurance command is incompatible: csaa:analyze:command-handler-graph'
		);

		const incompatibleCommandDispatchTopologyReportCommand = fixture();
		write(
			incompatibleCommandDispatchTopologyReportCommand,
			'package.json',
			manifest(['packages/*', 'apps/*'], {
				...completeScripts,
				'csaa:analyze:command-dispatch-topology': 'bun scripts/wrong-command-dispatch-topology.ts'
			})
		);
		expect(() =>
			collectInventory({
				repositoryRoot: incompatibleCommandDispatchTopologyReportCommand,
				requireJpwbPopulations: true
			})
		).toThrow(
			'Required JPWB assurance command is incompatible: csaa:analyze:command-dispatch-topology'
		);

		const incompatibleCommandEventContractOverlayReportCommand = fixture();
		write(
			incompatibleCommandEventContractOverlayReportCommand,
			'package.json',
			manifest(['packages/*', 'apps/*'], {
				...completeScripts,
				'csaa:analyze:command-event-contract-overlay':
					'bun scripts/wrong-command-event-contract-overlay.ts'
			})
		);
		expect(() =>
			collectInventory({
				repositoryRoot: incompatibleCommandEventContractOverlayReportCommand,
				requireJpwbPopulations: true
			})
		).toThrow(
			'Required JPWB assurance command is incompatible: csaa:analyze:command-event-contract-overlay'
		);

		const incompatibleGuardEnforcementLedgerReportCommand = fixture();
		write(
			incompatibleGuardEnforcementLedgerReportCommand,
			'package.json',
			manifest(['packages/*', 'apps/*'], {
				...completeScripts,
				'csaa:analyze:guard-enforcement-ledger': 'bun scripts/wrong-guard-enforcement-ledger.ts'
			})
		);
		expect(() =>
			collectInventory({
				repositoryRoot: incompatibleGuardEnforcementLedgerReportCommand,
				requireJpwbPopulations: true
			})
		).toThrow(
			'Required JPWB assurance command is incompatible: csaa:analyze:guard-enforcement-ledger'
		);

		const incompatibleGuardClassificationOverlayReportCommand = fixture();
		write(
			incompatibleGuardClassificationOverlayReportCommand,
			'package.json',
			manifest(['packages/*', 'apps/*'], {
				...completeScripts,
				'csaa:analyze:guard-classification-overlay':
					'bun scripts/wrong-guard-classification-overlay.ts'
			})
		);
		expect(() =>
			collectInventory({
				repositoryRoot: incompatibleGuardClassificationOverlayReportCommand,
				requireJpwbPopulations: true
			})
		).toThrow(
			'Required JPWB assurance command is incompatible: csaa:analyze:guard-classification-overlay'
		);

		const incompatibleCallGraphReportCommand = fixture();
		write(
			incompatibleCallGraphReportCommand,
			'package.json',
			manifest(['packages/*', 'apps/*'], {
				...completeScripts,
				'csaa:analyze:call-graph': 'bun scripts/wrong-call-graph.ts'
			})
		);
		expect(() =>
			collectInventory({
				repositoryRoot: incompatibleCallGraphReportCommand,
				requireJpwbPopulations: true
			})
		).toThrow('Required JPWB assurance command is incompatible: csaa:analyze:call-graph');

		const selectorlessLogicalGraphCompositionSmoke = fixture();
		write(
			selectorlessLogicalGraphCompositionSmoke,
			'package.json',
			manifest(['packages/*', 'apps/*'], {
				...completeScripts,
				'csaa:semantic:smoke:logical-graph-composition':
					LEGACY_LOGICAL_GRAPH_COMPOSITION_SELECTORLESS_SMOKE_COMMAND
			})
		);
		expect(() =>
			collectInventory({
				repositoryRoot: selectorlessLogicalGraphCompositionSmoke,
				requireJpwbPopulations: true
			})
		).toThrow(
			'Required JPWB assurance command is incompatible: csaa:semantic:smoke:logical-graph-composition'
		);

		const incompatibleProjectContextGraphSmoke = fixture();
		write(
			incompatibleProjectContextGraphSmoke,
			'package.json',
			manifest(['packages/*', 'apps/*'], {
				...completeScripts,
				'csaa:semantic:smoke:project-context-graph': LEGACY_STRUCTURAL_FULL_SUITE_SMOKE_COMMAND
			})
		);
		expect(() =>
			collectInventory({
				repositoryRoot: incompatibleProjectContextGraphSmoke,
				requireJpwbPopulations: true
			})
		).toThrow(
			'Required JPWB assurance command is incompatible: csaa:semantic:smoke:project-context-graph'
		);

		const incompatibleProjectContextReportCommand = fixture();
		write(
			incompatibleProjectContextReportCommand,
			'package.json',
			manifest(['packages/*', 'apps/*'], {
				...completeScripts,
				'csaa:analyze:project-context': 'bun run scripts/wrong-project-context.ts'
			})
		);
		expect(() =>
			collectInventory({
				repositoryRoot: incompatibleProjectContextReportCommand,
				requireJpwbPopulations: true
			})
		).toThrow('Required JPWB assurance command is incompatible: csaa:analyze:project-context');

		const incompatibleStructuralSccSmoke = fixture();
		write(
			incompatibleStructuralSccSmoke,
			'package.json',
			manifest(['packages/*', 'apps/*'], {
				...completeScripts,
				'csaa:semantic:smoke:structural-scc': LEGACY_STRUCTURAL_FULL_SUITE_SMOKE_COMMAND
			})
		);
		expect(() =>
			collectInventory({
				repositoryRoot: incompatibleStructuralSccSmoke,
				requireJpwbPopulations: true
			})
		).toThrow(
			'Required JPWB assurance command is incompatible: csaa:semantic:smoke:structural-scc'
		);

		const incompatibleStructuralModuleReachabilitySmoke = fixture();
		write(
			incompatibleStructuralModuleReachabilitySmoke,
			'package.json',
			manifest(['packages/*', 'apps/*'], {
				...completeScripts,
				'csaa:semantic:smoke:structural-module-reachability':
					LEGACY_STRUCTURAL_FULL_SUITE_SMOKE_COMMAND
			})
		);
		expect(() =>
			collectInventory({
				repositoryRoot: incompatibleStructuralModuleReachabilitySmoke,
				requireJpwbPopulations: true
			})
		).toThrow(
			'Required JPWB assurance command is incompatible: csaa:semantic:smoke:structural-module-reachability'
		);

		const incompatibleStaticModuleImpactCandidateReportCommand = fixture();
		write(
			incompatibleStaticModuleImpactCandidateReportCommand,
			'package.json',
			manifest(['packages/*', 'apps/*'], {
				...completeScripts,
				'csaa:analyze:static-module-impact-candidates':
					'bun run scripts/wrong-static-module-impact-candidates.ts'
			})
		);
		expect(() =>
			collectInventory({
				repositoryRoot: incompatibleStaticModuleImpactCandidateReportCommand,
				requireJpwbPopulations: true
			})
		).toThrow(
			'Required JPWB assurance command is incompatible: csaa:analyze:static-module-impact-candidates'
		);

		const incompatibleWorkingSourceEditImpactCandidateReportCommand = fixture();
		write(
			incompatibleWorkingSourceEditImpactCandidateReportCommand,
			'package.json',
			manifest(['packages/*', 'apps/*'], {
				...completeScripts,
				'csaa:analyze:working-source-edit-impact-candidates':
					'bun run scripts/wrong-working-source-edit-impact-candidates.ts'
			})
		);
		expect(() =>
			collectInventory({
				repositoryRoot: incompatibleWorkingSourceEditImpactCandidateReportCommand,
				requireJpwbPopulations: true
			})
		).toThrow(
			'Required JPWB assurance command is incompatible: csaa:analyze:working-source-edit-impact-candidates'
		);

		const incompatibleStructuralModuleReachabilityReportCommand = fixture();
		write(
			incompatibleStructuralModuleReachabilityReportCommand,
			'package.json',
			manifest(['packages/*', 'apps/*'], {
				...completeScripts,
				'csaa:analyze:structural-module-reachability':
					'bun run scripts/wrong-structural-module-reachability.ts'
			})
		);
		expect(() =>
			collectInventory({
				repositoryRoot: incompatibleStructuralModuleReachabilityReportCommand,
				requireJpwbPopulations: true
			})
		).toThrow(
			'Required JPWB assurance command is incompatible: csaa:analyze:structural-module-reachability'
		);

		const noSemanticImplementation = fixture();
		write(noSemanticImplementation, 'package.json', manifest(['packages/*', 'apps/*']));
		expect(() =>
			collectInventory({ repositoryRoot: noSemanticImplementation, requireJpwbPopulations: true })
		).toThrow(
			'Required JPWB TypeScript semantic implementation source is absent: packages/csaa/src/contracts/semantic.ts'
		);
	}, 120_000);

	it('rejects a missing arrow-command adapter provenance path after all prior populations pass', () => {
		const root = fixture();
		write(
			root,
			'package.json',
			JSON.stringify({
				name: 'janumi-professional-workbench',
				private: true,
				scripts: Object.fromEntries(
					[
						'boundary',
						'check-types',
						'gate',
						'gate:fast',
						'lint',
						'test',
						'test:coverage',
						'csaa:semantic:smoke:conditional-export-resolution',
						'csaa:semantic:smoke:declaration-context-analysis',
						'csaa:analyze:declaration-context',
						'csaa:semantic:smoke:source-origin-correlation',
						'csaa:semantic:smoke:module-resolution-trace',
						'csaa:analyze:arrow-command-census',
						'csaa:analyze:command-handler-graph',
						'csaa:analyze:semantic-source-query',
						'csaa:analyze:command-dispatch-topology',
						'csaa:analyze:command-event-contract-overlay',
						'csaa:analyze:guard-enforcement-ledger',
						'csaa:analyze:guard-classification-overlay',
						'csaa:analyze:call-graph',
						'csaa:analyze:state-machine-graph',
						'csaa:analyze:module-dependency',
						'csaa:analyze:logical-graph-composition',
						'csaa:analyze:module-resolution-trace',
						'csaa:semantic:smoke:command-event-contract',
						'csaa:semantic:smoke:guard-classification',
						'csaa:semantic:smoke:logical-graph-composition',
						'csaa:analyze:project-context',
						'csaa:analyze:read-write-access',
						'csaa:semantic:smoke:project-context-graph',
						'csaa:semantic:smoke:structural-module-reachability',
						'csaa:analyze:static-module-impact-candidates',
						'csaa:analyze:working-source-edit-impact-candidates',
						'csaa:analyze:structural-module-reachability',
						'csaa:semantic:smoke:structural-scc'
					].map((name) => [name, jpwbFixtureScriptCommand(name)])
				),
				workspaces: ['packages/*', 'apps/*']
			})
		);
		write(
			root,
			'packages/csaa/package.json',
			JSON.stringify({ name: '@janumipwb/csaa', private: true, version: '0.0.0' })
		);
		write(
			root,
			'packages/rph-domain/package.json',
			JSON.stringify({ name: '@janumipwb/rph-domain', private: true, version: '0.0.0' })
		);
		const semanticPaths = [
			'packages/csaa/src/contracts/semantic.ts',
			'packages/csaa/src/providers/typescript/compiler-input-journal.ts',
			'packages/csaa/src/providers/typescript/extract-static-raw.ts',
			'packages/csaa/src/providers/typescript/frozen-compiler-host.ts',
			'packages/csaa/src/semantic/build-static-semantic-snapshot.ts',
			'packages/csaa/src/semantic/monotonic-operation-clock.ts',
			'packages/csaa/src/providers/typescript/extract-symbols.ts',
			'packages/csaa/src/semantic/raw-semantic-model.ts',
			'packages/csaa/src/semantic/normalize-semantic-snapshot.ts',
			'packages/csaa/src/semantic/validate-snapshot.ts',
			'packages/csaa/src/providers/typescript/extract-types.ts'
		];
		const arrowPaths = [
			'packages/csaa/src/contracts/arrow-command-census.ts',
			'packages/csaa/src/providers/jpwb-arrow-command-census/arrow-command-census-content.ts',
			'packages/csaa/src/providers/jpwb-arrow-command-census/artifact-set.ts',
			'packages/csaa/src/providers/jpwb-arrow-command-census/executor-environment.ts',
			'packages/csaa/src/providers/jpwb-arrow-command-census/normalize-arrow-command-census.ts',
			'packages/csaa/src/providers/jpwb-arrow-command-census/observe-arrow-command-census.ts',
			'packages/csaa/src/providers/jpwb-arrow-command-census/parse-worker-output.ts',
			'packages/csaa/src/providers/jpwb-arrow-command-census/validate-arrow-command-census.ts',
			'packages/csaa/src/providers/jpwb-arrow-command-census/worker.ts',
			...ARROW_COMMAND_CENSUS_RETAINED_VERIFIER_PATHS
		];
		const readWritePaths = [
			'packages/csaa/src/contracts/read-write-access-graph.ts',
			'packages/csaa/src/graph/build-read-write-access-graph.ts',
			'packages/csaa/src/graph/read-write-access-graph-canonical.ts',
			'packages/csaa/src/graph/validate-read-write-access-graph.ts'
		];
		const commandHandlerPaths = [
			'packages/csaa/src/contracts/command-handler-graph.ts',
			'packages/csaa/src/graph/build-command-handler-graph.ts',
			'packages/csaa/src/graph/command-handler-graph-canonical.ts',
			'packages/csaa/src/graph/validate-command-handler-graph.ts'
		];
		const commandDispatchPaths = [
			'packages/csaa/src/contracts/command-dispatch-topology.ts',
			'packages/csaa/src/graph/build-command-dispatch-topology.ts',
			'packages/csaa/src/graph/command-dispatch-topology-canonical.ts',
			'packages/csaa/src/graph/validate-command-dispatch-topology.ts',
			'verif/command-dispatch-census.test.ts'
		];
		for (const path of [
			...semanticPaths,
			...readWritePaths,
			...MODULE_DEPENDENCY_REPORT_PROVENANCE,
			...SEMANTIC_SOURCE_QUERY_PROVENANCE,
			...CALL_GRAPH_REPORT_PROVENANCE,
			...LOGICAL_GRAPH_COMPOSITION_REPORT_PROVENANCE,
			...STATE_MACHINE_GRAPH_REPORT_PROVENANCE,
			...ARROW_COMMAND_CENSUS_REPORT_PROVENANCE,
			...COMMAND_HANDLER_GRAPH_REPORT_PROVENANCE,
			...COMMAND_DISPATCH_TOPOLOGY_REPORT_PROVENANCE,
			...GUARD_ENFORCEMENT_LEDGER_REPORT_PROVENANCE,
			...GUARD_CLASSIFICATION_OVERLAY_REPORT_PROVENANCE,
			...COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROVENANCE,
			...READ_WRITE_ACCESS_REPORT_PROVENANCE,
			...commandHandlerPaths,
			...commandDispatchPaths,
			...arrowPaths
		])
			write(root, path, path.endsWith('.json') ? '{}\n' : 'export {};\n');

		const missing =
			'packages/csaa/src/providers/jpwb-arrow-command-census/observe-arrow-command-census.ts';
		rmSync(join(root, ...missing.split('/')));
		expect(() => collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })).toThrow(
			`Required JPWB arrow-command census implementation or retained-authority artifact is absent: ${missing}`
		);
	});

	it('rejects a missing read/write access graph provenance path after semantic populations pass', () => {
		const root = fixture();
		write(
			root,
			'package.json',
			JSON.stringify({
				name: 'janumi-professional-workbench',
				private: true,
				scripts: Object.fromEntries(
					[
						'boundary',
						'check-types',
						'gate',
						'gate:fast',
						'lint',
						'test',
						'test:coverage',
						'csaa:semantic:smoke:conditional-export-resolution',
						'csaa:semantic:smoke:declaration-context-analysis',
						'csaa:analyze:declaration-context',
						'csaa:semantic:smoke:source-origin-correlation',
						'csaa:semantic:smoke:module-resolution-trace',
						'csaa:analyze:arrow-command-census',
						'csaa:analyze:command-handler-graph',
						'csaa:analyze:semantic-source-query',
						'csaa:analyze:command-dispatch-topology',
						'csaa:analyze:command-event-contract-overlay',
						'csaa:analyze:guard-enforcement-ledger',
						'csaa:analyze:guard-classification-overlay',
						'csaa:analyze:call-graph',
						'csaa:analyze:module-dependency',
						'csaa:analyze:logical-graph-composition',
						'csaa:analyze:module-resolution-trace',
						'csaa:semantic:smoke:command-event-contract',
						'csaa:semantic:smoke:guard-classification',
						'csaa:semantic:smoke:logical-graph-composition',
						'csaa:analyze:project-context',
						'csaa:analyze:read-write-access',
						'csaa:semantic:smoke:project-context-graph',
						'csaa:semantic:smoke:structural-module-reachability',
						'csaa:analyze:static-module-impact-candidates',
						'csaa:analyze:working-source-edit-impact-candidates',
						'csaa:analyze:structural-module-reachability',
						'csaa:semantic:smoke:structural-scc'
					].map((name) => [name, jpwbFixtureScriptCommand(name)])
				),
				workspaces: ['packages/*', 'apps/*']
			})
		);
		write(
			root,
			'packages/csaa/package.json',
			JSON.stringify({ name: '@janumipwb/csaa', private: true, version: '0.0.0' })
		);
		const requiredPaths = [
			'packages/csaa/src/contracts/semantic.ts',
			'packages/csaa/src/providers/typescript/compiler-input-journal.ts',
			'packages/csaa/src/providers/typescript/extract-static-raw.ts',
			'packages/csaa/src/providers/typescript/frozen-compiler-host.ts',
			'packages/csaa/src/semantic/build-static-semantic-snapshot.ts',
			'packages/csaa/src/semantic/monotonic-operation-clock.ts',
			'packages/csaa/src/providers/typescript/extract-symbols.ts',
			'packages/csaa/src/semantic/raw-semantic-model.ts',
			'packages/csaa/src/semantic/normalize-semantic-snapshot.ts',
			'packages/csaa/src/semantic/validate-snapshot.ts',
			'packages/csaa/src/providers/typescript/extract-types.ts',
			...MODULE_DEPENDENCY_REPORT_PROVENANCE,
			...SEMANTIC_SOURCE_QUERY_PROVENANCE,
			...CALL_GRAPH_REPORT_PROVENANCE,
			...LOGICAL_GRAPH_COMPOSITION_REPORT_PROVENANCE,
			'packages/csaa/src/contracts/read-write-access-graph.ts',
			'packages/csaa/src/graph/build-read-write-access-graph.ts',
			'packages/csaa/src/graph/read-write-access-graph-canonical.ts',
			'packages/csaa/src/graph/validate-read-write-access-graph.ts'
		];
		for (const path of requiredPaths) write(root, path, 'export {};\n');

		const missing = 'packages/csaa/src/graph/validate-read-write-access-graph.ts';
		rmSync(join(root, ...missing.split('/')));
		expect(() => collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })).toThrow(
			`Required JPWB TypeScript read/write access graph implementation source is absent: ${missing}`
		);
	});

	it('rejects a missing guard-ledger provenance path after earlier populations pass', () => {
		const root = fixture();
		write(
			root,
			'package.json',
			JSON.stringify({
				name: 'janumi-professional-workbench',
				private: true,
				scripts: Object.fromEntries(
					[
						'boundary',
						'check-types',
						'gate',
						'gate:fast',
						'lint',
						'test',
						'test:coverage',
						'csaa:semantic:smoke:conditional-export-resolution',
						'csaa:semantic:smoke:declaration-context-analysis',
						'csaa:analyze:declaration-context',
						'csaa:semantic:smoke:source-origin-correlation',
						'csaa:semantic:smoke:module-resolution-trace',
						'csaa:analyze:arrow-command-census',
						'csaa:analyze:command-handler-graph',
						'csaa:analyze:semantic-source-query',
						'csaa:analyze:command-dispatch-topology',
						'csaa:analyze:command-event-contract-overlay',
						'csaa:analyze:guard-enforcement-ledger',
						'csaa:analyze:guard-classification-overlay',
						'csaa:analyze:call-graph',
						'csaa:analyze:module-dependency',
						'csaa:analyze:logical-graph-composition',
						'csaa:analyze:module-resolution-trace',
						'csaa:semantic:smoke:command-event-contract',
						'csaa:semantic:smoke:guard-classification',
						'csaa:semantic:smoke:logical-graph-composition',
						'csaa:analyze:project-context',
						'csaa:analyze:read-write-access',
						'csaa:semantic:smoke:project-context-graph',
						'csaa:semantic:smoke:structural-module-reachability',
						'csaa:analyze:static-module-impact-candidates',
						'csaa:analyze:working-source-edit-impact-candidates',
						'csaa:analyze:structural-module-reachability',
						'csaa:semantic:smoke:structural-scc'
					].map((name) => [name, jpwbFixtureScriptCommand(name)])
				),
				workspaces: ['packages/*', 'apps/*']
			})
		);
		write(
			root,
			'packages/csaa/package.json',
			JSON.stringify({ name: '@janumipwb/csaa', private: true, version: '0.0.0' })
		);
		write(
			root,
			'packages/rph-domain/package.json',
			JSON.stringify({ name: '@janumipwb/rph-domain', private: true, version: '0.0.0' })
		);
		write(
			root,
			'packages/rph-contracts/package.json',
			JSON.stringify({ name: '@janumipwb/rph-contracts', private: true, version: '0.0.0' })
		);
		const requiredPaths = [
			'packages/csaa/src/contracts/semantic.ts',
			'packages/csaa/src/providers/typescript/compiler-input-journal.ts',
			'packages/csaa/src/providers/typescript/extract-static-raw.ts',
			'packages/csaa/src/providers/typescript/frozen-compiler-host.ts',
			'packages/csaa/src/semantic/build-static-semantic-snapshot.ts',
			'packages/csaa/src/semantic/monotonic-operation-clock.ts',
			'packages/csaa/src/providers/typescript/extract-symbols.ts',
			'packages/csaa/src/semantic/raw-semantic-model.ts',
			'packages/csaa/src/semantic/normalize-semantic-snapshot.ts',
			'packages/csaa/src/semantic/validate-snapshot.ts',
			'packages/csaa/src/providers/typescript/extract-types.ts',
			'packages/csaa/src/contracts/read-write-access-graph.ts',
			'packages/csaa/src/graph/build-read-write-access-graph.ts',
			'packages/csaa/src/graph/read-write-access-graph-canonical.ts',
			'packages/csaa/src/graph/validate-read-write-access-graph.ts',
			...MODULE_DEPENDENCY_REPORT_PROVENANCE,
			...SEMANTIC_SOURCE_QUERY_PROVENANCE,
			...CALL_GRAPH_REPORT_PROVENANCE,
			...LOGICAL_GRAPH_COMPOSITION_REPORT_PROVENANCE,
			...STATE_MACHINE_GRAPH_REPORT_PROVENANCE,
			...ARROW_COMMAND_CENSUS_REPORT_PROVENANCE,
			...COMMAND_HANDLER_GRAPH_REPORT_PROVENANCE,
			...COMMAND_DISPATCH_TOPOLOGY_REPORT_PROVENANCE,
			...GUARD_ENFORCEMENT_LEDGER_REPORT_PROVENANCE,
			...GUARD_CLASSIFICATION_OVERLAY_REPORT_PROVENANCE,
			...COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROVENANCE,
			...READ_WRITE_ACCESS_REPORT_PROVENANCE,
			'packages/csaa/src/contracts/command-handler-graph.ts',
			'packages/csaa/src/graph/build-command-handler-graph.ts',
			'packages/csaa/src/graph/command-handler-graph-canonical.ts',
			'packages/csaa/src/graph/validate-command-handler-graph.ts',
			'packages/csaa/src/contracts/command-dispatch-topology.ts',
			'packages/csaa/src/graph/build-command-dispatch-topology.ts',
			'packages/csaa/src/graph/command-dispatch-topology-canonical.ts',
			'packages/csaa/src/graph/validate-command-dispatch-topology.ts',
			'verif/command-dispatch-census.test.ts',
			'packages/csaa/src/contracts/arrow-command-census.ts',
			'packages/csaa/src/providers/jpwb-arrow-command-census/arrow-command-census-content.ts',
			'packages/csaa/src/providers/jpwb-arrow-command-census/artifact-set.ts',
			'packages/csaa/src/providers/jpwb-arrow-command-census/executor-environment.ts',
			'packages/csaa/src/providers/jpwb-arrow-command-census/normalize-arrow-command-census.ts',
			'packages/csaa/src/providers/jpwb-arrow-command-census/observe-arrow-command-census.ts',
			'packages/csaa/src/providers/jpwb-arrow-command-census/parse-worker-output.ts',
			'packages/csaa/src/providers/jpwb-arrow-command-census/validate-arrow-command-census.ts',
			'packages/csaa/src/providers/jpwb-arrow-command-census/worker.ts',
			...ARROW_COMMAND_CENSUS_RETAINED_VERIFIER_PATHS,
			'packages/csaa/src/contracts/guard-enforcement-ledger.ts',
			'packages/csaa/src/providers/jpwb-guard-enforcement-ledger/artifact-set.ts',
			'packages/csaa/src/providers/jpwb-guard-enforcement-ledger/guard-enforcement-ledger-content.ts',
			'packages/csaa/src/providers/jpwb-guard-enforcement-ledger/normalize-guard-enforcement-ledger.ts',
			'packages/csaa/src/providers/jpwb-guard-enforcement-ledger/observe-guard-enforcement-ledger.ts',
			'packages/csaa/src/providers/jpwb-guard-enforcement-ledger/parse-worker-output.ts',
			'packages/csaa/src/providers/jpwb-guard-enforcement-ledger/validate-guard-enforcement-ledger.ts',
			'packages/csaa/src/providers/jpwb-guard-enforcement-ledger/worker.ts',
			// The module that DERIVES capsule membership. It is provenance for the guard-ledger capability even
			// though it lives under subject/, because the Qualification cell now asserts the derivation.
			'packages/csaa/src/subject/analyzer-closure.ts',
			...GUARD_ENFORCEMENT_LEDGER_RETAINED_VERIFIER_PATHS,
			'packages/csaa/src/contracts/guard-classification-overlay.ts',
			'packages/csaa/src/graph/build-guard-classification-overlay.ts',
			'packages/csaa/src/graph/guard-classification-overlay-canonical.ts',
			'packages/csaa/src/graph/validate-guard-classification-overlay.ts',
			'packages/csaa/src/semantic/repository-smoke.test.ts',
			'packages/csaa/src/contracts/command-event-contract-overlay.ts',
			'packages/csaa/src/graph/build-command-event-contract-overlay.ts',
			'packages/csaa/src/graph/command-event-contract-overlay-canonical.ts',
			'packages/csaa/src/graph/validate-command-event-contract-overlay.ts',
			COMMAND_EVENT_CONTRACT_OVERLAY_PROJECT_CONFIG_PATH,
			COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH,
			COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH,
			COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH,
			'packages/csaa/src/contracts/state-machine-graph.ts',
			'packages/csaa/src/graph/build-state-machine-graph.ts',
			'packages/csaa/src/graph/state-machine-graph-content.ts',
			'packages/csaa/src/graph/state-machine-graph-ids.ts',
			'packages/csaa/src/graph/state-machine-graph-input.ts',
			'packages/csaa/src/graph/validate-state-machine-graph.ts',
			'packages/csaa/src/providers/jpwb-state-machines/observe-state-machines.ts',
			'packages/csaa/src/providers/jpwb-state-machines/validate-state-machine-observation.ts',
			'packages/csaa/src/contracts/structural-scc-analysis.ts',
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
			'packages/csaa/src/graph/build-structural-scc-analysis.ts',
			'packages/csaa/src/graph/structural-scc-analysis-canonical.ts',
			'packages/csaa/src/graph/validate-structural-scc-analysis.ts',
			'scripts/csaa-structural-scc.ts',
			'packages/csaa/src/contracts/structural-module-reachability-analysis.ts',
			'packages/csaa/src/graph/build-structural-module-reachability-analysis.ts',
			'packages/csaa/src/graph/structural-module-reachability-analysis-canonical.ts',
			'packages/csaa/src/graph/validate-structural-module-reachability-analysis.ts',
			'packages/csaa/src/graph/build-structural-module-reachability-analysis.test.ts',
			'packages/csaa/src/graph/structural-module-reachability-analysis-coverage.test.ts',
			...STRUCTURAL_MODULE_REACHABILITY_REPORT_PROVENANCE,
			...STATIC_MODULE_IMPACT_CANDIDATE_REPORT_PROVENANCE,
			...WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_PROVENANCE,
			...LOGICAL_GRAPH_COMPOSITION_PROVENANCE,
			...LOGICAL_GRAPH_COMPOSITION_REPORT_PROVENANCE,
			...PROJECT_CONTEXT_GRAPH_PROVENANCE,
			...PROJECT_CONTEXT_REPORT_PROVENANCE,
			...MODULE_DEPENDENCY_REPORT_PROVENANCE,
			...SEMANTIC_SOURCE_QUERY_PROVENANCE,
			...CALL_GRAPH_REPORT_PROVENANCE,
			...ARROW_COMMAND_CENSUS_REPORT_PROVENANCE,
			...COMMAND_HANDLER_GRAPH_REPORT_PROVENANCE,
			...COMMAND_DISPATCH_TOPOLOGY_REPORT_PROVENANCE,
			...GUARD_ENFORCEMENT_LEDGER_REPORT_PROVENANCE,
			...GUARD_CLASSIFICATION_OVERLAY_REPORT_PROVENANCE,
			...COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROVENANCE,
			...READ_WRITE_ACCESS_REPORT_PROVENANCE,
			...CONDITIONAL_EXPORT_RESOLUTION_PROVENANCE,
			...MODULE_RESOLUTION_TRACE_PROVENANCE,
			...MODULE_RESOLUTION_TRACE_REPORT_PROVENANCE,
			...DECLARATION_CONTEXT_ANALYSIS_PROVENANCE,
			...DECLARATION_CONTEXT_REPORT_PROVENANCE,
			...SOURCE_ORIGIN_CORRELATION_PROVENANCE.filter((path) => path !== 'package.json')
		];
		for (const path of requiredPaths)
			write(root, path, path.endsWith('.json') ? '{}\n' : 'export {};\n');

		const missing =
			'packages/csaa/src/providers/jpwb-guard-enforcement-ledger/validate-guard-enforcement-ledger.ts';
		rmSync(join(root, ...missing.split('/')));
		expect(() => collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })).toThrow(
			`Required JPWB guard-enforcement-ledger implementation or retained-authority artifact is absent: ${missing}`
		);

		write(root, missing, 'export {};\n');
		for (const missingArrowCommandCensusReportPath of ARROW_COMMAND_CENSUS_REPORT_PROVENANCE.filter(
			(path) => !CALL_GRAPH_REPORT_PROVENANCE.some((shared) => shared === path)
		)) {
			rmSync(join(root, ...missingArrowCommandCensusReportPath.split('/')));
			expect(() =>
				collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })
			).toThrow(
				`Required JPWB arrow-command census report facade or verification source is absent: ${missingArrowCommandCensusReportPath}`
			);
			write(root, missingArrowCommandCensusReportPath, 'export {};\n');
		}
		for (const missingCommandHandlerGraphReportPath of COMMAND_HANDLER_GRAPH_REPORT_PROVENANCE.filter(
			(path) =>
				!CALL_GRAPH_REPORT_PROVENANCE.some((shared) => shared === path) &&
				!MODULE_DEPENDENCY_REPORT_PROVENANCE.some((shared) => shared === path) &&
				!READ_WRITE_ACCESS_REPORT_PROVENANCE.some((shared) => shared === path)
		)) {
			rmSync(join(root, ...missingCommandHandlerGraphReportPath.split('/')));
			expect(() =>
				collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })
			).toThrow(
				`Required JPWB command-handler graph report facade or verification source is absent: ${missingCommandHandlerGraphReportPath}`
			);
			write(root, missingCommandHandlerGraphReportPath, 'export {};\n');
		}
		for (const missingCommandDispatchTopologyReportPath of COMMAND_DISPATCH_TOPOLOGY_REPORT_PROVENANCE.filter(
			(path) => !COMMAND_HANDLER_GRAPH_REPORT_PROVENANCE.some((shared) => shared === path)
		)) {
			rmSync(join(root, ...missingCommandDispatchTopologyReportPath.split('/')));
			expect(() =>
				collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })
			).toThrow(
				`Required JPWB command-dispatch topology report facade or verification source is absent: ${missingCommandDispatchTopologyReportPath}`
			);
			write(root, missingCommandDispatchTopologyReportPath, 'export {};\n');
		}
		for (const missingGuardEnforcementLedgerReportPath of GUARD_ENFORCEMENT_LEDGER_REPORT_PROVENANCE.filter(
			(path) =>
				path !== GUARD_ENFORCEMENT_LEDGER_REPORT_ANALYZER_DEPENDENCY_PATH &&
				!ARROW_COMMAND_CENSUS_REPORT_PROVENANCE.some((shared) => shared === path)
		)) {
			rmSync(join(root, ...missingGuardEnforcementLedgerReportPath.split('/')));
			expect(() =>
				collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })
			).toThrow(
				`Required JPWB guard-enforcement-ledger report facade or verification source is absent: ${missingGuardEnforcementLedgerReportPath}`
			);
			write(root, missingGuardEnforcementLedgerReportPath, 'export {};\n');
		}
		for (const missingGuardClassificationOverlayReportPath of GUARD_CLASSIFICATION_OVERLAY_REPORT_PROVENANCE.filter(
			(path) =>
				!COMMAND_HANDLER_GRAPH_REPORT_PROVENANCE.some((shared) => shared === path) &&
				!COMMAND_DISPATCH_TOPOLOGY_REPORT_PROVENANCE.some((shared) => shared === path)
		)) {
			rmSync(join(root, ...missingGuardClassificationOverlayReportPath.split('/')));
			expect(() =>
				collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })
			).toThrow(
				`Required JPWB guard-classification overlay report facade or verification source is absent: ${missingGuardClassificationOverlayReportPath}`
			);
			write(
				root,
				missingGuardClassificationOverlayReportPath,
				missingGuardClassificationOverlayReportPath.endsWith('.json') ? '{}\n' : 'export {};\n'
			);
		}
		const missingStateGraph = 'packages/csaa/src/graph/validate-state-machine-graph.ts';
		rmSync(join(root, ...missingStateGraph.split('/')));
		expect(() => collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })).toThrow(
			`Required JPWB state-machine graph implementation source is absent: ${missingStateGraph}`
		);

		write(root, missingStateGraph, 'export {};\n');
		const missingStateGraphReport =
			'packages/csaa/src/application/run-state-machine-graph-report.ts';
		rmSync(join(root, ...missingStateGraphReport.split('/')));
		expect(() => collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })).toThrow(
			`Required JPWB state-machine graph report facade or verification source is absent: ${missingStateGraphReport}`
		);

		write(root, missingStateGraphReport, 'export {};\n');
		const missingCommandEventOverlay =
			'packages/csaa/src/graph/validate-command-event-contract-overlay.ts';
		rmSync(join(root, ...missingCommandEventOverlay.split('/')));
		expect(() => collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })).toThrow(
			`Required JPWB command-event-contract static overlay implementation or exact input is absent: ${missingCommandEventOverlay}`
		);

		write(root, missingCommandEventOverlay, 'export {};\n');
		const missingCommandEventRegistry = COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH;
		rmSync(join(root, ...missingCommandEventRegistry.split('/')));
		expect(() => collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })).toThrow(
			`Required JPWB command-event-contract static overlay implementation or exact input is absent: ${missingCommandEventRegistry}`
		);

		write(root, missingCommandEventRegistry, 'export {};\n');
		const missingCommandEventProject = COMMAND_EVENT_CONTRACT_OVERLAY_PROJECT_CONFIG_PATH;
		rmSync(join(root, ...missingCommandEventProject.split('/')));
		expect(() => collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })).toThrow(
			`Required JPWB command-event-contract static overlay implementation or exact input is absent: ${missingCommandEventProject}`
		);

		write(root, missingCommandEventProject, '{}\n');
		const missingCommandEventInput = COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH;
		rmSync(join(root, ...missingCommandEventInput.split('/')));
		expect(() => collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })).toThrow(
			`Required JPWB command-event-contract static overlay implementation or exact input is absent: ${missingCommandEventInput}`
		);

		write(root, missingCommandEventInput, '{}\n');
		const missingCommandEventCensus = COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH;
		rmSync(join(root, ...missingCommandEventCensus.split('/')));
		expect(() => collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })).toThrow(
			`Required JPWB command-event-contract static overlay implementation or exact input is absent: ${missingCommandEventCensus}`
		);

		write(root, missingCommandEventCensus, 'export {};\n');
		for (const missingCommandEventContractOverlayReportPath of COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROVENANCE.filter(
			(path) =>
				!COMMAND_HANDLER_GRAPH_REPORT_PROVENANCE.some((shared) => shared === path) &&
				!COMMAND_DISPATCH_TOPOLOGY_REPORT_PROVENANCE.some((shared) => shared === path) &&
				!GUARD_CLASSIFICATION_OVERLAY_REPORT_PROVENANCE.some((shared) => shared === path)
		)) {
			rmSync(join(root, ...missingCommandEventContractOverlayReportPath.split('/')));
			expect(() =>
				collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })
			).toThrow(
				`Required JPWB command-event-contract overlay report facade or verification source is absent: ${missingCommandEventContractOverlayReportPath}`
			);
			write(root, missingCommandEventContractOverlayReportPath, 'export {};\n');
		}
		const missingStructuralScc = 'packages/csaa/src/graph/validate-structural-scc-analysis.ts';
		rmSync(join(root, ...missingStructuralScc.split('/')));
		expect(() => collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })).toThrow(
			`Required JPWB structural SCC analysis implementation source is absent: ${missingStructuralScc}`
		);

		write(root, missingStructuralScc, 'export {};\n');
		const missingStructuralModuleReachability =
			'packages/csaa/src/graph/validate-structural-module-reachability-analysis.ts';
		rmSync(join(root, ...missingStructuralModuleReachability.split('/')));
		expect(() => collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })).toThrow(
			`Required JPWB structural module reachability analysis implementation source is absent: ${missingStructuralModuleReachability}`
		);

		write(root, missingStructuralModuleReachability, 'export {};\n');
		for (const missingStructuralModuleReachabilityReportPath of STRUCTURAL_MODULE_REACHABILITY_REPORT_PROVENANCE.filter(
			(path) =>
				!MODULE_DEPENDENCY_REPORT_PROVENANCE.some((shared) => shared === path) &&
				!READ_WRITE_ACCESS_REPORT_PROVENANCE.some((shared) => shared === path) &&
				!STATIC_MODULE_IMPACT_CANDIDATE_REPORT_PROVENANCE.some((shared) => shared === path)
		)) {
			rmSync(join(root, ...missingStructuralModuleReachabilityReportPath.split('/')));
			expect(() =>
				collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })
			).toThrow(
				`Required JPWB structural module reachability report facade or verification source is absent: ${missingStructuralModuleReachabilityReportPath}`
			);
			write(root, missingStructuralModuleReachabilityReportPath, 'export {};\n');
		}
		for (const missingStaticModuleImpactCandidateReportPath of STATIC_MODULE_IMPACT_CANDIDATE_REPORT_PROVENANCE.filter(
			(path) => !STRUCTURAL_MODULE_REACHABILITY_REPORT_PROVENANCE.some((shared) => shared === path)
		)) {
			rmSync(join(root, ...missingStaticModuleImpactCandidateReportPath.split('/')));
			expect(() =>
				collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })
			).toThrow(
				`Required JPWB static module impact-candidate report facade or verification source is absent: ${missingStaticModuleImpactCandidateReportPath}`
			);
			write(root, missingStaticModuleImpactCandidateReportPath, 'export {};\n');
		}
		for (const missingWorkingSourceEditImpactCandidateReportPath of WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_PROVENANCE.filter(
			(path) =>
				path !== 'packages/csaa/src/semantic/monotonic-operation-clock.ts' &&
				!STATIC_MODULE_IMPACT_CANDIDATE_REPORT_PROVENANCE.some((shared) => shared === path)
		)) {
			rmSync(join(root, ...missingWorkingSourceEditImpactCandidateReportPath.split('/')));
			expect(() =>
				collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })
			).toThrow(
				`Required JPWB working-source-edit impact-candidate report facade or verification source is absent: ${missingWorkingSourceEditImpactCandidateReportPath}`
			);
			write(root, missingWorkingSourceEditImpactCandidateReportPath, 'export {};\n');
		}
		for (const missingLogicalGraphCompositionPath of LOGICAL_GRAPH_COMPOSITION_PROVENANCE.filter(
			(path) => path !== 'packages/csaa/src/semantic/repository-smoke.test.ts'
		)) {
			rmSync(join(root, ...missingLogicalGraphCompositionPath.split('/')));
			expect(() =>
				collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })
			).toThrow(
				`Required JPWB logical graph composition implementation or verification source is absent: ${missingLogicalGraphCompositionPath}`
			);
			write(root, missingLogicalGraphCompositionPath, 'export {};\n');
		}
		for (const missingLogicalGraphCompositionReportPath of LOGICAL_GRAPH_COMPOSITION_REPORT_PROVENANCE.filter(
			(path) =>
				!MODULE_DEPENDENCY_REPORT_PROVENANCE.some((shared) => shared === path) &&
				!CALL_GRAPH_REPORT_PROVENANCE.some((shared) => shared === path) &&
				!PROJECT_CONTEXT_REPORT_PROVENANCE.some((shared) => shared === path)
		)) {
			rmSync(join(root, ...missingLogicalGraphCompositionReportPath.split('/')));
			expect(() =>
				collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })
			).toThrow(
				`Required JPWB logical graph composition report facade or verification source is absent: ${missingLogicalGraphCompositionReportPath}`
			);
			write(root, missingLogicalGraphCompositionReportPath, 'export {};\n');
		}
		for (const missingProjectContextGraphPath of PROJECT_CONTEXT_GRAPH_PROVENANCE.filter(
			(path) => path !== 'packages/csaa/src/semantic/repository-smoke.test.ts'
		)) {
			rmSync(join(root, ...missingProjectContextGraphPath.split('/')));
			expect(() =>
				collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })
			).toThrow(
				`Required JPWB project context graph implementation or verification source is absent: ${missingProjectContextGraphPath}`
			);
			write(root, missingProjectContextGraphPath, 'export {};\n');
		}
		for (const missingProjectContextReportPath of PROJECT_CONTEXT_REPORT_PROVENANCE.filter(
			(path) =>
				!MODULE_DEPENDENCY_REPORT_PROVENANCE.some((shared) => shared === path) &&
				!READ_WRITE_ACCESS_REPORT_PROVENANCE.some((shared) => shared === path) &&
				!COMMAND_HANDLER_GRAPH_REPORT_PROVENANCE.some((shared) => shared === path)
		)) {
			rmSync(join(root, ...missingProjectContextReportPath.split('/')));
			expect(() =>
				collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })
			).toThrow(
				`Required JPWB project context report facade or verification source is absent: ${missingProjectContextReportPath}`
			);
			write(
				root,
				missingProjectContextReportPath,
				missingProjectContextReportPath.endsWith('.json') ? '{}\n' : 'export {};\n'
			);
		}
		for (const missingModuleDependencyReportPath of MODULE_DEPENDENCY_REPORT_PROVENANCE.filter(
			(path) => !CALL_GRAPH_REPORT_PROVENANCE.some((shared) => shared === path)
		)) {
			rmSync(join(root, ...missingModuleDependencyReportPath.split('/')));
			expect(() =>
				collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })
			).toThrow(
				`Required JPWB TypeScript module-dependency report facade or verification source is absent: ${missingModuleDependencyReportPath}`
			);
			write(root, missingModuleDependencyReportPath, 'export {};\n');
		}
		for (const missingSemanticSourceQueryPath of SEMANTIC_SOURCE_QUERY_PROVENANCE.filter(
			(path) => !MODULE_DEPENDENCY_REPORT_PROVENANCE.some((shared) => shared === path)
		)) {
			rmSync(join(root, ...missingSemanticSourceQueryPath.split('/')));
			expect(() =>
				collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })
			).toThrow(
				`Required JPWB TypeScript semantic-source query facade or verification source is absent: ${missingSemanticSourceQueryPath}`
			);
			write(root, missingSemanticSourceQueryPath, 'export {};\n');
		}
		for (const missingCallGraphReportPath of CALL_GRAPH_REPORT_PROVENANCE) {
			rmSync(join(root, ...missingCallGraphReportPath.split('/')));
			expect(() =>
				collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })
			).toThrow(
				`Required JPWB TypeScript call-graph report facade or verification source is absent: ${missingCallGraphReportPath}`
			);
			write(root, missingCallGraphReportPath, 'export {};\n');
		}
		for (const missingReadWriteAccessReportPath of READ_WRITE_ACCESS_REPORT_PROVENANCE.filter(
			(path) => !MODULE_DEPENDENCY_REPORT_PROVENANCE.some((shared) => shared === path)
		)) {
			rmSync(join(root, ...missingReadWriteAccessReportPath.split('/')));
			expect(() =>
				collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })
			).toThrow(
				`Required JPWB TypeScript read/write access report facade or verification source is absent: ${missingReadWriteAccessReportPath}`
			);
			write(root, missingReadWriteAccessReportPath, 'export {};\n');
		}
		for (const missingConditionalExportResolutionPath of CONDITIONAL_EXPORT_RESOLUTION_PROVENANCE.filter(
			(path) => path !== 'packages/csaa/src/semantic/repository-smoke.test.ts'
		)) {
			rmSync(join(root, ...missingConditionalExportResolutionPath.split('/')));
			expect(() =>
				collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })
			).toThrow(
				`Required JPWB conditional export resolution implementation or verification source is absent: ${missingConditionalExportResolutionPath}`
			);
			write(root, missingConditionalExportResolutionPath, 'export {};\n');
		}
		for (const missingModuleResolutionTracePath of MODULE_RESOLUTION_TRACE_PROVENANCE.filter(
			(path) =>
				path !== 'packages/csaa/src/providers/typescript/compiler-input-journal.ts' &&
				path !== 'packages/csaa/src/semantic/build-static-semantic-snapshot.ts' &&
				path !== 'packages/csaa/src/semantic/repository-smoke.test.ts' &&
				!STRUCTURAL_MODULE_REACHABILITY_REPORT_PROVENANCE.some((shared) => shared === path) &&
				!MODULE_DEPENDENCY_REPORT_PROVENANCE.some((shared) => shared === path) &&
				!READ_WRITE_ACCESS_REPORT_PROVENANCE.some((shared) => shared === path)
		)) {
			rmSync(join(root, ...missingModuleResolutionTracePath.split('/')));
			expect(() =>
				collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })
			).toThrow(
				`Required JPWB module resolution trace implementation or verification source is absent: ${missingModuleResolutionTracePath}`
			);
			write(root, missingModuleResolutionTracePath, 'export {};\n');
		}
		for (const missingModuleResolutionTraceReportPath of MODULE_RESOLUTION_TRACE_REPORT_PROVENANCE) {
			rmSync(join(root, ...missingModuleResolutionTraceReportPath.split('/')));
			expect(() =>
				collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })
			).toThrow(
				`Required JPWB module resolution trace report facade or verification source is absent: ${missingModuleResolutionTraceReportPath}`
			);
			write(root, missingModuleResolutionTraceReportPath, 'export {};\n');
		}
		for (const missingDeclarationContextAnalysisPath of DECLARATION_CONTEXT_ANALYSIS_PROVENANCE.filter(
			(path) =>
				path !== 'packages/csaa/src/providers/typescript/frozen-compiler-host.ts' &&
				!MODULE_RESOLUTION_TRACE_PROVENANCE.some((shared) => shared === path) &&
				!MODULE_DEPENDENCY_REPORT_PROVENANCE.some((shared) => shared === path) &&
				!READ_WRITE_ACCESS_REPORT_PROVENANCE.some((shared) => shared === path)
		)) {
			rmSync(join(root, ...missingDeclarationContextAnalysisPath.split('/')));
			expect(() =>
				collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })
			).toThrow(
				`Required JPWB declaration context analysis implementation or verification source is absent: ${missingDeclarationContextAnalysisPath}`
			);
			write(root, missingDeclarationContextAnalysisPath, 'export {};\n');
		}
		for (const missingDeclarationContextReportPath of DECLARATION_CONTEXT_REPORT_PROVENANCE.filter(
			(path) =>
				!MODULE_RESOLUTION_TRACE_PROVENANCE.some((shared) => shared === path) &&
				!MODULE_RESOLUTION_TRACE_REPORT_PROVENANCE.some((shared) => shared === path) &&
				!DECLARATION_CONTEXT_ANALYSIS_PROVENANCE.some((shared) => shared === path) &&
				!MODULE_DEPENDENCY_REPORT_PROVENANCE.some((shared) => shared === path) &&
				!READ_WRITE_ACCESS_REPORT_PROVENANCE.some((shared) => shared === path)
		)) {
			rmSync(join(root, ...missingDeclarationContextReportPath.split('/')));
			expect(() =>
				collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })
			).toThrow(
				`Required JPWB declaration context report facade or verification source is absent: ${missingDeclarationContextReportPath}`
			);
			write(root, missingDeclarationContextReportPath, 'export {};\n');
		}
		for (const missingSourceOriginCorrelationPath of SOURCE_ORIGIN_CORRELATION_PROVENANCE.filter(
			(path) =>
				path !== 'package.json' &&
				!DECLARATION_CONTEXT_ANALYSIS_PROVENANCE.some((shared) => shared === path)
		)) {
			rmSync(join(root, ...missingSourceOriginCorrelationPath.split('/')));
			expect(() =>
				collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })
			).toThrow(
				`Required JPWB source origin correlation implementation or verification source is absent: ${missingSourceOriginCorrelationPath}`
			);
			write(root, missingSourceOriginCorrelationPath, 'export {};\n');
		}
		const sharedRepositorySmokePath = 'packages/csaa/src/semantic/repository-smoke.test.ts';
		rmSync(join(root, ...sharedRepositorySmokePath.split('/')));
		expect(() => collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })).toThrow(
			`Required JPWB guard-classification static overlay implementation source is absent: ${sharedRepositorySmokePath}`
		);
	}, 600_000);

	it('discovers every current workspace manifest and every top-level verif TypeScript asset', () => {
		const inventory = collectInventory({ repositoryRoot: ROOT, requireJpwbPopulations: true });
		expect(
			inventory.commands.find(
				(command) =>
					command.owner === '.' &&
					command.name === 'csaa:semantic:smoke:conditional-export-resolution'
			)
		).toMatchObject({
			categories: ['OTHER'],
			command: CONDITIONAL_EXPORT_RESOLUTION_ONLY_SMOKE_COMMAND,
			state: 'CONFIGURED_NOT_RUN'
		});
		expect(
			inventory.commands.find(
				(command) =>
					command.owner === '.' && command.name === 'csaa:semantic:smoke:module-resolution-trace'
			)
		).toMatchObject({
			categories: ['OTHER'],
			command: MODULE_RESOLUTION_TRACE_ONLY_SMOKE_COMMAND,
			state: 'CONFIGURED_NOT_RUN'
		});
		expect(
			inventory.commands.find(
				(command) =>
					command.owner === '.' &&
					command.name === 'csaa:semantic:smoke:declaration-context-analysis'
			)
		).toMatchObject({
			categories: ['OTHER'],
			command: DECLARATION_CONTEXT_ANALYSIS_ONLY_SMOKE_COMMAND,
			state: 'CONFIGURED_NOT_RUN'
		});
		expect(
			inventory.commands.find(
				(command) => command.owner === '.' && command.name === 'csaa:analyze:declaration-context'
			)
		).toMatchObject({
			categories: ['OTHER'],
			command: DECLARATION_CONTEXT_REPORT_COMMAND,
			state: 'CONFIGURED_NOT_RUN'
		});
		expect(
			inventory.commands.find(
				(command) =>
					command.owner === '.' && command.name === 'csaa:semantic:smoke:source-origin-correlation'
			)
		).toMatchObject({
			categories: ['OTHER'],
			command: SOURCE_ORIGIN_CORRELATION_ONLY_SMOKE_COMMAND,
			state: 'CONFIGURED_NOT_RUN'
		});
		expect(
			inventory.commands.find(
				(command) =>
					command.owner === '.' && command.name === 'csaa:semantic:smoke:command-event-contract'
			)
		).toMatchObject({
			categories: ['OTHER'],
			command:
				'CSAA_REPOSITORY_SMOKE=1 CSAA_REPOSITORY_SMOKE_PROFILE=STRUCTURAL CSAA_REPOSITORY_SMOKE_SUITE=COMMAND_HANDLER vitest run --disableConsoleIntercept packages/csaa/src/semantic/repository-smoke.test.ts',
			state: 'CONFIGURED_NOT_RUN'
		});
		expect(
			inventory.commands.find(
				(command) =>
					command.owner === '.' && command.name === 'csaa:semantic:smoke:logical-graph-composition'
			)
		).toMatchObject({
			categories: ['OTHER'],
			command: LOGICAL_GRAPH_COMPOSITION_ONLY_SMOKE_COMMAND,
			state: 'CONFIGURED_NOT_RUN'
		});
		expect(
			inventory.commands.find(
				(command) =>
					command.owner === '.' && command.name === 'csaa:semantic:smoke:project-context-graph'
			)
		).toMatchObject({
			categories: ['OTHER'],
			command: PROJECT_CONTEXT_GRAPH_ONLY_SMOKE_COMMAND,
			state: 'CONFIGURED_NOT_RUN'
		});
		expect(
			inventory.commands.find(
				(command) => command.owner === '.' && command.name === 'csaa:analyze:project-context'
			)
		).toMatchObject({
			categories: ['OTHER'],
			command: PROJECT_CONTEXT_REPORT_COMMAND,
			state: 'CONFIGURED_NOT_RUN'
		});
		expect(
			inventory.commands.find(
				(command) => command.owner === '.' && command.name === 'csaa:analyze:module-dependency'
			)
		).toMatchObject({
			categories: ['OTHER'],
			command: MODULE_DEPENDENCY_REPORT_COMMAND,
			state: 'CONFIGURED_NOT_RUN'
		});
		expect(
			inventory.commands.find(
				(command) => command.owner === '.' && command.name === 'csaa:analyze:semantic-source-query'
			)
		).toMatchObject({
			categories: ['OTHER'],
			command: SEMANTIC_SOURCE_QUERY_REPORT_COMMAND,
			state: 'CONFIGURED_NOT_RUN'
		});
		expect(
			inventory.commands.find(
				(command) =>
					command.owner === '.' && command.name === 'csaa:analyze:logical-graph-composition'
			)
		).toMatchObject({
			categories: ['OTHER'],
			command: LOGICAL_GRAPH_COMPOSITION_REPORT_COMMAND,
			state: 'CONFIGURED_NOT_RUN'
		});
		expect(
			inventory.commands.find(
				(command) => command.owner === '.' && command.name === 'csaa:analyze:arrow-command-census'
			)
		).toMatchObject({
			categories: ['OTHER'],
			command: ARROW_COMMAND_CENSUS_REPORT_COMMAND,
			state: 'CONFIGURED_NOT_RUN'
		});
		expect(
			inventory.commands.find(
				(command) => command.owner === '.' && command.name === 'csaa:analyze:command-handler-graph'
			)
		).toMatchObject({
			categories: ['OTHER'],
			command: COMMAND_HANDLER_GRAPH_REPORT_COMMAND,
			state: 'CONFIGURED_NOT_RUN'
		});
		expect(
			inventory.commands.find(
				(command) =>
					command.owner === '.' && command.name === 'csaa:analyze:command-dispatch-topology'
			)
		).toMatchObject({
			categories: ['OTHER'],
			command: COMMAND_DISPATCH_TOPOLOGY_REPORT_COMMAND,
			state: 'CONFIGURED_NOT_RUN'
		});
		expect(
			inventory.commands.find(
				(command) =>
					command.owner === '.' && command.name === 'csaa:analyze:command-event-contract-overlay'
			)
		).toMatchObject({
			categories: ['OTHER'],
			command: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_COMMAND,
			state: 'CONFIGURED_NOT_RUN'
		});
		expect(
			inventory.commands.find(
				(command) =>
					command.owner === '.' && command.name === 'csaa:analyze:guard-enforcement-ledger'
			)
		).toMatchObject({
			categories: ['OTHER'],
			command: GUARD_ENFORCEMENT_LEDGER_REPORT_COMMAND,
			state: 'CONFIGURED_NOT_RUN'
		});
		expect(
			inventory.commands.find(
				(command) =>
					command.owner === '.' && command.name === 'csaa:analyze:guard-classification-overlay'
			)
		).toMatchObject({
			categories: ['OTHER'],
			command: GUARD_CLASSIFICATION_OVERLAY_REPORT_COMMAND,
			state: 'CONFIGURED_NOT_RUN'
		});
		expect(
			inventory.commands.find(
				(command) => command.owner === '.' && command.name === 'csaa:analyze:call-graph'
			)
		).toMatchObject({
			categories: ['OTHER'],
			command: CALL_GRAPH_REPORT_COMMAND,
			state: 'CONFIGURED_NOT_RUN'
		});
		expect(
			inventory.commands.find(
				(command) => command.owner === '.' && command.name === 'csaa:analyze:read-write-access'
			)
		).toMatchObject({
			categories: ['OTHER'],
			command: READ_WRITE_ACCESS_REPORT_COMMAND,
			state: 'CONFIGURED_NOT_RUN'
		});
		expect(
			inventory.commands.find(
				(command) =>
					command.owner === '.' && command.name === 'csaa:analyze:module-resolution-trace'
			)
		).toMatchObject({
			categories: ['OTHER'],
			command: MODULE_RESOLUTION_TRACE_REPORT_COMMAND,
			state: 'CONFIGURED_NOT_RUN'
		});
		expect(
			inventory.commands.find(
				(command) =>
					command.owner === '.' &&
					command.name === 'csaa:semantic:smoke:structural-module-reachability'
			)
		).toMatchObject({
			categories: ['OTHER'],
			command: STRUCTURAL_MODULE_REACHABILITY_ONLY_SMOKE_COMMAND,
			state: 'CONFIGURED_NOT_RUN'
		});
		expect(
			inventory.commands.find(
				(command) =>
					command.owner === '.' && command.name === 'csaa:analyze:structural-module-reachability'
			)
		).toMatchObject({
			categories: ['OTHER'],
			command: STRUCTURAL_MODULE_REACHABILITY_REPORT_COMMAND,
			state: 'CONFIGURED_NOT_RUN'
		});
		expect(
			inventory.commands.find(
				(command) =>
					command.owner === '.' && command.name === 'csaa:analyze:static-module-impact-candidates'
			)
		).toMatchObject({
			categories: ['OTHER'],
			command: STATIC_MODULE_IMPACT_CANDIDATE_REPORT_COMMAND,
			state: 'CONFIGURED_NOT_RUN'
		});
		expect(
			inventory.verificationAssets.find(
				(asset) => asset.path === 'scripts/csaa-static-module-impact-candidates.ts'
			)
		).toMatchObject({
			disposition: 'CSAA_NATIVE',
			gateCarriers: ['UNMAPPED'],
			role: 'ANALYZER'
		});
		expect(
			inventory.commands.find(
				(command) =>
					command.owner === '.' &&
					command.name === 'csaa:analyze:working-source-edit-impact-candidates'
			)
		).toMatchObject({
			categories: ['OTHER'],
			command: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_COMMAND,
			state: 'CONFIGURED_NOT_RUN'
		});
		expect(
			inventory.verificationAssets.find(
				(asset) => asset.path === 'scripts/csaa-working-source-edit-impact-candidates.ts'
			)
		).toMatchObject({
			disposition: 'CSAA_NATIVE',
			gateCarriers: ['UNMAPPED'],
			role: 'ANALYZER'
		});
		expect(
			inventory.commands.find(
				(command) =>
					command.owner === '.' && command.name === 'csaa:semantic:smoke:guard-classification'
			)
		).toMatchObject({
			categories: ['OTHER'],
			command:
				'CSAA_REPOSITORY_SMOKE=1 CSAA_REPOSITORY_SMOKE_PROFILE=STRUCTURAL CSAA_REPOSITORY_SMOKE_SUITE=COMMAND_HANDLER vitest run --disableConsoleIntercept packages/csaa/src/semantic/repository-smoke.test.ts',
			state: 'CONFIGURED_NOT_RUN'
		});
		expect(
			inventory.commands.find(
				(command) => command.owner === '.' && command.name === 'csaa:semantic:smoke:structural-scc'
			)
		).toMatchObject({
			categories: ['OTHER'],
			command: STRUCTURAL_SCC_ONLY_SMOKE_COMMAND,
			state: 'CONFIGURED_NOT_RUN'
		});
		expect(inventory.subject.selectedFiles.map((file) => file.path)).toEqual(
			expect.arrayContaining([
				'packages/csaa/src/graph/build-structural-module-reachability-analysis.test.ts',
				'packages/csaa/src/graph/structural-module-reachability-analysis-coverage.test.ts',
				...STRUCTURAL_MODULE_REACHABILITY_REPORT_PROVENANCE,
				...STATIC_MODULE_IMPACT_CANDIDATE_REPORT_PROVENANCE,
				...WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_PROVENANCE,
				'packages/csaa/src/graph/build-structural-scc-analysis.test.ts',
				'packages/csaa/src/graph/structural-scc-analysis-coverage.test.ts',
				'packages/csaa/src/graph/structural-scc-analysis-fixture.test-support.ts',
				...LOGICAL_GRAPH_COMPOSITION_PROVENANCE,
				...LOGICAL_GRAPH_COMPOSITION_REPORT_PROVENANCE,
				...CONDITIONAL_EXPORT_RESOLUTION_PROVENANCE,
				...MODULE_RESOLUTION_TRACE_PROVENANCE,
				...MODULE_RESOLUTION_TRACE_REPORT_PROVENANCE,
				...DECLARATION_CONTEXT_ANALYSIS_PROVENANCE,
				...DECLARATION_CONTEXT_REPORT_PROVENANCE,
				...MODULE_DEPENDENCY_REPORT_PROVENANCE,
				...SEMANTIC_SOURCE_QUERY_PROVENANCE,
				...CALL_GRAPH_REPORT_PROVENANCE,
				...ARROW_COMMAND_CENSUS_REPORT_PROVENANCE,
				...COMMAND_HANDLER_GRAPH_REPORT_PROVENANCE,
				...COMMAND_DISPATCH_TOPOLOGY_REPORT_PROVENANCE,
				...GUARD_ENFORCEMENT_LEDGER_REPORT_PROVENANCE,
				...GUARD_CLASSIFICATION_OVERLAY_REPORT_PROVENANCE,
				...COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROVENANCE,
				...READ_WRITE_ACCESS_REPORT_PROVENANCE,
				...SOURCE_ORIGIN_CORRELATION_PROVENANCE
			])
		);
		const manifestCount = ['packages', 'apps'].reduce(
			(total, base) =>
				total +
				readdirSync(join(ROOT, base), { withFileTypes: true }).filter(
					(entry) => entry.isDirectory() && existsSync(join(ROOT, base, entry.name, 'package.json'))
				).length,
			0
		);
		const verificationAssetCount = readdirSync(join(ROOT, 'verif'), { withFileTypes: true }).filter(
			(entry) => entry.isFile() && entry.name.endsWith('.ts')
		).length;
		expect(inventory.workspaces).toHaveLength(manifestCount);
		const verificationAssets = inventory.verificationAssets.filter((asset) =>
			asset.path.startsWith('verif/')
		);
		expect(verificationAssetCount).toBeGreaterThan(0);
		expect(verificationAssets).toHaveLength(verificationAssetCount);
		expect(verificationAssets.every((asset) => asset.disposition.length > 0)).toBe(true);
		expect(
			verificationAssets.find((asset) => asset.path === 'verif/arrow-command-census.ts')
		).toMatchObject({ disposition: ARROW_COMMAND_CENSUS_INTEGRATION_STRATEGY });
		expect(inventory.dependencyBoundary.analyzedPerimeter).toEqual(['packages']);
		expect(inventory.dependencyBoundary.enforcementPerimeter).toEqual(['apps', 'packages']);
	});
});
