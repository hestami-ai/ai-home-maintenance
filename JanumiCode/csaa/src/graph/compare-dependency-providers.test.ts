import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	DEPENDENCY_PROVIDER_COMPARISON_OPERATION_VERSION,
	DEPENDENCY_PROVIDER_COMPARISON_REQUEST_SCHEMA_VERSION,
	type CompareDependencyProvidersRequest
} from '../contracts/dependency-comparison.js';
import {
	DEPENDENCY_CRUISER_ARGV_GRAMMAR_VERSION,
	DEPENDENCY_CRUISER_INVOCATION_SCHEMA_VERSION,
	DEPENDENCY_CRUISER_PROVIDER_ID,
	DEPENDENCY_CRUISER_PROVIDER_VERSION,
	DEPENDENCY_CRUISER_RAW_SCHEMA_ID,
	type DependencyCruiserDependencyType,
	type DependencyCruiserInvocationBinding,
	type DependencyCruiserObservation
} from '../contracts/dependency-cruiser.js';
import {
	MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
	MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
	type BuildModuleDependencyGraphRequest,
	type ModuleDependencyGraphSnapshot
} from '../contracts/graph.js';
import {
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_REQUEST_SCHEMA_VERSION,
	type BuildStaticSemanticSnapshotRequest,
	type SemanticBudgets,
	type StaticSemanticSnapshot
} from '../contracts/semantic.js';
import {
	SUBJECT_POLICY_VERSION,
	SUBJECT_REQUEST_SCHEMA_VERSION,
	type ResolveSubjectRequest
} from '../contracts/subject.js';
import { sha256 } from '../inventory/canonical.js';
import { normalizeDependencyCruiserOutput } from '../providers/dependency-cruiser/normalize-output.js';
import { buildStaticSemanticSnapshot } from '../semantic/build-static-semantic-snapshot.js';
import { resolveSubject } from '../subject/resolve-subject.js';
import { buildModuleDependencyGraph } from './build-module-dependency-graph.js';
import { compareDependencyProviders } from './compare-dependency-providers.js';
import { validateDependencyProviderComparison } from './validate-dependency-comparison.js';

const temporaryRoots: string[] = [];

interface FixtureAnalysis {
	readonly graph: ModuleDependencyGraphSnapshot;
	readonly snapshot: StaticSemanticSnapshot;
}

interface RawDependency {
	readonly dependencyTypes: readonly DependencyCruiserDependencyType[];
	readonly module: string;
	readonly moduleSystem?: 'cjs' | 'es6';
	readonly resolved: string;
	readonly targetKind?: 'LOCAL' | 'UNRESOLVED';
}

function write(root: string, path: string, contents: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, contents, 'utf8');
}

function json(root: string, path: string, value: unknown): void {
	write(root, path, `${JSON.stringify(value, null, 2)}\n`);
}

function fixture(indexSource: string): string {
	const root = mkdtempSync(join(tmpdir(), 'csaa-dependency-comparison-'));
	temporaryRoots.push(root);
	json(root, 'package.json', {
		name: 'dependency-comparison-fixture',
		private: true,
		workspaces: ['packages/*']
	});
	json(root, 'packages/demo/package.json', {
		name: '@fixture/dependency-comparison',
		private: true,
		version: '0.0.0'
	});
	json(root, 'packages/demo/tsconfig.json', {
		compilerOptions: {
			module: 'NodeNext',
			moduleResolution: 'NodeNext',
			noEmit: true,
			noLib: true,
			strict: true,
			target: 'ES2022'
		},
		files: ['src/index.ts', 'src/local.ts', 'src/other.ts']
	});
	write(root, 'packages/demo/src/index.ts', indexSource);
	write(root, 'packages/demo/src/local.ts', 'export const local = 1;\n');
	write(root, 'packages/demo/src/other.ts', 'export const other = 2;\n');
	write(root, 'bun.lock', 'fixture lock\n');
	return root;
}

function subjectRequest(
	root: string,
	projects: readonly string[] = ['packages/demo/tsconfig.json']
): ResolveSubjectRequest {
	return {
		budgets: {
			maxBytes: 32 * 1024 * 1024,
			maxConfigDepth: 32,
			maxDiagnostics: 1_000,
			maxDurationMs: 30_000,
			maxFiles: 10_000,
			maxProjects: 10
		},
		filters: { exclude: [], include: [] },
		operationVersion: 'dependency-comparison-test/1',
		outputs: [],
		policyVersion: SUBJECT_POLICY_VERSION,
		rootLocator: root,
		schemaVersion: SUBJECT_REQUEST_SCHEMA_VERSION,
		scope: { kind: 'EXPLICIT_PROJECTS', projects },
		subjectKind: 'WORKTREE'
	};
}

function semanticBudgets(): SemanticBudgets {
	return {
		maxAstDepth: 256,
		maxAstNodes: 100_000,
		maxCompilerFacts: 100_000,
		maxCompilerInputMetadataBytes: 16 * 1024 * 1024,
		maxCompilerQueries: 100_000,
		maxCompilerQueryInvocations: 1_000_000,
		maxContextBytes: 32 * 1024 * 1024,
		maxContextFileBytes: 8 * 1024 * 1024,
		maxContextFiles: 10_000,
		maxDiagnosticCharacters: 1_000_000,
		maxDiagnostics: 10_000,
		maxDirectoryEntries: 1_000_000,
		maxDurationMs: 60_000,
		maxLiteralCharacters: 10_000,
		maxPathCharacters: 2_000,
		maxProjects: 10,
		maxScopes: 100_000,
		maxSnapshotBytes: 64 * 1024 * 1024,
		maxSources: 10_000
	};
}

function analyze(
	root: string,
	projects: readonly string[] = ['packages/demo/tsconfig.json']
): FixtureAnalysis {
	const subjectOutcome = resolveSubject(subjectRequest(root, projects));
	if (subjectOutcome.outcome !== 'resolved') throw new Error(JSON.stringify(subjectOutcome));
	const semanticRequest: BuildStaticSemanticSnapshotRequest = {
		assignabilityRequests: [],
		budgets: semanticBudgets(),
		capabilities: ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'],
		expectEmpty: false,
		operationVersion: SEMANTIC_OPERATION_VERSION,
		rootLocator: root,
		schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
		subjectId: subjectOutcome.subject.descriptor.subjectId
	};
	const semanticOutcome = buildStaticSemanticSnapshot(semanticRequest, {
		subject: subjectOutcome.subject
	});
	if (semanticOutcome.outcome === 'unavailable' || semanticOutcome.outcome === 'incompatible')
		throw new Error(JSON.stringify(semanticOutcome));
	const snapshot = semanticOutcome.snapshot;
	const graphRequest: BuildModuleDependencyGraphRequest = {
		operationVersion: MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
		schemaVersion: MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
		semanticSnapshotId: snapshot.id,
		subjectId: snapshot.subjectId
	};
	const graphOutcome = buildModuleDependencyGraph(graphRequest, snapshot);
	if (graphOutcome.outcome === 'unavailable') throw new Error(JSON.stringify(graphOutcome));
	return { graph: graphOutcome.graph, snapshot };
}

function rawDependency(input: RawDependency): Record<string, unknown> {
	const unresolved = input.targetKind === 'UNRESOLVED';
	return {
		circular: false,
		coreModule: false,
		couldNotResolve: unresolved,
		dependencyTypes: input.dependencyTypes,
		dynamic: input.dependencyTypes.includes('dynamic-import'),
		exoticallyRequired: false,
		followable: !unresolved,
		module: input.module,
		moduleSystem: input.moduleSystem ?? 'es6',
		resolved: input.resolved,
		valid: true
	};
}

function rawOutput(dependencies: readonly RawDependency[]): string {
	const localTargets = [
		...new Set(
			dependencies
				.filter((dependency) => dependency.targetKind !== 'UNRESOLVED')
				.map((dependency) => dependency.resolved)
		)
	].filter(
		(path) =>
			![
				'packages/demo/src/index.ts',
				'packages/demo/src/local.ts',
				'packages/demo/src/other.ts'
			].includes(path)
	);
	const modules = [
		{
			dependencies: dependencies.map(rawDependency),
			source: 'packages/demo/src/index.ts',
			valid: true
		},
		{ dependencies: [], source: 'packages/demo/src/local.ts', valid: true },
		{ dependencies: [], source: 'packages/demo/src/other.ts', valid: true },
		...localTargets.map((source) => ({ dependencies: [], source, valid: true }))
	];
	return JSON.stringify({
		modules,
		summary: {
			error: 0,
			ignore: 0,
			info: 0,
			optionsUsed: { baseDir: '.' },
			totalCruised: modules.length,
			totalDependenciesCruised: dependencies.length,
			violations: [],
			warn: 0
		}
	});
}

function observation(
	analysis: FixtureAnalysis,
	dependencies: readonly RawDependency[]
): DependencyCruiserObservation {
	const raw = rawOutput(dependencies);
	const binding: DependencyCruiserInvocationBinding = {
		argvGrammarVersion: DEPENDENCY_CRUISER_ARGV_GRAMMAR_VERSION,
		baseDir: '.',
		budgets: {
			maxCommandArgs: 100,
			maxDependencies: 100,
			maxDependents: 100,
			maxInputPaths: 100,
			maxIssues: 100,
			maxJsonDepth: 32,
			maxModules: 100,
			maxPathLength: 1_000,
			maxRawBytes: 1_000_000,
			maxRules: 100,
			maxStringLength: 10_000,
			maxSummaryViolations: 100,
			maxTotalStringCharacters: 1_000_000
		},
		command: {
			args: ['packages/demo', '--config', '.dependency-cruiser.cjs', '--output-type', 'json'],
			exitStatus: 0,
			finishedAt: '2026-08-11T12:00:01-04:00',
			startedAt: '2026-08-11T12:00:00-04:00'
		},
		config: { path: '.dependency-cruiser.cjs', sha256: sha256('fixture config') },
		inputPaths: ['packages/demo'],
		provider: {
			id: DEPENDENCY_CRUISER_PROVIDER_ID,
			version: DEPENDENCY_CRUISER_PROVIDER_VERSION
		},
		providerReportedBaseDir: {
			bytes: Buffer.byteLength('.', 'utf8'),
			representation: 'CANONICAL_RELATIVE',
			sha256: sha256('.'),
			state: 'PRESENT'
		},
		raw: { bytes: Buffer.byteLength(raw, 'utf8'), sha256: sha256(raw) },
		rawSchemaId: DEPENDENCY_CRUISER_RAW_SCHEMA_ID,
		schemaVersion: DEPENDENCY_CRUISER_INVOCATION_SCHEMA_VERSION,
		subjectRoot: {
			bytes: Buffer.byteLength('fixture subject root', 'utf8'),
			sha256: sha256('fixture subject root')
		},
		subjectId: analysis.snapshot.subjectId
	};
	const outcome = normalizeDependencyCruiserOutput(raw, binding);
	if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
	return outcome.observation;
}

function comparisonRequest(
	analysis: FixtureAnalysis,
	providerObservation: DependencyCruiserObservation,
	context: 'NOT_EQUIVALENT' | 'UNKNOWN' = 'NOT_EQUIVALENT',
	coverage: 'OPEN' | 'UNKNOWN' = 'OPEN'
): CompareDependencyProvidersRequest {
	return {
		budgets: {
			maxComparisonRecords: 1_000,
			maxDiagnostics: 100,
			maxRationaleCharacters: 10_000
		},
		dependencyCruiserObservationId: providerObservation.id,
		graphId: analysis.graph.id,
		negativeCoverage: {
			rationale:
				coverage === 'OPEN'
					? 'Fixture provider coverage is intentionally open.'
					: 'Fixture provider negative coverage is unknown.',
			state: coverage
		},
		operationVersion: DEPENDENCY_PROVIDER_COMPARISON_OPERATION_VERSION,
		resolutionContext: {
			compilerContextDigest: sha256('fixture compiler context'),
			providerContextDigest: sha256('fixture provider context'),
			rationale:
				context === 'NOT_EQUIVALENT'
					? 'Fixture contexts are intentionally not equivalent.'
					: 'Fixture context equivalence is unknown.',
			state: context
		},
		schemaVersion: DEPENDENCY_PROVIDER_COMPARISON_REQUEST_SCHEMA_VERSION,
		semanticSnapshotId: analysis.snapshot.id,
		subjectId: analysis.snapshot.subjectId
	};
}

afterEach(() => {
	for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe('compareDependencyProviders', () => {
	it('correlates a provider aggregate to multiple compiler occurrences without replacing them', () => {
		const analysis = analyze(
			fixture("import { local } from './local.js';\nexport { local as again } from './local.js';\n")
		);
		const providerObservation = observation(analysis, [
			{
				dependencyTypes: ['export', 'import', 'local'],
				module: './local.js',
				resolved: 'packages/demo/src/local.ts'
			}
		]);
		const request = comparisonRequest(analysis, providerObservation);
		const outcome = compareDependencyProviders(
			request,
			analysis.snapshot,
			analysis.graph,
			providerObservation
		);
		expect(outcome.outcome).toBe('partial');
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const relation = outcome.comparison.records.find(
			(record) => record.key.normalizedSpecifier === './local.js'
		);
		expect(relation).toMatchObject({
			assessment: 'CORROBORATION',
			compiler: { occurrenceCount: 2 },
			dependencyCruiser: { rowCount: 1 },
			disposition: 'CORROBORATED_COLLAPSED_RELATION',
			key: { typeOnlyPartition: 'COARSENED_NOT_COMPARED' }
		});
		expect(outcome.comparison.coverage).toMatchObject({
			compilerEdgesRepresented: analysis.graph.edges.length,
			dependencyCruiserDependenciesRepresented: 1,
			reconciles: true
		});
		expect(
			validateDependencyProviderComparison(
				outcome.comparison,
				request,
				analysis.snapshot,
				analysis.graph,
				providerObservation
			)
		).toEqual({ issues: [], state: 'VALID' });
	});

	it('retains unresolved agreement and provider-domain differences as separate records', () => {
		const analysis = analyze(
			fixture(
				"import { missing } from './missing.js';\nconst runtimeName = './other.js';\nvoid import(runtimeName);\nvoid missing;\n"
			)
		);
		const providerObservation = observation(analysis, [
			{
				dependencyTypes: ['import', 'unknown'],
				module: './missing.js',
				resolved: './missing.js',
				targetKind: 'UNRESOLVED'
			},
			{
				dependencyTypes: ['local', 'require'],
				module: './other.js',
				moduleSystem: 'cjs',
				resolved: 'packages/demo/src/other.ts'
			}
		]);
		const request = comparisonRequest(analysis, providerObservation);
		const outcome = compareDependencyProviders(
			request,
			analysis.snapshot,
			analysis.graph,
			providerObservation
		);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		expect(
			outcome.comparison.records.find((record) => record.key.normalizedSpecifier === './missing.js')
				?.disposition
		).toBe('AGREE_UNRESOLVED');
		expect(
			outcome.comparison.records.some(
				(record) => record.disposition === 'INCOMPARABLE_PROVIDER_DOMAIN'
			)
		).toBe(true);
	});

	it('does not merge a provider path across multiple Program-specific compiler sources', () => {
		const root = fixture("import { local } from './local.js';\nvoid local;\n");
		json(root, 'packages/demo/tsconfig.second.json', {
			compilerOptions: {
				module: 'NodeNext',
				moduleResolution: 'NodeNext',
				noEmit: true,
				noLib: true,
				strict: true,
				target: 'ES2022'
			},
			files: ['src/index.ts', 'src/local.ts', 'src/other.ts']
		});
		const analysis = analyze(root, [
			'packages/demo/tsconfig.json',
			'packages/demo/tsconfig.second.json'
		]);
		const providerObservation = observation(analysis, [
			{
				dependencyTypes: ['import', 'local'],
				module: './local.js',
				resolved: 'packages/demo/src/local.ts'
			}
		]);
		const outcome = compareDependencyProviders(
			comparisonRequest(analysis, providerObservation),
			analysis.snapshot,
			analysis.graph,
			providerObservation
		);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const records = outcome.comparison.records.filter(
			(record) => record.key.normalizedSpecifier === './local.js'
		);
		expect(records.filter((record) => record.compiler.occurrenceCount > 0)).toHaveLength(2);
		expect(
			records.filter((record) => record.key.importerBinding === 'AMBIGUOUS_GRAPH_SOURCES')
		).toHaveLength(1);
		expect(records.every((record) => record.disposition === 'AMBIGUOUS_AGGREGATE')).toBe(true);
	});

	it('preserves SOURCE endpoint representation separately from external classification', () => {
		const root = fixture("import { external } from 'external-pkg';\nvoid external;\n");
		json(root, 'node_modules/external-pkg/package.json', {
			name: 'external-pkg',
			types: 'index.d.ts',
			version: '1.0.0'
		});
		write(root, 'node_modules/external-pkg/index.d.ts', 'export declare const external: number;\n');
		const analysis = analyze(root);
		const compilerEdge = analysis.graph.edges.find((edge) => edge.specifier === 'external-pkg');
		expect(compilerEdge).toMatchObject({
			resolutionState: 'RESOLVED_EXTERNAL',
			target: { kind: 'SOURCE' }
		});
		const providerObservation = observation(analysis, [
			{
				dependencyTypes: ['import', 'local'],
				module: 'external-pkg',
				resolved: 'node_modules/external-pkg/index.d.ts'
			}
		]);
		const outcome = compareDependencyProviders(
			comparisonRequest(analysis, providerObservation),
			analysis.snapshot,
			analysis.graph,
			providerObservation
		);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const record = outcome.comparison.records.find(
			(candidate) => candidate.key.normalizedSpecifier === 'external-pkg'
		);
		expect(record).toMatchObject({
			compiler: { targetLogicalPaths: ['node_modules/external-pkg/index.d.ts'] },
			disposition: 'AGREE_TARGET_CLASS'
		});
	});

	it('retains different resolved targets as an observed difference without conflict authority', () => {
		const analysis = analyze(fixture("import { local } from './local.js';\nvoid local;\n"));
		const providerObservation = observation(analysis, [
			{
				dependencyTypes: ['import', 'local'],
				module: './local.js',
				resolved: 'packages/demo/src/other.ts'
			}
		]);
		const outcome = compareDependencyProviders(
			comparisonRequest(analysis, providerObservation),
			analysis.snapshot,
			analysis.graph,
			providerObservation
		);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		expect(outcome.comparison.records[0]).toMatchObject({
			assessment: 'OBSERVED_DIFFERENCE',
			disposition: 'OBSERVED_TARGET_DIFFERENCE'
		});
		expect(outcome.comparison.coverage.observedDifferenceRecords).toBe(1);
	});

	it('retains absence as unknown for a partial provider and rejects caller-minted conflict authority', () => {
		const analysis = analyze(fixture("import { local } from './local.js';\nvoid local;\n"));
		const providerObservation = observation(analysis, []);
		const request = comparisonRequest(analysis, providerObservation);
		const outcome = compareDependencyProviders(
			request,
			analysis.snapshot,
			analysis.graph,
			providerObservation
		);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		expect(outcome.comparison.records[0]?.disposition).toBe('UNKNOWN_PROVIDER_PARTIAL');
		const forged = compareDependencyProviders(
			{
				...request,
				negativeCoverage: { rationale: 'Unverified assertion.', state: 'CLOSED' },
				resolutionContext: {
					...request.resolutionContext,
					state: 'PROVEN_EQUIVALENT'
				}
			} as unknown as CompareDependencyProvidersRequest,
			analysis.snapshot,
			analysis.graph,
			providerObservation
		);
		expect(forged.outcome).toBe('unavailable');
		expect(forged.diagnostics).not.toHaveLength(0);
		expect(forged.diagnostics.every((diagnostic) => diagnostic.code === 'REQUEST_INVALID')).toBe(
			true
		);
	});

	it('fails closed on identity, population-budget, and derived-content mutations', () => {
		const analysis = analyze(fixture("import { local } from './local.js';\nvoid local;\n"));
		const providerObservation = observation(analysis, [
			{
				dependencyTypes: ['import', 'local'],
				module: './local.js',
				resolved: 'packages/demo/src/local.ts'
			}
		]);
		const request = comparisonRequest(analysis, providerObservation);
		expect(
			compareDependencyProviders(
				null as unknown as CompareDependencyProvidersRequest,
				analysis.snapshot,
				analysis.graph,
				providerObservation
			)
		).toMatchObject({ diagnostics: [{ code: 'REQUEST_INVALID' }], outcome: 'unavailable' });
		expect(
			compareDependencyProviders(
				request,
				null as unknown as StaticSemanticSnapshot,
				analysis.graph,
				providerObservation
			)
		).toMatchObject({ diagnostics: [{ code: 'GRAPH_INVALID' }], outcome: 'unavailable' });
		expect(
			compareDependencyProviders(
				{ ...request, dependencyCruiserObservationId: 'wrong' },
				analysis.snapshot,
				analysis.graph,
				providerObservation
			)
		).toMatchObject({ diagnostics: [{ code: 'IDENTITY_MISMATCH' }], outcome: 'unavailable' });
		const crowdedObservation = observation(analysis, [
			{
				dependencyTypes: ['import', 'local'],
				module: './local.js',
				resolved: 'packages/demo/src/local.ts'
			},
			{
				dependencyTypes: ['require', 'local'],
				module: './other.js',
				moduleSystem: 'cjs',
				resolved: 'packages/demo/src/other.ts'
			}
		]);
		const crowdedRequest = comparisonRequest(analysis, crowdedObservation);
		expect(
			compareDependencyProviders(
				{
					...crowdedRequest,
					budgets: { ...crowdedRequest.budgets, maxComparisonRecords: 1 }
				},
				analysis.snapshot,
				analysis.graph,
				crowdedObservation
			)
		).toMatchObject({
			diagnostics: [{ code: 'BUDGET_EXCEEDED' }],
			outcome: 'unavailable'
		});

		const outcome = compareDependencyProviders(
			request,
			analysis.snapshot,
			analysis.graph,
			providerObservation
		);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const mutated = {
			...outcome.comparison,
			coverage: { ...outcome.comparison.coverage, reconciles: false }
		};
		expect(
			validateDependencyProviderComparison(
				mutated,
				request,
				analysis.snapshot,
				analysis.graph,
				providerObservation
			)
		).toMatchObject({ issues: [{ code: 'CONTENT_MISMATCH' }], state: 'INVALID' });
		expect(
			validateDependencyProviderComparison(
				mutated,
				null as unknown as CompareDependencyProvidersRequest,
				analysis.snapshot,
				analysis.graph,
				providerObservation
			)
		).toMatchObject({ issues: [{ code: 'INVALID_INPUTS' }], state: 'INVALID' });
	});

	it('fails closed across the complete comparison request and bound-input trust boundary', () => {
		const analysis = analyze(fixture("import { local } from './local.js';\nvoid local;\n"));
		const providerObservation = observation(analysis, [
			{
				dependencyTypes: ['import', 'local'],
				module: './local.js',
				resolved: 'packages/demo/src/local.ts'
			}
		]);
		const request = comparisonRequest(analysis, providerObservation);
		const mutate = (change: (candidate: Record<string, unknown>) => void): unknown => {
			const candidate = JSON.parse(JSON.stringify(request)) as Record<string, unknown>;
			change(candidate);
			return candidate;
		};
		const invalidRequests: readonly unknown[] = [
			[],
			mutate((candidate) => Object.assign(candidate, { unexpected: true })),
			mutate((candidate) => Object.assign(candidate, { budgets: null })),
			mutate((candidate) =>
				Object.assign(candidate.budgets as Record<string, unknown>, { unexpected: true })
			),
			mutate((candidate) => Object.assign(candidate, { resolutionContext: null })),
			mutate((candidate) =>
				Object.assign(candidate.resolutionContext as Record<string, unknown>, { unexpected: true })
			),
			mutate((candidate) => Object.assign(candidate, { negativeCoverage: null })),
			mutate((candidate) =>
				Object.assign(candidate.negativeCoverage as Record<string, unknown>, { unexpected: true })
			),
			mutate((candidate) => Object.assign(candidate, { schemaVersion: 'other' })),
			mutate((candidate) => Object.assign(candidate, { operationVersion: 'other' })),
			mutate((candidate) => Object.assign(candidate, { subjectId: '' })),
			mutate((candidate) => Object.assign(candidate, { subjectId: '\ud800' })),
			mutate((candidate) => Object.assign(candidate, { subjectId: '\udc00' })),
			mutate((candidate) => Object.assign(candidate, { dependencyCruiserObservationId: '' })),
			...(['maxComparisonRecords', 'maxDiagnostics', 'maxRationaleCharacters'] as const).map(
				(field) =>
					mutate((candidate) =>
						Object.assign(candidate.budgets as Record<string, unknown>, { [field]: 0 })
					)
			),
			...(['compilerContextDigest', 'providerContextDigest'] as const).map((field) =>
				mutate((candidate) =>
					Object.assign(candidate.resolutionContext as Record<string, unknown>, {
						[field]: 'not-a-digest'
					})
				)
			),
			mutate((candidate) =>
				Object.assign(candidate.resolutionContext as Record<string, unknown>, { state: 'other' })
			),
			mutate((candidate) =>
				Object.assign(candidate.negativeCoverage as Record<string, unknown>, { state: 'other' })
			),
			mutate((candidate) =>
				Object.assign(candidate.resolutionContext as Record<string, unknown>, { rationale: '' })
			),
			mutate((candidate) =>
				Object.assign(candidate.negativeCoverage as Record<string, unknown>, {
					rationale: '\ud800'
				})
			)
		];

		for (const candidate of invalidRequests) {
			const outcome = compareDependencyProviders(
				candidate as CompareDependencyProvidersRequest,
				analysis.snapshot,
				analysis.graph,
				providerObservation
			);
			expect(outcome.outcome).toBe('unavailable');
			expect(outcome.diagnostics.length).toBeGreaterThan(0);
			expect(outcome.diagnostics.every((diagnostic) => diagnostic.code === 'REQUEST_INVALID')).toBe(
				true
			);
		}

		expect(
			compareDependencyProviders(
				request,
				analysis.snapshot,
				analysis.graph,
				null as unknown as DependencyCruiserObservation
			)
		).toMatchObject({ diagnostics: [{ code: 'OBSERVATION_INVALID' }], outcome: 'unavailable' });

		for (const identityMutation of [
			{ graphId: 'graph:other' },
			{ semanticSnapshotId: 'static:other' },
			{ subjectId: 'subject-other' }
		])
			expect(
				compareDependencyProviders(
					{ ...request, ...identityMutation } as CompareDependencyProvidersRequest,
					analysis.snapshot,
					analysis.graph,
					providerObservation
				)
			).toMatchObject({ diagnostics: [{ code: 'IDENTITY_MISMATCH' }], outcome: 'unavailable' });

		const invalidGraph = JSON.parse(
			JSON.stringify(analysis.graph)
		) as ModuleDependencyGraphSnapshot;
		Object.assign(invalidGraph as unknown as { contentDigest: string }, {
			contentDigest: '0'.repeat(64)
		});
		expect(
			compareDependencyProviders(request, analysis.snapshot, invalidGraph, providerObservation)
		).toMatchObject({ diagnostics: [{ code: 'GRAPH_INVALID' }], outcome: 'unavailable' });

		const invalidObservation = JSON.parse(
			JSON.stringify(providerObservation)
		) as DependencyCruiserObservation;
		Object.assign(invalidObservation as unknown as { contentDigest: string }, {
			contentDigest: '0'.repeat(64)
		});
		expect(
			compareDependencyProviders(request, analysis.snapshot, analysis.graph, invalidObservation)
		).toMatchObject({ diagnostics: [{ code: 'OBSERVATION_INVALID' }], outcome: 'unavailable' });

		const rationaleBudgetRequest = {
			...request,
			budgets: { ...request.budgets, maxRationaleCharacters: 1 },
			negativeCoverage: { ...request.negativeCoverage, rationale: 'x' },
			resolutionContext: { ...request.resolutionContext, rationale: 'x' }
		};
		expect(
			compareDependencyProviders(
				rationaleBudgetRequest,
				analysis.snapshot,
				analysis.graph,
				providerObservation
			)
		).toMatchObject({ diagnostics: [{ code: 'BUDGET_EXCEEDED' }], outcome: 'unavailable' });
	});

	it('retains resolution-state and target-model differences without conflict authority', () => {
		const localAnalysis = analyze(fixture("import { local } from './local.js';\nvoid local;\n"));
		const unresolvedProvider = observation(localAnalysis, [
			{
				dependencyTypes: ['import', 'unknown'],
				module: './local.js',
				resolved: './local.js',
				targetKind: 'UNRESOLVED'
			}
		]);
		const unresolvedOutcome = compareDependencyProviders(
			comparisonRequest(localAnalysis, unresolvedProvider),
			localAnalysis.snapshot,
			localAnalysis.graph,
			unresolvedProvider
		);
		if (unresolvedOutcome.outcome === 'unavailable')
			throw new Error(JSON.stringify(unresolvedOutcome));
		expect(unresolvedOutcome.comparison.records[0]).toMatchObject({
			assessment: 'OBSERVED_DIFFERENCE',
			disposition: 'OBSERVED_RESOLUTION_STATE_DIFFERENCE'
		});

		const ambientRoot = fixture("import { ambient } from 'ambient-pkg';\nvoid ambient;\n");
		write(
			ambientRoot,
			'packages/demo/src/ambient.d.ts',
			"declare module 'ambient-pkg' { export const ambient: number; }\n"
		);
		const ambientConfig = {
			compilerOptions: {
				module: 'NodeNext',
				moduleResolution: 'NodeNext',
				noEmit: true,
				noLib: true,
				strict: true,
				target: 'ES2022'
			},
			files: ['src/ambient.d.ts', 'src/index.ts', 'src/local.ts', 'src/other.ts']
		};
		json(ambientRoot, 'packages/demo/tsconfig.json', ambientConfig);
		const ambientAnalysis = analyze(ambientRoot);
		const localProviderForAmbient = observation(ambientAnalysis, [
			{
				dependencyTypes: ['import', 'local'],
				module: 'ambient-pkg',
				resolved: 'packages/demo/src/local.ts'
			}
		]);
		const ambientOutcome = compareDependencyProviders(
			comparisonRequest(ambientAnalysis, localProviderForAmbient),
			ambientAnalysis.snapshot,
			ambientAnalysis.graph,
			localProviderForAmbient
		);
		if (ambientOutcome.outcome === 'unavailable') throw new Error(JSON.stringify(ambientOutcome));
		expect(ambientOutcome.comparison.records[0]).toMatchObject({
			assessment: 'CORROBORATION',
			disposition: 'PRESENCE_ONLY_TARGET_MODEL_DIFFERENT'
		});
		expect(ambientOutcome.comparison.limitations).toContainEqual(
			expect.objectContaining({ kind: 'TARGET_MODEL_DIFFERENCE' })
		);

		const externalProviderForLocal = observation(localAnalysis, [
			{
				dependencyTypes: ['import', 'npm'],
				module: './local.js',
				resolved: 'node_modules/external-pkg/index.js'
			}
		]);
		const modelOutcome = compareDependencyProviders(
			comparisonRequest(localAnalysis, externalProviderForLocal),
			localAnalysis.snapshot,
			localAnalysis.graph,
			externalProviderForLocal
		);
		if (modelOutcome.outcome === 'unavailable') throw new Error(JSON.stringify(modelOutcome));
		expect(modelOutcome.comparison.records[0]?.disposition).toBe('INCOMPARABLE_RESOLUTION_CONTEXT');
	});

	it('accepts valid surrogate pairs in request text before checking bound identities', () => {
		const analysis = analyze(fixture('export const value = 1;\n'));
		const providerObservation = observation(analysis, []);
		const outcome = compareDependencyProviders(
			{ ...comparisonRequest(analysis, providerObservation), subjectId: '🧪' },
			analysis.snapshot,
			analysis.graph,
			providerObservation
		);
		expect(outcome).toMatchObject({
			diagnostics: [{ code: 'IDENTITY_MISMATCH' }],
			outcome: 'unavailable'
		});
	});
});
