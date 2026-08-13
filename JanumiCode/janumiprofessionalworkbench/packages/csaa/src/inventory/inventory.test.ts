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
	GUARD_ENFORCEMENT_LEDGER_ADAPTER_ID,
	GUARD_ENFORCEMENT_LEDGER_INTEGRATION_STRATEGY,
	GUARD_ENFORCEMENT_LEDGER_METHOD,
	GUARD_ENFORCEMENT_LEDGER_RETAINED_VERIFIER_PATHS,
	GUARD_ENFORCEMENT_LEDGER_VERIFIER_AUTHORITY
} from '../contracts/guard-enforcement-ledger.js';
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
			'command-handler-static-projection',
			'frozen-program-construction',
			'read-write-access-projection'
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
				'packages/csaa/src/semantic/validate-snapshot.ts'
			])
		);

		const capabilities = new Map(
			inventory.capabilities.map((capability) => [capability.id, capability])
		);
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
		const semanticBoundary = inventory.unknowns.find((entry) =>
			entry.statement.includes('current DWP-003 frozen Program construction')
		)?.statement;
		expect(semanticBoundary).toContain('TS_PROJECT/TS_SYNTAX/TS_SYMBOL/TS_TYPE extraction');
		expect(semanticBoundary).toContain('wall-anchored monotonic operation clock');
		expect(semanticBoundary).toContain(
			'maxDurationMs remains a caller-supplied operation budget and runaway guard'
		);
		expect(semanticBoundary).toContain(
			'not an empirical runtime, expected duration, product ceiling, or SLO'
		);
		expect(semanticBoundary).toContain('first nine bounded DWP-004 increments implement');
		expect(semanticBoundary).toContain('a deliberately partial static call graph');
		expect(semanticBoundary).toContain(
			'implementation-local generated JPWB state-machine topology'
		);
		expect(semanticBoundary).toContain('wrapper around the retained arrow-command census');
		expect(semanticBoundary).toContain('Program-local read/write access projection');
		expect(semanticBoundary).toContain('static JPWB command-registry-to-handler projection');
		expect(semanticBoundary).toContain('compositional static command-bus topology overlay');
		expect(semanticBoundary).toContain('wrapper around the retained guard-enforcement ledger');
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
				'packages/csaa/src/graph/validate-call-graph.ts'
			])
		});
		expect(verificationAuthority?.statement).toContain(
			'Neither wrapper, either static overlay, partial call graph, nor generated state-machine topology projection replaces, retires, weakens, or transfers retained authority'
		);
		expect(verificationAuthority?.statement).toContain(
			`guard-enforcement ledger's ${GUARD_ENFORCEMENT_LEDGER_INTEGRATION_STRATEGY} integration strategy is IMPLEMENTED`
		);
		expect(verificationAuthority?.statement).toContain(
			'does not execute, normalize, integrate, replace, or infer runtime behavior from that literal-presence proxy'
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
			['boundary', 'check-types', 'gate', 'gate:fast', 'lint', 'test', 'test:coverage'].map(
				(name) => [name, 'true']
			)
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
					['boundary', 'check-types', 'gate', 'gate:fast', 'lint', 'test', 'test:coverage'].map(
						(name) => [name, 'true']
					)
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
					['boundary', 'check-types', 'gate', 'gate:fast', 'lint', 'test', 'test:coverage'].map(
						(name) => [name, 'true']
					)
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
					['boundary', 'check-types', 'gate', 'gate:fast', 'lint', 'test', 'test:coverage'].map(
						(name) => [name, 'true']
					)
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
			...GUARD_ENFORCEMENT_LEDGER_RETAINED_VERIFIER_PATHS
		];
		for (const path of requiredPaths) write(root, path, 'export {};\n');

		const missing =
			'packages/csaa/src/providers/jpwb-guard-enforcement-ledger/validate-guard-enforcement-ledger.ts';
		rmSync(join(root, ...missing.split('/')));
		expect(() => collectInventory({ repositoryRoot: root, requireJpwbPopulations: true })).toThrow(
			`Required JPWB guard-enforcement-ledger implementation or retained-authority artifact is absent: ${missing}`
		);
	});

	it('discovers every current workspace manifest and every top-level verif TypeScript asset', () => {
		const inventory = collectInventory({ repositoryRoot: ROOT, requireJpwbPopulations: true });
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
