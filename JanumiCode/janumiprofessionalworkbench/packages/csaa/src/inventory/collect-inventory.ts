import { basename } from 'node:path';
import ts from 'typescript';
import {
	ARROW_COMMAND_CENSUS_ADAPTER_ID,
	ARROW_COMMAND_CENSUS_INTEGRATION_STRATEGY,
	ARROW_COMMAND_CENSUS_METHOD,
	ARROW_COMMAND_CENSUS_VERIFIER_AUTHORITY
} from '../contracts/arrow-command-census.js';
import {
	COMMAND_EVENT_CONTRACT_OVERLAY_PROJECT_CONFIG_PATH,
	COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH,
	COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH,
	COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH
} from '../contracts/command-event-contract-overlay.js';
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
	GUARD_ENFORCEMENT_LEDGER_ADAPTER_ID,
	GUARD_ENFORCEMENT_LEDGER_INTEGRATION_STRATEGY,
	GUARD_ENFORCEMENT_LEDGER_METHOD,
	GUARD_ENFORCEMENT_LEDGER_VERIFIER_AUTHORITY
} from '../contracts/guard-enforcement-ledger.js';
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
import { readFrozenSubjectArtifact } from '../subject/frozen-store.js';
import { subjectConfigurationPreimage } from '../subject/manifest.js';
import { compareText, sortUniqueBy } from './canonical.js';
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

const TYPESCRIPT_STRUCTURAL_SCC_ANALYSIS_PROVENANCE = [
	'packages/csaa/src/contracts/structural-scc-analysis.ts',
	'packages/csaa/src/graph/build-structural-scc-analysis.ts',
	'packages/csaa/src/graph/structural-scc-analysis-canonical.ts',
	'packages/csaa/src/graph/validate-structural-scc-analysis.ts',
	'packages/csaa/src/semantic/repository-smoke.test.ts'
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

const JPWB_STRUCTURAL_MODULE_REACHABILITY_ONLY_SMOKE_COMMAND =
	'CSAA_REPOSITORY_SMOKE=1 CSAA_REPOSITORY_SMOKE_PROFILE=STRUCTURAL CSAA_REPOSITORY_SMOKE_SUITE=STRUCTURAL_MODULE_REACHABILITY vitest run --disableConsoleIntercept packages/csaa/src/semantic/repository-smoke.test.ts';

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

const TYPESCRIPT_LOGICAL_GRAPH_COMPOSITION_PROVENANCE = [
	'packages/csaa/src/contracts/logical-graph-composition.ts',
	'packages/csaa/src/graph/build-logical-graph-composition.ts',
	'packages/csaa/src/graph/logical-graph-composition-canonical.ts',
	'packages/csaa/src/graph/validate-logical-graph-composition.ts',
	'packages/csaa/src/graph/build-logical-graph-composition.test.ts',
	'packages/csaa/src/graph/logical-graph-composition-coverage.test.ts',
	'packages/csaa/src/semantic/repository-smoke.test.ts'
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

const JPWB_PROJECT_CONTEXT_GRAPH_ONLY_SMOKE_COMMAND =
	'CSAA_REPOSITORY_SMOKE=1 CSAA_REPOSITORY_SMOKE_PROFILE=STRUCTURAL CSAA_REPOSITORY_SMOKE_SUITE=PROJECT_CONTEXT_GRAPH vitest run --disableConsoleIntercept packages/csaa/src/semantic/repository-smoke.test.ts';

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

const JPWB_MODULE_RESOLUTION_TRACE_ONLY_SMOKE_COMMAND =
	'CSAA_REPOSITORY_SMOKE=1 CSAA_REPOSITORY_SMOKE_PROFILE=STRUCTURAL CSAA_REPOSITORY_SMOKE_SUITE=MODULE_RESOLUTION_TRACE vitest run --disableConsoleIntercept packages/csaa/src/semantic/repository-smoke.test.ts';

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

const JPWB_DECLARATION_CONTEXT_ANALYSIS_ONLY_SMOKE_COMMAND =
	'CSAA_REPOSITORY_SMOKE=1 CSAA_REPOSITORY_SMOKE_PROFILE=STRUCTURAL CSAA_REPOSITORY_SMOKE_SUITE=DECLARATION_CONTEXT_ANALYSIS vitest run --disableConsoleIntercept packages/csaa/src/semantic/repository-smoke.test.ts';

const TYPESCRIPT_READ_WRITE_ACCESS_GRAPH_PROVENANCE = [
	'packages/csaa/src/contracts/read-write-access-graph.ts',
	'packages/csaa/src/graph/build-read-write-access-graph.ts',
	'packages/csaa/src/graph/read-write-access-graph-canonical.ts',
	'packages/csaa/src/graph/validate-read-write-access-graph.ts'
] as const;

const JPWB_COMMAND_HANDLER_GRAPH_PROVENANCE = [
	'packages/csaa/src/contracts/command-handler-graph.ts',
	'packages/csaa/src/graph/build-command-handler-graph.ts',
	'packages/csaa/src/graph/command-handler-graph-canonical.ts',
	'packages/csaa/src/graph/validate-command-handler-graph.ts'
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

const JPWB_COMMAND_DISPATCH_TOPOLOGY_PROVENANCE = [
	'packages/csaa/src/contracts/command-dispatch-topology.ts',
	'packages/csaa/src/graph/build-command-dispatch-topology.ts',
	'packages/csaa/src/graph/command-dispatch-topology-canonical.ts',
	'packages/csaa/src/graph/validate-command-dispatch-topology.ts'
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
	'packages/csaa/src/providers/jpwb-arrow-command-census/executor-environment.ts'
] as const;

const JPWB_GUARD_ENFORCEMENT_LEDGER_RETAINED_PROVENANCE = [
	'verif/guard-enforcement-ledger.data.ts',
	'verif/guard-enforcement-ledger.test.ts',
	'verif/guard-enforcement-ledger.ts'
] as const;

const JPWB_GUARD_CLASSIFICATION_OVERLAY_PROVENANCE = [
	'packages/csaa/src/contracts/guard-classification-overlay.ts',
	'packages/csaa/src/graph/build-guard-classification-overlay.ts',
	'packages/csaa/src/graph/guard-classification-overlay-canonical.ts',
	'packages/csaa/src/graph/validate-guard-classification-overlay.ts',
	'packages/csaa/src/semantic/repository-smoke.test.ts'
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

const JPWB_ARROW_COMMAND_CENSUS_PROVENANCE = [
	'packages/csaa/src/contracts/arrow-command-census.ts',
	'packages/csaa/src/providers/jpwb-arrow-command-census/arrow-command-census-content.ts',
	'packages/csaa/src/providers/jpwb-arrow-command-census/artifact-set.ts',
	'packages/csaa/src/providers/jpwb-arrow-command-census/executor-environment.ts',
	'packages/csaa/src/providers/jpwb-arrow-command-census/normalize-arrow-command-census.ts',
	'packages/csaa/src/providers/jpwb-arrow-command-census/observe-arrow-command-census.ts',
	'packages/csaa/src/providers/jpwb-arrow-command-census/parse-worker-output.ts',
	'packages/csaa/src/providers/jpwb-arrow-command-census/validate-arrow-command-census.ts',
	'packages/csaa/src/providers/jpwb-arrow-command-census/worker.ts'
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
	'logical-graph-composition',
	'module-resolution-trace',
	'project-context-graph',
	'read-write-access-projection',
	'structural-module-reachability-analysis',
	'structural-scc-analysis'
] as const;

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

function literalValue(node: ts.Expression): unknown {
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
	if (ts.isNumericLiteral(node)) return Number(node.text);
	if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
	if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
	if (ts.isArrayLiteralExpression(node)) {
		const values = node.elements.map((element) =>
			ts.isSpreadElement(element) ? undefined : literalValue(element as ts.Expression)
		);
		return values.some((value) => value === undefined) ? undefined : values;
	}
	if (ts.isObjectLiteralExpression(node)) {
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
	const unitTests = files
		.filter((file) => /\.test\.[cm]?[jt]sx?$/.test(file.path))
		.map((file) => file.path);
	const e2e = files
		.filter((file) => /(?:\/e2e(?:-live)?\/|\.e2e\.)/.test(file.path))
		.map((file) => file.path);
	const deterministicFiles = e2e.filter((path) => !/(?:\/e2e-live\/|\/live\/|\.live\.)/.test(path));
	const liveFiles = e2e.filter((path) => /(?:\/e2e-live\/|\/live\/|\.live\.)/.test(path));
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
			state: e2e.length > 0 ? 'NOT_RUN' : 'NOT_CONFIGURED'
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
	const executableIndex = commandTokens.findIndex((token) => token === 'depcruise');
	const optionIndex = commandTokens.findIndex(
		(token, index) => index > executableIndex && token.startsWith('-')
	);
	const analyzedPerimeter =
		executableIndex < 0
			? []
			: commandTokens
					.slice(executableIndex + 1, optionIndex < 0 ? commandTokens.length : optionIndex)
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
		const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const version =
			new RegExp(`^\\s*"${escaped}": \\["${escaped}@([^"\\s]+)"`, 'm').exec(text)?.[1] ?? null;
		const configurationPaths: Record<(typeof PROVIDERS)[number][0], readonly string[]> = {
			'@playwright/test': files
				.filter((file) => /playwright\.config\.ts$/.test(file.path))
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
		const gateEvidence: Record<(typeof PROVIDERS)[number][0], readonly string[]> = {
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
		const configured = configurationPaths[name].length > 0;
		const gateWired = gateEvidence[name].length > 0;
		const inventoryIntegrated = name === 'typescript';
		return {
			adapterCapabilities: inventoryIntegrated ? TYPESCRIPT_ADAPTER_CAPABILITIES : [],
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
				...(inventoryIntegrated
					? [
							...TYPESCRIPT_SEMANTIC_PROVENANCE,
							...TYPESCRIPT_MODULE_GRAPH_PROVENANCE,
							...TYPESCRIPT_CALL_GRAPH_PROVENANCE,
							...TYPESCRIPT_LOGICAL_GRAPH_COMPOSITION_PROVENANCE,
							...TYPESCRIPT_PROJECT_CONTEXT_GRAPH_PROVENANCE,
							...TYPESCRIPT_CONDITIONAL_EXPORT_RESOLUTION_PROVENANCE,
							...TYPESCRIPT_MODULE_RESOLUTION_TRACE_PROVENANCE,
							...TYPESCRIPT_DECLARATION_CONTEXT_ANALYSIS_PROVENANCE,
							...TYPESCRIPT_READ_WRITE_ACCESS_GRAPH_PROVENANCE,
							...TYPESCRIPT_STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_PROVENANCE,
							...TYPESCRIPT_STRUCTURAL_SCC_ANALYSIS_PROVENANCE,
							...JPWB_COMMAND_DISPATCH_TOPOLOGY_PROVENANCE,
							...JPWB_COMMAND_EVENT_CONTRACT_OVERLAY_PROVENANCE,
							...JPWB_COMMAND_EVENT_CONTRACT_OVERLAY_INPUT_PROVENANCE,
							...JPWB_COMMAND_HANDLER_GRAPH_PROVENANCE,
							...JPWB_GUARD_CLASSIFICATION_OVERLAY_PROVENANCE
						]
					: [])
			),
			version
		};
	});
}

function verificationAssets(
	subject: FrozenSubject,
	files: readonly SelectedFileRecord[],
	configuredCommands: readonly CommandInventory[]
): VerificationAssetInventory[] {
	const assetPaths = files
		.filter((file) => /^(?:verif|scripts)\/.*\.ts$/.test(file.path))
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
		const isData = path.endsWith('.data.ts');
		const isGuard =
			!isTest && /(?:guard|refusal)/.test(basename(path)) && projectsText.includes(basename(path));
		const isScript = path.startsWith('scripts/');
		const role = isTest
			? 'TEST'
			: isData
				? 'SUPPORT_DATA'
				: isGuard
					? 'RUNTIME_GUARD'
					: isScript
						? 'SCRIPT'
						: 'ANALYZER';
		const associatedBaselines = baselines
			.filter(
				(baseline) =>
					baseline.path.includes(stem) ||
					text.includes(baseline.path) ||
					text.includes(basename(baseline.path))
			)
			.map((baseline) => baseline.path);
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
			if (command.command.includes(path) || command.command.includes(basename(path))) {
				carriers.push(...command.provenance);
			}
		}
		if (!isTest && projectsText.includes(basename(path)))
			carriers.push('vitest.projects.ts#setupFiles');
		if (carriers.length === 0) carriers.push('UNMAPPED');
		const extractionMethod = text.match(/from ['"]typescript['"]|require\(['"]typescript['"]\)/)
			? 'TYPESCRIPT_AST'
			: isTest
				? 'VITEST_EXECUTABLE_ASSERTION'
				: isData
					? 'DECLARED_STATIC_DATA'
					: /\b(?:readFileSync|readdirSync|globSync|readFile)\b/.test(text)
						? 'FILESYSTEM_OR_TEXT'
						: 'IMPORTED_EXECUTABLE_LOGIC';
		return {
			associatedBaselines,
			assertedPopulation: isTest
				? `Executable assertions and imported surfaces declared by ${path}.`
				: extractionMethod === 'TYPESCRIPT_AST'
					? `Repository syntax and declarations selected by ${path} at execution time.`
					: `Repository files, exports, or runtime events selected by ${path} at execution time.`,
			contentSha256: selectedFile.sha256,
			disposition:
				path === 'verif/arrow-command-census.ts'
					? ARROW_COMMAND_CENSUS_INTEGRATION_STRATEGY
					: role === 'ANALYZER'
						? 'WRAP'
						: 'RETAIN_DELEGATED',
			extractionMethod,
			gateCarriers: [...new Set(carriers)].sort(compareText),
			path,
			provenance: [path],
			role
		};
	});
}

function capabilities(): CapabilityInventory[] {
	const unimplemented = [
		'code-property-graph',
		'control-flow',
		'data-flow',
		'runtime-traces',
		'security-query',
		'test-coverage-ingestion'
	];
	return [
		{
			explanation: 'DWP-001 deterministically derives and verifies the repository inventory.',
			id: 'repository-inventory',
			provider: INVENTORY_GENERATOR_ID,
			provenance: ['packages/csaa/src/inventory/collect-inventory.ts'],
			state: 'IMPLEMENTED'
		},
		{
			explanation:
				'The first two bounded DWP-004 increments project every compiler-observed module occurrence into a validated TypeScript module-dependency graph and normalize exact-schema-validated dependency-cruiser 16.10.4 JSON evidence for conservative, context-bound comparison. Provider aggregates never replace compiler occurrence edges; qualified target agreement, unresolved agreement, collapsed corroboration, incomparable scope/context differences, and unqualified observed differences remain distinct. This contract cannot promote a difference to conflict without later validated context-equivalence and closed-perimeter evidence. Manifest dependencies, resolved component instances, inferred or observed runtime dependencies, provider execution, flow, graph algorithms, and cross-Program composition are not implemented by these increments.',
			id: 'dependency-graph',
			provider: 'typescript',
			provenance: [
				...TYPESCRIPT_MODULE_GRAPH_PROVENANCE,
				...TYPESCRIPT_SYMBOL_PROVENANCE,
				...DEPENDENCY_CRUISER_CORROBORATION_PROVENANCE
			],
			state: 'PARTIAL'
		},
		{
			explanation:
				'The third bounded DWP-004 increment enumerates every retained TypeScript CALL, NEW, and TAGGED_TEMPLATE site into a validated graph with exact structural/lexical ownership within the declared method, open compiler-bound callable candidates, and explicit external-dispatch, unresolved, or unsupported frontiers. Runtime caller and evaluation ownership remain coarsened and are not inferred from the structural ownership edge. Invocation-specific resolved signatures, dispatch closure, runtime observations, and all twelve entry-mechanism classes are not yet analyzed, so exact targets, whole-program reachability, dead-code conclusions, and full JAN-CSAA-007 conformance are not claimed.',
			id: 'call-graph',
			provider: 'typescript',
			provenance: [...TYPESCRIPT_CALL_GRAPH_PROVENANCE, ...TYPESCRIPT_SEMANTIC_PROVENANCE],
			state: 'PARTIAL'
		},
		{
			explanation:
				'The fourth bounded DWP-004 increment observes the exact frozen generated JPWB transition table without executing it and projects declared machines, states, legal transitions, guarded-legal restrictions, explicitly illegal transitions, and cross-axis frontiers. It uses implementation-local relation codes because the closed JAN-CSAA-007 registry has no state-machine relation family. This generated-runtime-topology projection does not establish upstream vocabulary authority, command performability, writer/effect coverage, guard enforcement, behavioral reachability, or any specialized verifier-census conclusion; full JAN-CSAA-007 and JAN-CSAA-008 conformance remain NOT_CLAIMED and existing verifier authority remains delegated.',
			id: 'state-machine-graph',
			provider: 'jpwb-generated-transition-table',
			provenance: [...JPWB_STATE_MACHINE_GRAPH_PROVENANCE],
			state: 'PARTIAL'
		},
		{
			explanation: `The fifth bounded DWP-004 increment implements the ${ARROW_COMMAND_CENSUS_INTEGRATION_STRATEGY} strategy through exact adapter ${ARROW_COMMAND_CENSUS_ADAPTER_ID} and method ${ARROW_COMMAND_CENSUS_METHOD}, wrapping the retained JPWB arrow-command census without changing its ${ARROW_COMMAND_CENSUS_VERIFIER_AUTHORITY} verifier authority, oracle, baseline, gate effect, or source implementation. It binds an exact repository FrozenSubject artifact population, independently records the Bun/TypeScript/ULID/Zod executor environment, runs the retained analyzer in an isolated temporary byte capsule, validates post-execution subject and executor integrity, preserves exact raw evidence and baseline comparison, and publishes a canonical partial observation. This is process isolation rather than a hostile-code security sandbox; supported declaration idioms remain those of the retained verifier; runtime performability, handler-registry closure, replacement equivalence, and full JAN-CSAA-007 or JAN-CSAA-008 conformance are NOT_CLAIMED.`,
			id: 'arrow-command-census',
			provider: ARROW_COMMAND_CENSUS_ADAPTER_ID,
			provenance: [
				...JPWB_ARROW_COMMAND_CENSUS_PROVENANCE,
				...JPWB_ARROW_COMMAND_CENSUS_RETAINED_PROVENANCE
			],
			state: 'PARTIAL'
		},
		{
			explanation:
				'The sixth bounded DWP-004 increment derives a validated Program-local read/write access graph from normalized TypeScript reference, declaration, symbol, and assignment facts. It distinguishes reads, writes, and compound/update read-writes; retains deterministic symbol-slot and occurrence identities, forward/reverse indexes, source witnesses, population reconciliation, and explicit type-position, dynamic-element, unresolved, and unsupported frontiers. Implicit bindings, for-in/of targets, delete operations, and write forms absent from the normalized assignment taxonomy are not classified as supported writes. It does not construct control flow, reaching definitions, heap or points-to state, interprocedural flow, taint, or JAN-CSAA-CAP-007 data flow; the broader data-flow capability therefore remains UNIMPLEMENTED.',
			id: 'read-write-access-graph',
			provider: 'typescript',
			provenance: [
				...TYPESCRIPT_READ_WRITE_ACCESS_GRAPH_PROVENANCE,
				...TYPESCRIPT_SYMBOL_PROVENANCE
			],
			state: 'PARTIAL'
		},
		{
			explanation:
				'The seventh bounded DWP-004 increment independently reconciles the normalized JPWB COMMANDS and HANDLERS registry populations, resolves supported direct handler callables, and overlays the exact retained arrow-command site and occurrence populations. Deterministic registry/direct/table facts occupy the JAN-CSAA-CAP-027 derivation lane; shared factory attribution remains candidate evidence in a separate JAN-CSAA-CAP-028 inference lane with explicit frontiers. The implementation does not integrate the separate command-dispatch census or analyze command-bus runtime lookup, guards, effects, events, runtime performability, or full JAN-CSAA-007/008 conformance.',
			id: 'command-handler-static-projection',
			provider: 'typescript+jpwb-arrow-command-census-overlay',
			provenance: [
				...JPWB_COMMAND_HANDLER_GRAPH_PROVENANCE,
				...JPWB_ARROW_COMMAND_CENSUS_PROVENANCE,
				...JPWB_ARROW_COMMAND_CENSUS_RETAINED_PROVENANCE,
				...TYPESCRIPT_STRUCTURAL_SEMANTIC_PROVENANCE,
				'capabilities#arrow-command-census',
				'capabilities#symbol-table',
				'capabilities#typescript-ast'
			],
			state: 'PARTIAL'
		},
		{
			explanation:
				'The eighth bounded DWP-004 increment composes a static JPWB command-bus topology overlay over the validated command-handler graph. From normalized TypeScript syntax and symbol facts it binds the selected dispatchStamped COMMANDS lookup, payload-validation call, HANDLERS lookup, missing-handler guard, and handler invocation, then emits candidate-only cross-graph references to the predecessor HANDLER_TARGET population without duplicating registry or handler nodes. The retained command-dispatch census is bound by exact FrozenSubject artifact identity as separately attributed RETAIN_DELEGATED corroboration but is NOT_EXECUTED_BY_CSAA and NOT_INTEGRATED. Cross-Program COMMANDS source/declaration equivalence, control flow, path feasibility, runtime dispatch, runtime performability, replacement equivalence, and full JAN-CSAA-007/008 conformance remain NOT_CLAIMED.',
			id: 'command-dispatch-static-topology',
			provider: 'typescript+command-handler-graph-overlay',
			provenance: [
				...JPWB_COMMAND_DISPATCH_TOPOLOGY_PROVENANCE,
				...JPWB_COMMAND_HANDLER_GRAPH_PROVENANCE,
				...JPWB_COMMAND_DISPATCH_RETAINED_CENSUS_REFERENCE,
				...TYPESCRIPT_STRUCTURAL_SEMANTIC_PROVENANCE,
				'capabilities#command-handler-static-projection',
				'capabilities#symbol-table',
				'capabilities#typescript-ast'
			],
			state: 'PARTIAL'
		},
		{
			explanation: `The ninth bounded DWP-004 increment implements the ${GUARD_ENFORCEMENT_LEDGER_INTEGRATION_STRATEGY} strategy through exact adapter ${GUARD_ENFORCEMENT_LEDGER_ADAPTER_ID} and method ${GUARD_ENFORCEMENT_LEDGER_METHOD}, preserving every retained guarded-arrow occurrence, distinct guard text, ledger classification, enforcement citation, anchor, and audit finding from the JPWB guard-enforcement ledger. It binds exact FrozenSubject artifacts, executes the retained analyzer and data exports in an isolated temporary byte capsule, verifies subject and executor integrity, and publishes deterministic raw and normalized evidence without changing the ${GUARD_ENFORCEMENT_LEDGER_VERIFIER_AUTHORITY} verifier authority, test gate, oracle, baseline, or source implementation. Process isolation is not a hostile-code security sandbox, retained subject initializers may execute inside the capsule, and worker duration/output guards cannot confine an intentionally detached descendant process. Public in-memory exact-shape validation must enumerate already-materialized plain-object keys; maxRecords bounds containers and array entries but is not a transport byte ceiling or an object-key enumeration bound. The retained Vitest authority is identity-bound but NOT_EXECUTED_BY_CSAA. Ledger classifications remain retained repository judgments: this wrapper does not prove guard dominance, reachability, runtime enforcement, command performability, effects, events, persistence behavior, replacement equivalence, or full JAN-CSAA-007/008 conformance.`,
			id: 'guard-enforcement-ledger',
			provider: GUARD_ENFORCEMENT_LEDGER_ADAPTER_ID,
			provenance: [
				...JPWB_GUARD_ENFORCEMENT_LEDGER_PROVENANCE,
				...JPWB_GUARD_ENFORCEMENT_LEDGER_RETAINED_PROVENANCE
			],
			state: 'PARTIAL'
		},
		{
			explanation:
				'The tenth bounded DWP-004 increment composes the validated retained guard-enforcement ledger, generated state-machine observation and graph, retained arrow observation, command-handler graph, one frozen subject, and one structural semantic snapshot. It preserves all guard classifications without promotion; maps every ledger arrow to its exact legal-transition record and complete projected state-edge set; correlates every matching retained declared-command occurrence; and rebinds ENFORCED citations by exact path and unique anchor text instead of stale retained line numbers. Exact direct-handler links remain JAN-CSAA-CAP-027 derivation evidence based only on static AST containment. Shared-factory links remain candidate-only JAN-CSAA-CAP-028 inference evidence, and helper citations remain explicit frontiers. Static correlation neither invokes nor executes handlers. A dedicated structural common-subject smoke command is configured but is not executed by inventory generation. The overlay does not prove handler ownership, handler execution, refusal semantics, CFG dominance, reachability, runtime enforcement or performability, effects, events, persistence, replacement equivalence, or full JAN-CSAA-007/008 conformance.',
			id: 'guard-classification-static-overlay',
			provider: 'typescript+retained-guard-state-handler-overlay',
			provenance: canonicalProvenance(
				...JPWB_GUARD_CLASSIFICATION_OVERLAY_PROVENANCE,
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
				'package.json#/scripts/csaa:semantic:smoke:guard-classification'
			),
			state: 'PARTIAL'
		},
		{
			explanation:
				"The eleventh bounded DWP-004 increment composes the validated command-handler graph, one frozen subject, and one structural semantic snapshot with the exact generated COMMANDS and EVENTS declarations, exact command/event vocabulary artifact, and exact retained event-surface census artifact. It records primary and additional command-declared event links, event payload-schema references, the retained BOUND formula's command-primary and transition-binding contributions, and the dated pinned EMITTED set, while preserving distinct sets and explicit discrepancy frontiers. Exact overlay-originated records occupy the JAN-CSAA-CAP-027 derivation lane; referenced predecessor handler attributions remain visibly exact, candidate, or unresolved without promotion. The overlay's JAN-CSAA-CAP-028 inference lane is present but empty: it adds no candidate relationship or runtime conclusion from a surface discrepancy. The retained event-surface gate remains RETAINED_DELEGATED, NOT_EXECUTED_BY_CSAA, and NOT_INTEGRATED, with no authority, oracle, baseline, or gate change. Static correlation neither invokes nor executes a handler and does not establish handler ownership, event construction or emission, runtime execution or performability, payload compatibility, control-flow feasibility, persistence effects, replacement equivalence, or full JAN-CSAA-007/008 conformance.",
			id: 'command-event-contract-static-overlay',
			provider: 'typescript+command-handler-graph+jpwb-event-contract-overlay',
			provenance: [
				...JPWB_COMMAND_EVENT_CONTRACT_OVERLAY_PROVENANCE,
				...JPWB_COMMAND_EVENT_CONTRACT_OVERLAY_INPUT_PROVENANCE,
				...JPWB_COMMAND_HANDLER_GRAPH_PROVENANCE,
				...JPWB_ARROW_COMMAND_CENSUS_PROVENANCE,
				...JPWB_ARROW_COMMAND_CENSUS_RETAINED_PROVENANCE,
				...TYPESCRIPT_STRUCTURAL_SEMANTIC_PROVENANCE,
				'capabilities#arrow-command-census',
				'capabilities#command-handler-static-projection',
				'capabilities#symbol-table',
				'capabilities#typescript-ast',
				'package.json#/scripts/csaa:semantic:smoke:command-event-contract'
			],
			state: 'PARTIAL'
		},
		{
			explanation: `The twelfth bounded DWP-004 increment applies ${STRUCTURAL_SCC_ANALYSIS_METHOD} to one independently validated TypeScript module-dependency graph and deterministically partitions ${STRUCTURAL_SCC_ANALYSIS_SELECTION.nodePopulation} over ${STRUCTURAL_SCC_ANALYSIS_SELECTION.edgePopulation} in ${STRUCTURAL_SCC_ANALYSIS_SELECTION.direction} direction while preserving parallel edges and self-loops. It publishes canonical component membership, node-to-component indexing, internal-edge attribution, cycle-kind classification, exact population and edge-accounting reconciliation, source-graph identity, semantic-snapshot identity, and explicit upstream-closure status under ${STRUCTURAL_SCC_ANALYSIS_CAPABILITY} with ${STRUCTURAL_SCC_ANALYSIS_CAPABILITY_STATUS} status. Structural closure is exact only for the selected validated graph; graph authority is ${STRUCTURAL_SCC_ANALYSIS_GRAPH_AUTHORITY}, authority transfer is ${STRUCTURAL_SCC_ANALYSIS_AUTHORITY_TRANSFER}, and gate effect is ${STRUCTURAL_SCC_ANALYSIS_GATE_EFFECT}. The dedicated structural SCC-only smoke command is CONFIGURED_NOT_RUN by inventory generation. The published nonclaims are ${STRUCTURAL_SCC_ANALYSIS_NONCLAIMS.join(', ')}. Full JAN-CSAA-007 conformance is ${STRUCTURAL_SCC_ANALYSIS_FULL_JAN_CSAA_007_CONFORMANCE}, and full JAN-CSAA-008 conformance is ${STRUCTURAL_SCC_ANALYSIS_FULL_JAN_CSAA_008_CONFORMANCE}.`,
			id: 'structural-scc-analysis',
			provider: 'typescript+validated-module-dependency-graph-scc',
			provenance: canonicalProvenance(
				...TYPESCRIPT_STRUCTURAL_SCC_ANALYSIS_PROVENANCE,
				...TYPESCRIPT_MODULE_GRAPH_PROVENANCE,
				...TYPESCRIPT_STRUCTURAL_SEMANTIC_PROVENANCE,
				'capabilities#dependency-graph',
				'capabilities#symbol-table',
				'capabilities#typescript-ast',
				'package.json#/scripts/csaa:semantic:smoke:structural-scc'
			),
			state: 'PARTIAL'
		},
		{
			explanation: `The thirteenth bounded DWP-004 increment applies ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_METHOD} to one independently validated TypeScript module-dependency graph and one explicit graph-node criterion in a request-selected FORWARD or REVERSE direction. It deterministically traverses ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION.nodePopulation} over ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION.edgePopulation}, preserves parallel edges under ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION.parallelEdges}, and records ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION.witnessPolicy} parent witnesses, reached-member distances, encountered graph-native resolution-target frontiers, exact population reconciliation, source-graph identity, semantic-snapshot identity, and the carried upstream graph closure and limitations under ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_CAPABILITY} with ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_CAPABILITY_STATUS} status. The analysis is complete-or-unavailable under its budgets: a successful static traversal is NOT_TRUNCATED and structural closure is exact only within that one validated graph and criterion, while upstream closure may remain OPEN. Unvisited nodes have no irrelevance or non-impact meaning. Graph authority is ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_GRAPH_AUTHORITY}, authority transfer is ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_AUTHORITY_TRANSFER}, and gate effect is ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_GATE_EFFECT}. The dedicated structural module-reachability-only smoke command is CONFIGURED_NOT_RUN by inventory generation. The published nonclaims are ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_NONCLAIMS.join(', ')}. Full JAN-CSAA-007 conformance is ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_FULL_JAN_CSAA_007_CONFORMANCE}, and full JAN-CSAA-008 conformance is ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_FULL_JAN_CSAA_008_CONFORMANCE}.`,
			id: 'structural-module-reachability-analysis',
			provider: 'typescript+validated-module-dependency-graph-reachability',
			provenance: canonicalProvenance(
				...TYPESCRIPT_STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_PROVENANCE,
				...TYPESCRIPT_MODULE_GRAPH_PROVENANCE,
				...TYPESCRIPT_STRUCTURAL_SEMANTIC_PROVENANCE,
				'capabilities#dependency-graph',
				'capabilities#symbol-table',
				'capabilities#typescript-ast',
				'package.json#/scripts/csaa:semantic:smoke:structural-module-reachability'
			),
			state: 'PARTIAL'
		},
		{
			explanation: `The fourteenth bounded DWP-004 increment applies ${LOGICAL_GRAPH_COMPOSITION_METHOD} under ${LOGICAL_GRAPH_COMPOSITION_CAPABILITY} with ${LOGICAL_GRAPH_COMPOSITION_CAPABILITY_STATUS} status to one independently validated TypeScript module-dependency graph and one independently validated TypeScript call graph derived from the same frozen semantic snapshot. It performs an exact reference-only semanticSourceId join from ${LOGICAL_GRAPH_COMPOSITION_SELECTION.moduleNodePopulation} to ${LOGICAL_GRAPH_COMPOSITION_SELECTION.callNodePopulation} using ${LOGICAL_GRAPH_COMPOSITION_SELECTION.joinKey}, emitting ${LOGICAL_GRAPH_COMPOSITION_SELECTION.crossLinkRelation} cross-links without copying predecessor nodes or edges. Composition mode is ${LOGICAL_GRAPH_COMPOSITION_SELECTION.compositionMode}; conflicts receive ${LOGICAL_GRAPH_COMPOSITION_SELECTION.conflictTreatment} after exact consistency checks over ${LOGICAL_GRAPH_COMPOSITION_SELECTION.consistencyFields.join(', ')}. The current source population is a total mapping with explicit empty unmatched and conflict populations. Source-layer graph identities, semantic-snapshot identities, coverage, health, epistemic state, closure, and limitations are preserved without promotion; composition is complete only for the declared mapping between ${LOGICAL_GRAPH_COMPOSITION_SELECTION.layerOrder.join(' and ')} layers, not for a universal or materialized code property graph. Graph authority is ${LOGICAL_GRAPH_COMPOSITION_GRAPH_AUTHORITY}, authority transfer is ${LOGICAL_GRAPH_COMPOSITION_AUTHORITY_TRANSFER}, and gate effect is ${LOGICAL_GRAPH_COMPOSITION_GATE_EFFECT}. Freshness is ${LOGICAL_GRAPH_COMPOSITION_FRESHNESS}, and currentness is ${LOGICAL_GRAPH_COMPOSITION_CURRENTNESS}. The dedicated FULL-profile logical-graph-composition-only smoke command is CONFIGURED_NOT_RUN by inventory generation. The published nonclaims are ${LOGICAL_GRAPH_COMPOSITION_NONCLAIMS.join(', ')}. Full JAN-CSAA-009 conformance is ${LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_009_CONFORMANCE}, full JAN-CSAA-007 conformance is ${LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_007_CONFORMANCE}, and full JAN-CSAA-008 conformance is ${LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_008_CONFORMANCE}.`,
			id: 'logical-graph-composition',
			provider: 'typescript+validated-module-and-call-graph-composition',
			provenance: canonicalProvenance(
				...TYPESCRIPT_LOGICAL_GRAPH_COMPOSITION_PROVENANCE,
				...TYPESCRIPT_MODULE_GRAPH_PROVENANCE,
				...TYPESCRIPT_CALL_GRAPH_PROVENANCE,
				...TYPESCRIPT_SEMANTIC_PROVENANCE,
				'capabilities#call-graph',
				'capabilities#dependency-graph',
				'capabilities#symbol-table',
				'capabilities#typescript-ast',
				'capabilities#type-graph',
				'package.json#/scripts/csaa:semantic:smoke:logical-graph-composition'
			),
			state: 'PARTIAL'
		},
		{
			explanation: `The fifteenth bounded DWP-004 increment applies ${PROJECT_CONTEXT_GRAPH_METHOD} under ${PROJECT_CONTEXT_GRAPH_CAPABILITY} with ${PROJECT_CONTEXT_GRAPH_CAPABILITY_STATUS} status to one exact FrozenSubject and one independently validated static semantic snapshot. It projects ${PROJECT_CONTEXT_GRAPH_SELECTION.projectPopulation}, ${PROJECT_CONTEXT_GRAPH_SELECTION.programPopulation}, and ${PROJECT_CONTEXT_GRAPH_SELECTION.sourcePopulation}; emits exact ${PROJECT_CONTEXT_GRAPH_SELECTION.membershipRelations.join(' and ')} membership records; and resolves ${PROJECT_CONTEXT_GRAPH_SELECTION.projectReferencePopulation} by ${PROJECT_CONTEXT_GRAPH_SELECTION.referenceResolutionBasis}. The current predecessor contract proves that every declared project reference resolves within the selected project population, so successful outside-selected and unresolved populations are explicitly empty and reference closure is closed for the validated selected subject. Variant policy is ${PROJECT_CONTEXT_GRAPH_SELECTION.variantPolicy}, and effective configuration is limited to ${PROJECT_CONTEXT_GRAPH_SELECTION.effectiveConfigurationPolicy}; no additional build, test, browser, SSR, generated, or consumer variant is inferred. Graph authority is ${PROJECT_CONTEXT_GRAPH_GRAPH_AUTHORITY}, authority transfer is ${PROJECT_CONTEXT_GRAPH_AUTHORITY_TRANSFER}, gate effect is ${PROJECT_CONTEXT_GRAPH_GATE_EFFECT}, freshness is ${PROJECT_CONTEXT_GRAPH_FRESHNESS}, and currentness is ${PROJECT_CONTEXT_GRAPH_CURRENTNESS}. The dedicated STRUCTURAL-profile project-context-only smoke command is CONFIGURED_NOT_RUN by inventory generation. The published nonclaims are ${PROJECT_CONTEXT_GRAPH_NONCLAIMS.join(', ')}. Full JAN-CSAA-010 conformance is ${PROJECT_CONTEXT_GRAPH_FULL_JAN_CSAA_010_CONFORMANCE}.`,
			id: 'project-context-graph',
			provider: 'typescript+frozen-project-context-projection',
			provenance: canonicalProvenance(
				...TYPESCRIPT_PROJECT_CONTEXT_GRAPH_PROVENANCE,
				...TYPESCRIPT_STRUCTURAL_SEMANTIC_PROVENANCE,
				'capabilities#symbol-table',
				'capabilities#typescript-ast',
				'package.json#/scripts/csaa:semantic:smoke:project-context-graph'
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
			explanation: `The seventeenth bounded DWP-004 increment applies ${MODULE_RESOLUTION_TRACE_METHOD} to a ${MODULE_RESOLUTION_TRACE_CAPABILITY_STATUS} ${MODULE_RESOLUTION_TRACE_CAPABILITY} slice for one exact literal bare workspace-package root IMPORT occurrence after independently validating its FrozenSubject-bound static semantic snapshot, project context graph, and a newly constructed conditional-export predecessor with explicit types condition, NODE platform, and IMPORT mode. The configured smoke criterion is packages/rph-application/src/command-bus.ts importing @janumipwb/rph-contracts, with exact resolved declaration build-output target packages/rph-contracts/dist/index.d.ts and captured target-byte digest and length. It invokes public TypeScript getImpliedNodeFormatForFile, createSourceFile, getModeForUsageLocation, and resolveModuleName against only the exact verified project-scoped in-memory capture; records fresh two-stage ordered callbacks as exact query/observation attempts; derives candidates bijectively only from MODULE_RESOLUTION-stage FILE_EXISTS attempts; and publishes exact importer, resolver configuration, case-sensitivity, condition-membership, capture, selected-target, relation, coverage, and reconciliation witnesses. Successful output is complete-or-unavailable under caller budgets, PARTIAL, and NOT_TRUNCATED. The attached capture capability is in-memory and exact-object-bound: serialization, structured cloning, persistence, and deserialized replay do not carry it. The package root publicly exports buildModuleResolutionTrace and validateModuleResolutionTrace; attachVerifiedCompilerCaptureToStaticSemanticSnapshot, getStaticSemanticSnapshotCompilerProjectInputLookup, validateConstructedModuleResolutionTrace, and the mutable @internal moduleResolutionTraceTypeScriptPublicApi test seam remain trust-bound implementation details and are not package-root exports. The exact selection policy is ${JSON.stringify(MODULE_RESOLUTION_TRACE_SELECTION)}. Resolution authority is ${MODULE_RESOLUTION_TRACE_AUTHORITY}, authority transfer is ${MODULE_RESOLUTION_TRACE_AUTHORITY_TRANSFER}, gate effect is ${MODULE_RESOLUTION_TRACE_GATE_EFFECT}, freshness is ${MODULE_RESOLUTION_TRACE_FRESHNESS}, and currentness is ${MODULE_RESOLUTION_TRACE_CURRENTNESS}. The dedicated STRUCTURAL-profile module-resolution-trace-only smoke command is CONFIGURED_NOT_RUN by inventory generation. The published nonclaims are ${MODULE_RESOLUTION_TRACE_NONCLAIMS.join(', ')}. Full JAN-CSAA-011 conformance is ${MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_011_CONFORMANCE}, full JAN-CSAA-007 conformance is ${MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_007_CONFORMANCE}, and full JAN-CSAA-008 conformance is ${MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_008_CONFORMANCE}.`,
			id: 'module-resolution-trace',
			provider: 'typescript+verified-project-capture-module-resolution-trace',
			provenance: canonicalProvenance(
				...TYPESCRIPT_MODULE_RESOLUTION_TRACE_PROVENANCE,
				'capabilities#conditional-export-resolution',
				'capabilities#project-context-graph',
				'capabilities#symbol-table',
				'capabilities#typescript-ast',
				'package.json#/scripts/csaa:semantic:smoke:module-resolution-trace'
			),
			state: 'PARTIAL'
		},
		{
			explanation: `The bounded DWP-003 semantic-completion increment applies ${DECLARATION_CONTEXT_ANALYSIS_METHOD} to a ${DECLARATION_CONTEXT_ANALYSIS_CAPABILITY_STATUS} ${DECLARATION_CONTEXT_ANALYSIS_CAPABILITY} slice for one exact package-root export name in the ${MODULE_RESOLUTION_TRACE_CAPABILITY} selected WORKSPACE_BUILD_DECLARATION target. It independently validates and binds JAN-CSAA-CAP-001 through the exact FrozenSubject-bound StaticSemanticSnapshot carrier, ${PROJECT_CONTEXT_GRAPH_CAPABILITY}, ${MODULE_RESOLUTION_TRACE_CAPABILITY}, and ${CONDITIONAL_EXPORT_RESOLUTION_CAPABILITY}; CAP-002 declaration and symbol identities are explicitly forbidden inputs. The selected supported slice reconstructs one fresh public-TypeScript Program over the verified project-scoped compiler capture, meters every Program, checker-creation, caller-analysis, and separate declaration-artifact parse input attempt and duplicate PRESENT read byte, inventories every Program source and AST node, completely enumerates the package-root export symbols, accepts only a zero-hop direct root export or one same-root local-only ExportSpecifier without a module specifier whose property name directly identifies the terminal declaration through one public getAliasedSymbol call, and creates an exact byte-bound public createSourceFile parse witness for the selected root declaration artifact. It emits exactly one selected export binding, one terminal checker symbol, the complete same-root terminal declaration set, one declaration artifact, declarations, a zero-or-one merge classification, and exact DECLARES, CONTRIBUTES_TO, and linear MERGES_WITH participation relations. Cross-file declarations or merges, reexports, multi-hop or indirect alias bindings, unsupported declaration kinds, non-declaration or non-WORKSPACE_BUILD_DECLARATION targets, module/global augmentation syntax, ambient-effect syntax, and incompatible predecessors fail closed as unavailable; augmentation and ambient-effect output populations are explicitly empty. Successful output is complete-or-unavailable under caller budgets, ${DECLARATION_CONTEXT_ANALYSIS_CAPABILITY_STATUS}, and NOT_TRUNCATED. The elapsed wall-clock budget brackets synchronous predecessor-validator and public-TypeScript capability calls and fails closed on return, but does not claim preemptive cancellation inside those separately bounded calls. The exact selection policy is ${JSON.stringify(DECLARATION_CONTEXT_ANALYSIS_SELECTION)}. Analysis authority is ${DECLARATION_CONTEXT_ANALYSIS_AUTHORITY}, authority transfer is ${DECLARATION_CONTEXT_ANALYSIS_AUTHORITY_TRANSFER}, gate effect is ${DECLARATION_CONTEXT_ANALYSIS_GATE_EFFECT}, freshness is ${DECLARATION_CONTEXT_ANALYSIS_FRESHNESS}, and currentness is ${DECLARATION_CONTEXT_ANALYSIS_CURRENTNESS}. The package root publicly exports buildDeclarationContextAnalysis and validateDeclarationContextAnalysis; createCompilerProjectProgramSession, createPrevalidatedVerifiedCompilerProjectInputHost, the callback-scoped withAttributedQueryForVerifiedHost borrowed-input path, getStaticSemanticSnapshotCompilerProjectInputLookup, validateConstructedDeclarationContextAnalysis, the immutable per-call @internal validateDeclarationContextAnalysisWithProviderForTesting provider-fault injection entry, the immutable @internal compareDeclarationContextAnalysisCanonicalValuesForTesting comparator probe, the mutable @internal declarationContextAnalysisCompilerProgramCapability and declarationContextAnalysisTypeScriptPublicApi producer test seams, the progress-aware canonicalSemanticJsonWithProgress, canonicalSemanticJsonWitnessWithProgress, canonicalSemanticJsonPrefixedSha256, and compareCanonicalSemanticJsonStrings helpers, and fixture support remain trust-bound implementation details and are not package-root exports. The callback-free one-argument canonicalSemanticJson and canonicalSemanticJsonWitness APIs remain package-root public and byte-compatible. The dedicated STRUCTURAL-profile declaration-context-analysis-only smoke command is CONFIGURED_NOT_RUN by inventory generation. The published nonclaims are ${DECLARATION_CONTEXT_ANALYSIS_NONCLAIMS.join(', ')}. Full JAN-CSAA-013 conformance is ${DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_013_CONFORMANCE}, full JAN-CSAA-007 conformance is ${DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_007_CONFORMANCE}, and full JAN-CSAA-008 conformance is ${DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_008_CONFORMANCE}.`,
			id: 'declaration-context-analysis',
			provider: 'typescript+verified-project-capture-declaration-context-analysis',
			provenance: canonicalProvenance(
				...TYPESCRIPT_DECLARATION_CONTEXT_ANALYSIS_PROVENANCE,
				'capabilities#conditional-export-resolution',
				'capabilities#module-resolution-trace',
				'capabilities#project-context-graph',
				'capabilities#typescript-ast',
				'package.json#/scripts/csaa:semantic:smoke:declaration-context-analysis'
			),
			state: 'PARTIAL'
		},
		...unimplemented.map((id): CapabilityInventory => ({
			explanation:
				'Not implemented by the current bounded DWP-004 graph increments; no control-flow, data-flow, code-property, security, coverage, or runtime graph support is inferred from semantic snapshots, module/call graphs, or installed tools.',
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

function assertJpwbNonVacuity(
	rootManifest: JsonObject,
	workspaces: readonly WorkspaceInventory[],
	files: readonly SelectedFileRecord[],
	assets: readonly VerificationAssetInventory[],
	configuredCommands: readonly CommandInventory[]
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
		'csaa:semantic:smoke:module-resolution-trace',
		'csaa:semantic:smoke:command-event-contract',
		'csaa:semantic:smoke:guard-classification',
		'csaa:semantic:smoke:logical-graph-composition',
		'csaa:semantic:smoke:project-context-graph',
		'csaa:semantic:smoke:structural-module-reachability',
		'csaa:semantic:smoke:structural-scc'
	]) {
		if (!rootNames.has(required))
			throw new Error(`Required JPWB assurance command is absent: ${required}`);
	}
	const conditionalExportResolutionSmokeCommand = configuredCommands.find(
		(entry) =>
			entry.owner === '.' && entry.name === 'csaa:semantic:smoke:conditional-export-resolution'
	);
	if (
		conditionalExportResolutionSmokeCommand?.command !==
		JPWB_CONDITIONAL_EXPORT_RESOLUTION_ONLY_SMOKE_COMMAND
	) {
		throw new Error(
			'Required JPWB assurance command is incompatible: csaa:semantic:smoke:conditional-export-resolution'
		);
	}
	const declarationContextAnalysisSmokeCommand = configuredCommands.find(
		(entry) =>
			entry.owner === '.' && entry.name === 'csaa:semantic:smoke:declaration-context-analysis'
	);
	if (
		declarationContextAnalysisSmokeCommand?.command !==
		JPWB_DECLARATION_CONTEXT_ANALYSIS_ONLY_SMOKE_COMMAND
	) {
		throw new Error(
			'Required JPWB assurance command is incompatible: csaa:semantic:smoke:declaration-context-analysis'
		);
	}
	const moduleResolutionTraceSmokeCommand = configuredCommands.find(
		(entry) => entry.owner === '.' && entry.name === 'csaa:semantic:smoke:module-resolution-trace'
	);
	if (
		moduleResolutionTraceSmokeCommand?.command !== JPWB_MODULE_RESOLUTION_TRACE_ONLY_SMOKE_COMMAND
	) {
		throw new Error(
			'Required JPWB assurance command is incompatible: csaa:semantic:smoke:module-resolution-trace'
		);
	}
	const logicalGraphCompositionSmokeCommand = configuredCommands.find(
		(entry) => entry.owner === '.' && entry.name === 'csaa:semantic:smoke:logical-graph-composition'
	);
	if (
		logicalGraphCompositionSmokeCommand?.command !==
		JPWB_LOGICAL_GRAPH_COMPOSITION_ONLY_SMOKE_COMMAND
	) {
		throw new Error(
			'Required JPWB assurance command is incompatible: csaa:semantic:smoke:logical-graph-composition'
		);
	}
	const projectContextGraphSmokeCommand = configuredCommands.find(
		(entry) => entry.owner === '.' && entry.name === 'csaa:semantic:smoke:project-context-graph'
	);
	if (projectContextGraphSmokeCommand?.command !== JPWB_PROJECT_CONTEXT_GRAPH_ONLY_SMOKE_COMMAND) {
		throw new Error(
			'Required JPWB assurance command is incompatible: csaa:semantic:smoke:project-context-graph'
		);
	}
	const structuralSccSmokeCommand = configuredCommands.find(
		(entry) => entry.owner === '.' && entry.name === 'csaa:semantic:smoke:structural-scc'
	);
	if (structuralSccSmokeCommand?.command !== JPWB_STRUCTURAL_SCC_ONLY_SMOKE_COMMAND) {
		throw new Error(
			'Required JPWB assurance command is incompatible: csaa:semantic:smoke:structural-scc'
		);
	}
	const structuralModuleReachabilitySmokeCommand = configuredCommands.find(
		(entry) =>
			entry.owner === '.' && entry.name === 'csaa:semantic:smoke:structural-module-reachability'
	);
	if (
		structuralModuleReachabilitySmokeCommand?.command !==
		JPWB_STRUCTURAL_MODULE_REACHABILITY_ONLY_SMOKE_COMMAND
	) {
		throw new Error(
			'Required JPWB assurance command is incompatible: csaa:semantic:smoke:structural-module-reachability'
		);
	}
	const selectedPaths = new Set(files.map((file) => file.path));
	for (const required of TYPESCRIPT_SEMANTIC_PROVENANCE) {
		if (!selectedPaths.has(required)) {
			throw new Error(
				`Required JPWB TypeScript semantic implementation source is absent: ${required}`
			);
		}
	}
	for (const required of TYPESCRIPT_READ_WRITE_ACCESS_GRAPH_PROVENANCE) {
		if (!selectedPaths.has(required)) {
			throw new Error(
				`Required JPWB TypeScript read/write access graph implementation source is absent: ${required}`
			);
		}
	}
	for (const required of JPWB_COMMAND_HANDLER_GRAPH_PROVENANCE) {
		if (!selectedPaths.has(required)) {
			throw new Error(
				`Required JPWB command-handler static projection implementation source is absent: ${required}`
			);
		}
	}
	for (const required of [
		...JPWB_COMMAND_DISPATCH_TOPOLOGY_PROVENANCE,
		...JPWB_COMMAND_DISPATCH_RETAINED_CENSUS_REFERENCE
	]) {
		if (!selectedPaths.has(required)) {
			throw new Error(
				`Required JPWB command-dispatch static topology implementation or retained reference is absent: ${required}`
			);
		}
	}
	for (const required of [
		...JPWB_ARROW_COMMAND_CENSUS_PROVENANCE,
		...JPWB_ARROW_COMMAND_CENSUS_RETAINED_PROVENANCE
	]) {
		if (!selectedPaths.has(required)) {
			throw new Error(
				`Required JPWB arrow-command census implementation or retained-authority artifact is absent: ${required}`
			);
		}
	}
	for (const required of [
		...JPWB_GUARD_ENFORCEMENT_LEDGER_PROVENANCE,
		...JPWB_GUARD_ENFORCEMENT_LEDGER_RETAINED_PROVENANCE
	]) {
		if (!selectedPaths.has(required)) {
			throw new Error(
				`Required JPWB guard-enforcement-ledger implementation or retained-authority artifact is absent: ${required}`
			);
		}
	}
	for (const required of JPWB_GUARD_CLASSIFICATION_OVERLAY_PROVENANCE) {
		if (!selectedPaths.has(required)) {
			throw new Error(
				`Required JPWB guard-classification static overlay implementation source is absent: ${required}`
			);
		}
	}
	for (const required of [
		...JPWB_COMMAND_EVENT_CONTRACT_OVERLAY_PROVENANCE,
		...JPWB_COMMAND_EVENT_CONTRACT_OVERLAY_INPUT_PROVENANCE
	]) {
		if (!selectedPaths.has(required)) {
			throw new Error(
				`Required JPWB command-event-contract static overlay implementation or exact input is absent: ${required}`
			);
		}
	}
	for (const required of JPWB_STATE_MACHINE_GRAPH_PROVENANCE) {
		if (!selectedPaths.has(required)) {
			throw new Error(
				`Required JPWB state-machine graph implementation source is absent: ${required}`
			);
		}
	}
	for (const required of TYPESCRIPT_STRUCTURAL_SCC_ANALYSIS_PROVENANCE) {
		if (!selectedPaths.has(required)) {
			throw new Error(
				`Required JPWB structural SCC analysis implementation source is absent: ${required}`
			);
		}
	}
	for (const required of TYPESCRIPT_STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_PROVENANCE) {
		if (!selectedPaths.has(required)) {
			throw new Error(
				`Required JPWB structural module reachability analysis implementation source is absent: ${required}`
			);
		}
	}
	for (const required of TYPESCRIPT_LOGICAL_GRAPH_COMPOSITION_PROVENANCE) {
		if (!selectedPaths.has(required)) {
			throw new Error(
				`Required JPWB logical graph composition implementation or verification source is absent: ${required}`
			);
		}
	}
	for (const required of TYPESCRIPT_PROJECT_CONTEXT_GRAPH_PROVENANCE) {
		if (!selectedPaths.has(required)) {
			throw new Error(
				`Required JPWB project context graph implementation or verification source is absent: ${required}`
			);
		}
	}
	for (const required of TYPESCRIPT_CONDITIONAL_EXPORT_RESOLUTION_PROVENANCE) {
		if (!selectedPaths.has(required)) {
			throw new Error(
				`Required JPWB conditional export resolution implementation or verification source is absent: ${required}`
			);
		}
	}
	for (const required of TYPESCRIPT_MODULE_RESOLUTION_TRACE_PROVENANCE) {
		if (!selectedPaths.has(required)) {
			throw new Error(
				`Required JPWB module resolution trace implementation or verification source is absent: ${required}`
			);
		}
	}
	for (const required of TYPESCRIPT_DECLARATION_CONTEXT_ANALYSIS_PROVENANCE) {
		if (!selectedPaths.has(required)) {
			throw new Error(
				`Required JPWB declaration context analysis implementation or verification source is absent: ${required}`
			);
		}
	}
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
		assertJpwbNonVacuity(rootManifest, workspaces, selectedFiles, assets, configuredCommands);
	}
	const inventory: InventoryDocument = {
		artifactPopulations: artifactPopulations(selectedFiles, resolvedSubject),
		assuranceSurfaces: assuranceSurfaces(resolvedSubject, selectedFiles, configuredCommands),
		capabilities: capabilities(),
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
					...TYPESCRIPT_CALL_GRAPH_PROVENANCE,
					...TYPESCRIPT_LOGICAL_GRAPH_COMPOSITION_PROVENANCE,
					...TYPESCRIPT_PROJECT_CONTEXT_GRAPH_PROVENANCE,
					...TYPESCRIPT_CONDITIONAL_EXPORT_RESOLUTION_PROVENANCE,
					...TYPESCRIPT_MODULE_RESOLUTION_TRACE_PROVENANCE,
					...TYPESCRIPT_DECLARATION_CONTEXT_ANALYSIS_PROVENANCE,
					...TYPESCRIPT_READ_WRITE_ACCESS_GRAPH_PROVENANCE,
					...TYPESCRIPT_STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_PROVENANCE,
					...TYPESCRIPT_STRUCTURAL_SCC_ANALYSIS_PROVENANCE,
					...JPWB_COMMAND_DISPATCH_TOPOLOGY_PROVENANCE,
					...JPWB_COMMAND_EVENT_CONTRACT_OVERLAY_PROVENANCE,
					...JPWB_COMMAND_EVENT_CONTRACT_OVERLAY_INPUT_PROVENANCE,
					...JPWB_COMMAND_HANDLER_GRAPH_PROVENANCE,
					...JPWB_STATE_MACHINE_GRAPH_PROVENANCE,
					...JPWB_ARROW_COMMAND_CENSUS_PROVENANCE,
					...JPWB_GUARD_ENFORCEMENT_LEDGER_PROVENANCE,
					...JPWB_GUARD_CLASSIFICATION_OVERLAY_PROVENANCE,
					...DEPENDENCY_CRUISER_CORROBORATION_PROVENANCE,
					'capabilities#arrow-command-census',
					'capabilities#call-graph',
					'capabilities#command-dispatch-static-topology',
					'capabilities#command-event-contract-static-overlay',
					'capabilities#command-handler-static-projection',
					'capabilities#guard-enforcement-ledger',
					'capabilities#guard-classification-static-overlay',
					'capabilities#dependency-graph',
					'capabilities#logical-graph-composition',
					'capabilities#project-context-graph',
					'capabilities#conditional-export-resolution',
					'capabilities#declaration-context-analysis',
					'capabilities#module-resolution-trace',
					'capabilities#read-write-access-graph',
					'capabilities#state-machine-graph',
					'capabilities#structural-module-reachability-analysis',
					'capabilities#structural-scc-analysis',
					'capabilities#symbol-table',
					'capabilities#typescript-ast',
					'capabilities#type-graph'
				),
				statement:
					"TypeScript compiler roots from DWP-002 are consumed by current DWP-003 frozen Program construction and TS_PROJECT/TS_SYNTAX/TS_SYMBOL/TS_TYPE extraction. Semantic-snapshot duration enforcement uses a wall-anchored monotonic operation clock; maxDurationMs remains a caller-supplied operation budget and runaway guard, not an empirical runtime, expected duration, product ceiling, or SLO. The first seventeen bounded DWP-004 increments implement the validated compiler module-dependency projection, pure exact-schema-validated dependency-cruiser 16.10.4 output normalization and context-bound comparison, a deliberately partial static call graph with total call-site/frontier accounting, an implementation-local generated JPWB state-machine topology projection, an exact FrozenSubject- and executor-bound wrapper around the retained arrow-command census, a Program-local read/write access projection with explicit unsupported frontiers, a static JPWB command-registry-to-handler projection with separately preserved deterministic and candidate attribution lanes, a compositional static command-bus topology overlay with candidate-only references to predecessor handler targets, an exact FrozenSubject- and executor-bound wrapper around the retained guard-enforcement ledger, a compositional static guard-classification overlay that preserves retained judgments while reconciling exact transition, command-occurrence, anchor-containment, candidate factory, and helper-frontier evidence, a static command-event-contract overlay that reconciles generated command declarations and event schemas with exact vocabulary and dated retained event-surface evidence while preserving their distinct meanings, a deterministic structural SCC analysis that exactly partitions the selected independently validated directed module graph while preserving its explicit upstream-closure status, a deterministic static module-reachability traversal that is complete only within one independently validated graph and one explicit criterion while carrying that graph's upstream closure and limitations, an exact reference-only semanticSourceId composition of independently validated module and call graph layers that preserves their identities, coverage, and limitations without constructing a universal code property graph, an exact FrozenSubject-bound project/program/source context projection with declared project-reference closure and no inferred variants, a bounded exact-key conditional-export resolution for one selected frozen workspace package, consumer source and Program, subpath, mode, platform, and ordered condition set with explicit unsupported frontiers, and a bounded exact resolved module-resolution trace for one literal bare workspace-package root import using an in-memory verified project-scoped compiler capture and exact types/NODE/IMPORT conditional-export predecessor. A separate bounded DWP-003 semantic-completion increment implements only one exact zero-hop direct or one-hop same-root local-only package-root export declaration binding in the CAP-011 selected declaration target, with a complete same-root terminal declaration set and explicit empty augmentation and ambient-effect populations. Inventory generation executes or benchmarks none of these analysis providers and does not execute the retained event-surface gate or the configured structural SCC, structural module-reachability, logical graph composition, project context graph, conditional export resolution, module resolution trace, and declaration context analysis smoke commands. Cross-Program symbol or binding reconciliation, project variants beyond frozen ProgramRecipe witnesses, invocation-specific resolved signatures, JAN-CSAA-CAP-011 path-alias or module-resolution surfaces beyond the selected exact resolved-only slice, conditional-export patterns, arrays, package imports maps, external package maps, automatic undeclared loader conditions, broader declaration-file populations, cross-file or cross-Program merge analysis, module or global augmentation analysis, ambient-effect analysis, CAP-002 declaration or symbol consumption by this slice, CAP-023 generated-to-authored lineage, manifest/runtime dependency layers, graph algorithms beyond these bounded SCC and single-criterion module-reachability analyses, graph composition beyond the exact declared two-layer mapping, control-flow and JAN-CSAA-CAP-007 data-flow graphs, generalized state-machine inference, JAN-CSAA-CAP-030 code slicing, runtime guard enforcement, runtime command dispatch, runtime event emission, and runtime command performability remain UNKNOWN or UNIMPLEMENTED."
			},
			{
				provenance: canonicalProvenance(
					...EXISTING_GRAPH_RELEVANT_VERIFICATION_AUTHORITY,
					...JPWB_ARROW_COMMAND_CENSUS_PROVENANCE,
					...JPWB_GUARD_ENFORCEMENT_LEDGER_PROVENANCE,
					...JPWB_GUARD_ENFORCEMENT_LEDGER_RETAINED_PROVENANCE,
					...JPWB_COMMAND_DISPATCH_TOPOLOGY_PROVENANCE,
					...JPWB_COMMAND_EVENT_CONTRACT_OVERLAY_PROVENANCE,
					...JPWB_COMMAND_EVENT_CONTRACT_OVERLAY_INPUT_PROVENANCE,
					...JPWB_COMMAND_HANDLER_GRAPH_PROVENANCE,
					...JPWB_GUARD_CLASSIFICATION_OVERLAY_PROVENANCE,
					...TYPESCRIPT_CALL_GRAPH_PROVENANCE,
					...TYPESCRIPT_LOGICAL_GRAPH_COMPOSITION_PROVENANCE,
					...TYPESCRIPT_PROJECT_CONTEXT_GRAPH_PROVENANCE,
					...TYPESCRIPT_CONDITIONAL_EXPORT_RESOLUTION_PROVENANCE,
					...TYPESCRIPT_MODULE_RESOLUTION_TRACE_PROVENANCE,
					...TYPESCRIPT_DECLARATION_CONTEXT_ANALYSIS_PROVENANCE,
					...TYPESCRIPT_STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_PROVENANCE,
					...TYPESCRIPT_STRUCTURAL_SCC_ANALYSIS_PROVENANCE,
					...JPWB_STATE_MACHINE_GRAPH_PROVENANCE
				),
				statement: [
					'Existing graph-relevant verif censuses remain authoritative for their specialized repository gates.',
					`The arrow-command analyzer's ${ARROW_COMMAND_CENSUS_INTEGRATION_STRATEGY} integration strategy is IMPLEMENTED by bounded CSAA adapter ${ARROW_COMMAND_CENSUS_ADAPTER_ID} using method ${ARROW_COMMAND_CENSUS_METHOD}, while its source, exact baseline, tests, ${ARROW_COMMAND_CENSUS_VERIFIER_AUTHORITY} verifier authority, oracle, and gate effect remain unchanged.`,
					`The guard-enforcement ledger's ${GUARD_ENFORCEMENT_LEDGER_INTEGRATION_STRATEGY} integration strategy is IMPLEMENTED by bounded CSAA adapter ${GUARD_ENFORCEMENT_LEDGER_ADAPTER_ID} using method ${GUARD_ENFORCEMENT_LEDGER_METHOD}; its retained analyzer, data, tests, ${GUARD_ENFORCEMENT_LEDGER_VERIFIER_AUTHORITY} verifier authority, oracle, and gate effect remain unchanged, and its Vitest authority is not executed by CSAA.`,
					'The static command-handler projection independently reconciles COMMANDS and HANDLERS and correlates retained sites.',
					'The compositional command-bus topology overlay references that predecessor graph and binds the retained command-dispatch census artifact by exact identity, but does not execute, normalize, integrate, replace, or infer runtime behavior from that literal-presence proxy.',
					'The static command-event-contract overlay binds the exact vocabulary and retained event-surface artifacts, reproduces only the supported BOUND formula and dated pinned EMITTED declaration, and does not execute or integrate the retained Vitest gate; its RETAINED_DELEGATED authority, oracle, baseline, and gate effect remain unchanged.',
					`The structural SCC analysis has graph authority ${STRUCTURAL_SCC_ANALYSIS_GRAPH_AUTHORITY}, authority transfer ${STRUCTURAL_SCC_ANALYSIS_AUTHORITY_TRANSFER}, and gate effect ${STRUCTURAL_SCC_ANALYSIS_GATE_EFFECT}; it does not change retained verifier authority.`,
					`The structural module reachability analysis has graph authority ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_GRAPH_AUTHORITY}, authority transfer ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_AUTHORITY_TRANSFER}, and gate effect ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_GATE_EFFECT}; it changes no retained verifier authority. Its complete static traversal is bounded to one independently validated graph and one explicit criterion, carries upstream closure, and is not JAN-CSAA-CAP-009 graph composition, JAN-CSAA-CAP-029 semantic query, or JAN-CSAA-CAP-030 code slicing.`,
					`The logical graph composition has graph authority ${LOGICAL_GRAPH_COMPOSITION_GRAPH_AUTHORITY}, authority transfer ${LOGICAL_GRAPH_COMPOSITION_AUTHORITY_TRANSFER}, and gate effect ${LOGICAL_GRAPH_COMPOSITION_GATE_EFFECT}; freshness is ${LOGICAL_GRAPH_COMPOSITION_FRESHNESS}, currentness is ${LOGICAL_GRAPH_COMPOSITION_CURRENTNESS}, and it changes no retained verifier authority. Full JAN-CSAA-009 conformance is ${LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_009_CONFORMANCE}.`,
					`The project context graph has graph authority ${PROJECT_CONTEXT_GRAPH_GRAPH_AUTHORITY}, authority transfer ${PROJECT_CONTEXT_GRAPH_AUTHORITY_TRANSFER}, and gate effect ${PROJECT_CONTEXT_GRAPH_GATE_EFFECT}; freshness is ${PROJECT_CONTEXT_GRAPH_FRESHNESS}, currentness is ${PROJECT_CONTEXT_GRAPH_CURRENTNESS}, and it changes no retained verifier authority. Full JAN-CSAA-010 conformance is ${PROJECT_CONTEXT_GRAPH_FULL_JAN_CSAA_010_CONFORMANCE}.`,
					`The conditional export resolution has resolution authority ${CONDITIONAL_EXPORT_RESOLUTION_AUTHORITY}, authority transfer ${CONDITIONAL_EXPORT_RESOLUTION_AUTHORITY_TRANSFER}, and gate effect ${CONDITIONAL_EXPORT_RESOLUTION_GATE_EFFECT}; freshness is ${CONDITIONAL_EXPORT_RESOLUTION_FRESHNESS}, currentness is ${CONDITIONAL_EXPORT_RESOLUTION_CURRENTNESS}, and it changes no retained verifier authority. Full JAN-CSAA-012 conformance is ${CONDITIONAL_EXPORT_RESOLUTION_FULL_JAN_CSAA_012_CONFORMANCE}.`,
					`The module resolution trace has resolution authority ${MODULE_RESOLUTION_TRACE_AUTHORITY}, authority transfer ${MODULE_RESOLUTION_TRACE_AUTHORITY_TRANSFER}, and gate effect ${MODULE_RESOLUTION_TRACE_GATE_EFFECT}; freshness is ${MODULE_RESOLUTION_TRACE_FRESHNESS}, currentness is ${MODULE_RESOLUTION_TRACE_CURRENTNESS}, and it changes no retained verifier authority. Full JAN-CSAA-011 conformance is ${MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_011_CONFORMANCE}, full JAN-CSAA-007 conformance is ${MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_007_CONFORMANCE}, and full JAN-CSAA-008 conformance is ${MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_008_CONFORMANCE}.`,
					`The declaration context analysis has analysis authority ${DECLARATION_CONTEXT_ANALYSIS_AUTHORITY}, authority transfer ${DECLARATION_CONTEXT_ANALYSIS_AUTHORITY_TRANSFER}, and gate effect ${DECLARATION_CONTEXT_ANALYSIS_GATE_EFFECT}; freshness is ${DECLARATION_CONTEXT_ANALYSIS_FRESHNESS}, currentness is ${DECLARATION_CONTEXT_ANALYSIS_CURRENTNESS}, and it changes no retained verifier authority. Its selected same-root zero-hop direct or one-hop local-only explicit-ExportSpecifier declaration-binding slice is implemented without conferring authority over broader declaration, merge, augmentation, ambient-effect, CAP-002, or CAP-023 surfaces. Full JAN-CSAA-013 conformance is ${DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_013_CONFORMANCE}, full JAN-CSAA-007 conformance is ${DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_007_CONFORMANCE}, and full JAN-CSAA-008 conformance is ${DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_008_CONFORMANCE}.`,
					'The authority-resolution, aggregate-birth, command-dispatch, contract-number, dead-kernel, policy-evidence-requirement, and route-action census families remain delegated and unwrapped; event-surface remains delegated and exact-identity-bound but NOT_EXECUTED_BY_CSAA and NOT_INTEGRATED.',
					'Neither wrapper, any static overlay, partial call graph, structural SCC analysis, structural module reachability analysis, logical graph composition, project context graph, conditional export resolution, module resolution trace, declaration context analysis, nor generated state-machine topology projection replaces, retires, weakens, or transfers retained authority.',
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
				provenance: ['assuranceSurfaces.coverage.outputIdentity'],
				statement:
					'Coverage output identity is UNKNOWN until a coverage adapter explicitly ingests an output.'
			},
			{
				provenance: ['capabilities'],
				statement:
					'Runtime, network, security-query, and external-provider health remain NOT_RUN or UNIMPLEMENTED.'
			}
		],
		verificationAssets: assets,
		workspaces
	};
	return inventory;
}
