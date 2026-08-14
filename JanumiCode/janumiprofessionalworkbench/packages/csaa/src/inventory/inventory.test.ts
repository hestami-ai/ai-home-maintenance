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
	COMMAND_EVENT_CONTRACT_OVERLAY_PROJECT_CONFIG_PATH,
	COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH,
	COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH,
	COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH
} from '../contracts/command-event-contract-overlay.js';
import {
	GUARD_ENFORCEMENT_LEDGER_ADAPTER_ID,
	GUARD_ENFORCEMENT_LEDGER_INTEGRATION_STRATEGY,
	GUARD_ENFORCEMENT_LEDGER_METHOD,
	GUARD_ENFORCEMENT_LEDGER_RETAINED_VERIFIER_PATHS,
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
const LOGICAL_GRAPH_COMPOSITION_ONLY_SMOKE_COMMAND =
	'CSAA_REPOSITORY_SMOKE=1 CSAA_REPOSITORY_SMOKE_PROFILE=FULL CSAA_REPOSITORY_SMOKE_SUITE=LOGICAL_GRAPH_COMPOSITION vitest run --disableConsoleIntercept packages/csaa/src/semantic/repository-smoke.test.ts';
const PROJECT_CONTEXT_GRAPH_ONLY_SMOKE_COMMAND =
	'CSAA_REPOSITORY_SMOKE=1 CSAA_REPOSITORY_SMOKE_PROFILE=STRUCTURAL CSAA_REPOSITORY_SMOKE_SUITE=PROJECT_CONTEXT_GRAPH vitest run --disableConsoleIntercept packages/csaa/src/semantic/repository-smoke.test.ts';
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

function jpwbFixtureScriptCommand(name: string): string {
	if (name === 'csaa:semantic:smoke:logical-graph-composition') {
		return LOGICAL_GRAPH_COMPOSITION_ONLY_SMOKE_COMMAND;
	}
	if (name === 'csaa:semantic:smoke:project-context-graph') {
		return PROJECT_CONTEXT_GRAPH_ONLY_SMOKE_COMMAND;
	}
	if (name === 'csaa:semantic:smoke:structural-module-reachability') {
		return STRUCTURAL_MODULE_REACHABILITY_ONLY_SMOKE_COMMAND;
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
			'frozen-program-construction',
			'guard-classification-static-overlay',
			'logical-graph-composition',
			'project-context-graph',
			'read-write-access-projection',
			'structural-module-reachability-analysis',
			'structural-scc-analysis'
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
		const commandHandlerCapability = capabilities.get('command-handler-static-projection');
		expect(commandHandlerCapability).toBeDefined();
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
		expect(commandHandlerCapability!.provider).toBe('typescript+jpwb-arrow-command-census-overlay');
		expect(commandHandlerCapability!.state).toBe('PARTIAL');
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
			'capabilities#command-handler-static-projection',
			'capabilities#symbol-table',
			'capabilities#typescript-ast',
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
			'NOT_EXECUTED_BY_CSAA',
			'NOT_INTEGRATED',
			'runtime dispatch',
			'full JAN-CSAA-007/008 conformance remain NOT_CLAIMED'
		])
			expect(commandDispatchCapability!.explanation).toContain(boundary);
		const guardOverlayCapability = capabilities.get('guard-classification-static-overlay');
		expect(guardOverlayCapability).toBeDefined();
		expect(guardOverlayCapability).toMatchObject({
			provider: 'typescript+retained-guard-state-handler-overlay',
			state: 'PARTIAL'
		});
		for (const expectedProvenance of [
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
			...GUARD_ENFORCEMENT_LEDGER_RETAINED_VERIFIER_PATHS
		])
			expect(guardOverlayCapability!.provenance.includes(expectedProvenance)).toBe(true);
		for (const boundary of [
			'without promotion',
			'configured but is not executed by inventory generation',
			'stale retained line numbers',
			'JAN-CSAA-CAP-027 derivation evidence',
			'candidate-only JAN-CSAA-CAP-028 inference evidence',
			'neither invokes nor executes handlers',
			'handler execution',
			'helper citations remain explicit frontiers',
			'runtime enforcement or performability',
			'full JAN-CSAA-007/008 conformance'
		])
			expect(guardOverlayCapability!.explanation).toContain(boundary);
		const commandEventCapability = capabilities.get('command-event-contract-static-overlay');
		expect(commandEventCapability).toMatchObject({
			provider: 'typescript+command-handler-graph+jpwb-event-contract-overlay',
			state: 'PARTIAL'
		});
		for (const expectedProvenance of [
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
			'package.json#/scripts/csaa:semantic:smoke:command-event-contract'
		])
			expect(commandEventCapability!.provenance.includes(expectedProvenance)).toBe(true);
		for (const boundary of [
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
			'full JAN-CSAA-007/008 conformance'
		])
			expect(commandEventCapability!.explanation).toContain(boundary);
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
			'capabilities#dependency-graph',
			'capabilities#symbol-table',
			'capabilities#typescript-ast',
			'packages/csaa/src/contracts/graph.ts',
			'packages/csaa/src/contracts/semantic.ts',
			'packages/csaa/src/contracts/structural-scc-analysis.ts',
			'packages/csaa/src/graph/build-module-dependency-graph.ts',
			'packages/csaa/src/graph/build-structural-scc-analysis.ts',
			'packages/csaa/src/graph/structural-scc-analysis-canonical.ts',
			'packages/csaa/src/graph/validate-graph.ts',
			'packages/csaa/src/graph/validate-structural-scc-analysis.ts',
			'packages/csaa/src/providers/typescript/extract-static-raw.ts',
			'packages/csaa/src/providers/typescript/extract-symbols.ts',
			'packages/csaa/src/semantic/repository-smoke.test.ts',
			'package.json#/scripts/csaa:semantic:smoke:structural-scc'
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
			...STRUCTURAL_SCC_ANALYSIS_NONCLAIMS
		])
			expect(structuralSccCapability!.explanation).toContain(exactBoundary);
		for (const boundary of [
			'independently validated TypeScript module-dependency graph',
			'preserving parallel edges and self-loops',
			'Structural closure is exact only for the selected validated graph',
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
			'package.json#/scripts/csaa:semantic:smoke:structural-module-reachability'
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
			...STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_NONCLAIMS
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
			'dedicated structural module-reachability-only smoke command',
			'CONFIGURED_NOT_RUN by inventory generation'
		])
			expect(structuralModuleReachabilityCapability!.explanation).toContain(boundary);
		const logicalGraphCompositionCapability = capabilities.get('logical-graph-composition');
		expect(logicalGraphCompositionCapability).toMatchObject({
			provider: 'typescript+validated-module-and-call-graph-composition',
			state: 'PARTIAL'
		});
		for (const expectedProvenance of [
			'capabilities#call-graph',
			'capabilities#dependency-graph',
			'capabilities#symbol-table',
			'capabilities#typescript-ast',
			'capabilities#type-graph',
			'package.json#/scripts/csaa:semantic:smoke:logical-graph-composition',
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
			LOGICAL_GRAPH_COMPOSITION_SELECTION.moduleNodePopulation,
			LOGICAL_GRAPH_COMPOSITION_SELECTION.callNodePopulation,
			LOGICAL_GRAPH_COMPOSITION_SELECTION.joinKey,
			LOGICAL_GRAPH_COMPOSITION_SELECTION.crossLinkRelation,
			LOGICAL_GRAPH_COMPOSITION_SELECTION.compositionMode,
			LOGICAL_GRAPH_COMPOSITION_SELECTION.conflictTreatment,
			...LOGICAL_GRAPH_COMPOSITION_SELECTION.consistencyFields,
			...LOGICAL_GRAPH_COMPOSITION_SELECTION.layerOrder,
			...LOGICAL_GRAPH_COMPOSITION_NONCLAIMS
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
			'capabilities#symbol-table',
			'capabilities#typescript-ast',
			'package.json#/scripts/csaa:semantic:smoke:project-context-graph'
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
			...PROJECT_CONTEXT_GRAPH_NONCLAIMS
		])
			expect(projectContextGraphCapability!.explanation).toContain(exactBoundary);
		for (const boundary of [
			'The fifteenth bounded DWP-004 increment',
			'one exact FrozenSubject and one independently validated static semantic snapshot',
			'every declared project reference resolves within the selected project population',
			'outside-selected and unresolved populations are explicitly empty',
			'no additional build, test, browser, SSR, generated, or consumer variant is inferred',
			'dedicated STRUCTURAL-profile project-context-only smoke command',
			'CONFIGURED_NOT_RUN by inventory generation'
		])
			expect(projectContextGraphCapability!.explanation).toContain(boundary);
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
		expect(capabilities.get('dependency-graph')).toMatchObject({
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
				'packages/csaa/src/graph/validate-graph.ts'
			]),
			state: 'PARTIAL'
		});
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
				'packages/csaa/src/graph/validate-call-graph.ts'
			]),
			state: 'PARTIAL'
		});
		expect(callGraphExplanation).toContain(
			'exact structural/lexical ownership within the declared method'
		);
		expect(callGraphExplanation).toContain(
			'Runtime caller and evaluation ownership remain coarsened'
		);
		expect(callGraphExplanation).toContain('not inferred from the structural ownership edge');
		expect(arrowCapability!.provider).toBe(ARROW_COMMAND_CENSUS_ADAPTER_ID);
		for (const expectedProvenance of [
			'packages/csaa/src/contracts/arrow-command-census.ts',
			'packages/csaa/src/providers/jpwb-arrow-command-census/observe-arrow-command-census.ts',
			'packages/csaa/src/providers/jpwb-arrow-command-census/validate-arrow-command-census.ts',
			'verif/arrow-command-census.ts',
			'verif/arrow-command-census.baseline.json'
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
				'packages/csaa/src/graph/validate-read-write-access-graph.ts'
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
		for (const id of ['code-property-graph', 'control-flow', 'data-flow']) {
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
				'packages/csaa/src/contracts/logical-graph-composition.ts',
				'packages/csaa/src/graph/build-logical-graph-composition.ts',
				'packages/csaa/src/graph/validate-logical-graph-composition.ts',
				'packages/csaa/src/contracts/project-context-graph.ts',
				'packages/csaa/src/graph/build-project-context-graph.ts',
				'packages/csaa/src/graph/validate-project-context-graph.ts',
				'packages/csaa/src/contracts/structural-module-reachability-analysis.ts',
				'packages/csaa/src/graph/build-structural-module-reachability-analysis.ts',
				'packages/csaa/src/graph/validate-structural-module-reachability-analysis.ts',
				'packages/csaa/src/contracts/structural-scc-analysis.ts',
				'packages/csaa/src/graph/build-structural-scc-analysis.ts',
				'packages/csaa/src/graph/validate-structural-scc-analysis.ts'
			])
		);
		const semanticBoundary = semanticBoundaryEntry?.statement;
		expect(semanticBoundary).toContain('TS_PROJECT/TS_SYNTAX/TS_SYMBOL/TS_TYPE extraction');
		expect(semanticBoundary).toContain('wall-anchored monotonic operation clock');
		expect(semanticBoundary).toContain(
			'maxDurationMs remains a caller-supplied operation budget and runaway guard'
		);
		expect(semanticBoundary).toContain(
			'not an empirical runtime, expected duration, product ceiling, or SLO'
		);
		expect(semanticBoundary).toContain('first fifteen bounded DWP-004 increments implement');
		expect(semanticBoundary).toContain('a deliberately partial static call graph');
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
			'exact reference-only semanticSourceId composition of independently validated module and call graph layers'
		);
		expect(semanticBoundary).toContain(
			'preserves their identities, coverage, and limitations without constructing a universal code property graph'
		);
		expect(semanticBoundary).toContain(
			'exact FrozenSubject-bound project/program/source context projection with declared project-reference closure and no inferred variants'
		);
		expect(semanticBoundary).toContain(
			"complete only within one independently validated graph and one explicit criterion while carrying that graph's upstream closure and limitations"
		);
		expect(semanticBoundary).toContain('does not execute the retained event-surface gate');
		expect(semanticBoundary).toContain(
			'does not execute the retained event-surface gate or the configured structural SCC, structural module-reachability, logical graph composition, and project context graph smoke commands'
		);
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
				'packages/csaa/src/contracts/structural-scc-analysis.ts',
				'packages/csaa/src/graph/build-structural-scc-analysis.ts',
				'packages/csaa/src/graph/validate-structural-scc-analysis.ts',
				'packages/csaa/src/contracts/logical-graph-composition.ts',
				'packages/csaa/src/graph/build-logical-graph-composition.ts',
				'packages/csaa/src/graph/validate-logical-graph-composition.ts',
				'packages/csaa/src/contracts/project-context-graph.ts',
				'packages/csaa/src/graph/build-project-context-graph.ts',
				'packages/csaa/src/graph/validate-project-context-graph.ts',
				'packages/csaa/src/graph/validate-call-graph.ts'
			])
		});
		expect(verificationAuthority?.statement).toContain(
			'Neither wrapper, any static overlay, partial call graph, structural SCC analysis, structural module reachability analysis, logical graph composition, project context graph, nor generated state-machine topology projection replaces, retires, weakens, or transfers retained authority'
		);
		expect(verificationAuthority?.statement).toContain(
			`structural SCC analysis has graph authority ${STRUCTURAL_SCC_ANALYSIS_GRAPH_AUTHORITY}, authority transfer ${STRUCTURAL_SCC_ANALYSIS_AUTHORITY_TRANSFER}, and gate effect ${STRUCTURAL_SCC_ANALYSIS_GATE_EFFECT}`
		);
		expect(verificationAuthority?.statement).toContain(
			`structural module reachability analysis has graph authority ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_GRAPH_AUTHORITY}, authority transfer ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_AUTHORITY_TRANSFER}, and gate effect ${STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_GATE_EFFECT}`
		);
		expect(verificationAuthority?.statement).toContain(
			`logical graph composition has graph authority ${LOGICAL_GRAPH_COMPOSITION_GRAPH_AUTHORITY}, authority transfer ${LOGICAL_GRAPH_COMPOSITION_AUTHORITY_TRANSFER}, and gate effect ${LOGICAL_GRAPH_COMPOSITION_GATE_EFFECT}`
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
			`Full JAN-CSAA-010 conformance is ${PROJECT_CONTEXT_GRAPH_FULL_JAN_CSAA_010_CONFORMANCE}`
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
				'csaa:semantic:smoke:command-event-contract',
				'csaa:semantic:smoke:guard-classification',
				'csaa:semantic:smoke:logical-graph-composition',
				'csaa:semantic:smoke:project-context-graph',
				'csaa:semantic:smoke:structural-module-reachability',
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

		const noSemanticImplementation = fixture();
		write(noSemanticImplementation, 'package.json', manifest(['packages/*', 'apps/*']));
		expect(() =>
			collectInventory({ repositoryRoot: noSemanticImplementation, requireJpwbPopulations: true })
		).toThrow(
			'Required JPWB TypeScript semantic implementation source is absent: packages/csaa/src/contracts/semantic.ts'
		);
	});

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
						'csaa:semantic:smoke:command-event-contract',
						'csaa:semantic:smoke:guard-classification',
						'csaa:semantic:smoke:logical-graph-composition',
						'csaa:semantic:smoke:project-context-graph',
						'csaa:semantic:smoke:structural-module-reachability',
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
						'csaa:semantic:smoke:command-event-contract',
						'csaa:semantic:smoke:guard-classification',
						'csaa:semantic:smoke:logical-graph-composition',
						'csaa:semantic:smoke:project-context-graph',
						'csaa:semantic:smoke:structural-module-reachability',
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
						'csaa:semantic:smoke:command-event-contract',
						'csaa:semantic:smoke:guard-classification',
						'csaa:semantic:smoke:logical-graph-composition',
						'csaa:semantic:smoke:project-context-graph',
						'csaa:semantic:smoke:structural-module-reachability',
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
			'packages/csaa/src/graph/build-structural-scc-analysis.ts',
			'packages/csaa/src/graph/structural-scc-analysis-canonical.ts',
			'packages/csaa/src/graph/validate-structural-scc-analysis.ts',
			'packages/csaa/src/contracts/structural-module-reachability-analysis.ts',
			'packages/csaa/src/graph/build-structural-module-reachability-analysis.ts',
			'packages/csaa/src/graph/structural-module-reachability-analysis-canonical.ts',
			'packages/csaa/src/graph/validate-structural-module-reachability-analysis.ts',
			'packages/csaa/src/graph/build-structural-module-reachability-analysis.test.ts',
			'packages/csaa/src/graph/structural-module-reachability-analysis-coverage.test.ts',
			...LOGICAL_GRAPH_COMPOSITION_PROVENANCE,
			...PROJECT_CONTEXT_GRAPH_PROVENANCE
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
		const missingStateGraph = 'packages/csaa/src/graph/validate-state-machine-graph.ts';
		rmSync(join(root, ...missingStateGraph.split('/')));
		expect(() => collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })).toThrow(
			`Required JPWB state-machine graph implementation source is absent: ${missingStateGraph}`
		);

		write(root, missingStateGraph, 'export {};\n');
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
		const sharedRepositorySmokePath = 'packages/csaa/src/semantic/repository-smoke.test.ts';
		rmSync(join(root, ...sharedRepositorySmokePath.split('/')));
		expect(() => collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })).toThrow(
			`Required JPWB guard-classification static overlay implementation source is absent: ${sharedRepositorySmokePath}`
		);
	}, 30_000);

	it('discovers every current workspace manifest and every top-level verif TypeScript asset', () => {
		const inventory = collectInventory({ repositoryRoot: ROOT, requireJpwbPopulations: true });
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
				'packages/csaa/src/graph/build-structural-scc-analysis.test.ts',
				'packages/csaa/src/graph/structural-scc-analysis-coverage.test.ts',
				'packages/csaa/src/graph/structural-scc-analysis-fixture.test-support.ts',
				...LOGICAL_GRAPH_COMPOSITION_PROVENANCE
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
	}, 30_000);
});
