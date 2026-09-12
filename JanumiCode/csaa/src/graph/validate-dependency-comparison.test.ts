import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	DEPENDENCY_PROVIDER_COMPARISON_OPERATION_VERSION,
	DEPENDENCY_PROVIDER_COMPARISON_REQUEST_SCHEMA_VERSION,
	type CompareDependencyProvidersRequest,
	type DependencyProviderComparisonKey,
	type DependencyProviderComparisonSnapshot
} from '../contracts/dependency-comparison.js';
import type { DependencyCruiserObservation } from '../contracts/dependency-cruiser.js';
import type { ModuleDependencyGraphSnapshot } from '../contracts/graph.js';
import type { StaticSemanticSnapshot } from '../contracts/semantic.js';
import { sha256 } from '../inventory/canonical.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';

const mocks = vi.hoisted(() => ({ compareDependencyProviders: vi.fn() }));

vi.mock('./compare-dependency-providers.js', () => ({
	compareDependencyProviders: mocks.compareDependencyProviders
}));

import { validateDependencyProviderComparison } from './validate-dependency-comparison.js';

interface ValidatorFixture {
	readonly comparison: DependencyProviderComparisonSnapshot;
	readonly graph: ModuleDependencyGraphSnapshot;
	readonly observation: DependencyCruiserObservation;
	readonly request: CompareDependencyProvidersRequest;
	readonly semanticSnapshot: StaticSemanticSnapshot;
}

type MutableRecord = Record<string, unknown>;

function comparisonRecordId(contextDigest: string, key: DependencyProviderComparisonKey): string {
	return `dependency-comparison-record:${sha256(canonicalSemanticJson({ contextDigest, key }))}`;
}

function fixture(): ValidatorFixture {
	const comparisonContextDigest = 'a'.repeat(64);
	const firstKey = {
		importerBinding: 'EXACT_GRAPH_SOURCE',
		importerSemanticSourceId: 'semantic-source-a',
		moduleSystem: 'es6',
		normalizedSpecifier: './a.js',
		sourcePath: 'src/a.ts',
		typeOnlyPartition: 'COARSENED_NOT_COMPARED'
	} as unknown as DependencyProviderComparisonKey;
	const secondKey = {
		importerBinding: 'EXACT_GRAPH_SOURCE',
		importerSemanticSourceId: 'semantic-source-b',
		moduleSystem: 'es6',
		normalizedSpecifier: './b.js',
		sourcePath: 'src/b.ts',
		typeOnlyPartition: 'COARSENED_NOT_COMPARED'
	} as unknown as DependencyProviderComparisonKey;
	const records = [
		{
			assessment: 'CORROBORATION',
			compiler: {
				edgeIds: ['edge-a', 'edge-b'],
				occurrenceCount: 2,
				relationKinds: ['EXPORT_OCCURRENCE', 'IMPORT_OCCURRENCE'],
				resolutionStates: ['RESOLVED_SOURCE'],
				targetLogicalPaths: ['src/target.ts'],
				targetNodeIds: ['node-target']
			},
			dependencyCruiser: {
				dependencyIds: ['dependency-a'],
				dependencyTypes: ['export', 'import', 'local'],
				rowCount: 1,
				targetKinds: ['RESOLVED_LOCAL_PATH'],
				targetLogicalPaths: ['src/target.ts']
			},
			disposition: 'CORROBORATED_COLLAPSED_RELATION',
			id: comparisonRecordId(comparisonContextDigest, firstKey),
			key: firstKey,
			rationale: 'The provider row corroborates two compiler occurrences.'
		},
		{
			assessment: 'INCOMPARABLE',
			compiler: {
				edgeIds: ['edge-c'],
				occurrenceCount: 1,
				relationKinds: ['IMPORT_OCCURRENCE'],
				resolutionStates: ['UNRESOLVED'],
				targetLogicalPaths: [],
				targetNodeIds: ['node-unresolved']
			},
			dependencyCruiser: {
				dependencyIds: [],
				dependencyTypes: [],
				rowCount: 0,
				targetKinds: [],
				targetLogicalPaths: []
			},
			disposition: 'INCOMPARABLE_RESOLUTION_CONTEXT',
			id: comparisonRecordId(comparisonContextDigest, secondKey),
			key: secondKey,
			rationale: 'Provider absence is not comparable under an unknown context.'
		}
	];
	const request = {
		budgets: {
			maxComparisonRecords: 100,
			maxDiagnostics: 100,
			maxRationaleCharacters: 1_000
		},
		dependencyCruiserObservationId: 'observation',
		graphId: 'graph',
		negativeCoverage: { rationale: 'Negative coverage is open.', state: 'OPEN' },
		operationVersion: DEPENDENCY_PROVIDER_COMPARISON_OPERATION_VERSION,
		resolutionContext: {
			compilerContextDigest: 'b'.repeat(64),
			providerContextDigest: 'c'.repeat(64),
			rationale: 'Resolution-context equivalence is unknown.',
			state: 'UNKNOWN'
		},
		schemaVersion: DEPENDENCY_PROVIDER_COMPARISON_REQUEST_SCHEMA_VERSION,
		semanticSnapshotId: 'semantic-snapshot',
		subjectId: 'subject'
	} as unknown as CompareDependencyProvidersRequest;
	const comparison = {
		canonicalProfile: 'comparison-profile',
		comparisonContextDigest,
		contentDigest: 'd'.repeat(64),
		coverage: {
			agreementRecords: 0,
			compilerEdgesRepresented: 3,
			compilerEdgesTotal: 3,
			corroborationRecords: 1,
			dependencyCruiserDependenciesRepresented: 1,
			dependencyCruiserDependenciesTotal: 1,
			incomparableRecords: 1,
			observedDifferenceRecords: 0,
			reconciles: true,
			recordCount: 2
		},
		dependencyCruiserObservationId: 'observation',
		fullJanCsaa007Conformance: 'NOT_CLAIMED',
		graphId: 'graph',
		health: 'PARTIAL',
		id: 'comparison',
		limitations: [
			{
				affectedRecordCount: 0,
				kind: 'CONFLICT_QUALIFICATION_UNAVAILABLE',
				rationale: 'Conflict qualification is unavailable.'
			},
			{
				affectedRecordCount: 1,
				kind: 'NEGATIVE_COVERAGE_NOT_CLOSED',
				rationale: 'One record has an absent provider population.'
			},
			{
				affectedRecordCount: 1,
				kind: 'PROVIDER_AGGREGATES_OCCURRENCES',
				rationale: 'One record correlates both provider populations.'
			},
			{
				affectedRecordCount: 1,
				kind: 'RESOLUTION_CONTEXT_NOT_PROVEN_EQUIVALENT',
				rationale: 'One record is context-incomparable.'
			},
			{
				affectedRecordCount: 2,
				kind: 'TYPE_ONLY_PARTITION_NOT_REPRODUCED',
				rationale: 'Both records use the coarsened comparison key.'
			}
		],
		method: 'comparison-method',
		negativeCoverage: request.negativeCoverage,
		operationVersion: request.operationVersion,
		records,
		resolutionContext: request.resolutionContext,
		schemaVersion: 'comparison-schema',
		semanticSnapshotId: 'semantic-snapshot',
		subjectId: 'subject'
	} as unknown as DependencyProviderComparisonSnapshot;
	return {
		comparison,
		graph: {
			edges: [{ id: 'edge-a' }, { id: 'edge-b' }, { id: 'edge-c' }]
		} as unknown as ModuleDependencyGraphSnapshot,
		observation: {
			dependencies: [{ dependencyTypes: ['export', 'import', 'local'], id: 'dependency-a' }]
		} as unknown as DependencyCruiserObservation,
		request,
		semanticSnapshot: {} as StaticSemanticSnapshot
	};
}

function clone<T>(value: T): T {
	return structuredClone(value);
}

function mutableRecords(value: DependencyProviderComparisonSnapshot): MutableRecord[] {
	return value.records as unknown as MutableRecord[];
}

beforeEach(() => {
	mocks.compareDependencyProviders.mockReset();
});

describe('validateDependencyProviderComparison independent invariants', () => {
	it('accepts a deterministic comparison whose populations and canonical invariants reconcile', () => {
		const value = fixture();
		mocks.compareDependencyProviders.mockReturnValue({
			comparison: value.comparison,
			diagnostics: [],
			outcome: 'partial'
		});

		expect(
			validateDependencyProviderComparison(
				value.comparison,
				value.request,
				value.semanticSnapshot,
				value.graph,
				value.observation
			)
		).toEqual({ issues: [], state: 'VALID' });
	});

	it('rejects duplicate, missing, and foreign edge or dependency evidence', () => {
		const value = fixture();
		mocks.compareDependencyProviders.mockReturnValue({
			comparison: value.comparison,
			diagnostics: [],
			outcome: 'partial'
		});
		const mutated = clone(value.comparison);
		const records = mutableRecords(mutated);
		const compiler = records[0]!.compiler as MutableRecord;
		compiler.edgeIds = ['edge-a', 'edge-a'];
		const provider = records[0]!.dependencyCruiser as MutableRecord;
		provider.dependencyIds = ['dependency-foreign'];
		mocks.compareDependencyProviders.mockReturnValue({
			comparison: mutated,
			diagnostics: [],
			outcome: 'partial'
		});

		const result = validateDependencyProviderComparison(
			mutated,
			value.request,
			value.semanticSnapshot,
			value.graph,
			value.observation
		);
		expect(result.state).toBe('INVALID');
		expect(result.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'DUPLICATE_ID' }),
				expect.objectContaining({
					code: 'POPULATION_MISMATCH',
					path: '$.records[*].compiler.edgeIds'
				}),
				expect.objectContaining({
					code: 'POPULATION_MISMATCH',
					path: '$.records[*].dependencyCruiser.dependencyIds'
				})
			])
		);
	});

	it('recomputes every coverage counter and the reconciliation witness', () => {
		const value = fixture();
		mocks.compareDependencyProviders.mockReturnValue({
			comparison: value.comparison,
			diagnostics: [],
			outcome: 'partial'
		});
		const mutated = clone(value.comparison);
		const coverage = mutated.coverage as unknown as MutableRecord;
		coverage.compilerEdgesRepresented = 2;
		coverage.corroborationRecords = 0;
		coverage.reconciles = false;
		mocks.compareDependencyProviders.mockReturnValue({
			comparison: mutated,
			diagnostics: [],
			outcome: 'partial'
		});

		const result = validateDependencyProviderComparison(
			mutated,
			value.request,
			value.semanticSnapshot,
			value.graph,
			value.observation
		);
		expect(result.state).toBe('INVALID');
		expect(result.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: '$.coverage.compilerEdgesRepresented' }),
				expect.objectContaining({ path: '$.coverage.corroborationRecords' }),
				expect.objectContaining({ path: '$.coverage.reconciles' })
			])
		);
	});

	it('rejects forged or duplicate record identities and noncanonical record order', () => {
		const value = fixture();
		mocks.compareDependencyProviders.mockReturnValue({
			comparison: value.comparison,
			diagnostics: [],
			outcome: 'partial'
		});
		const forged = clone(value.comparison);
		const forgedRecords = mutableRecords(forged);
		forgedRecords[1]!.id = forgedRecords[0]!.id;
		mocks.compareDependencyProviders.mockReturnValue({
			comparison: forged,
			diagnostics: [],
			outcome: 'partial'
		});

		const forgedResult = validateDependencyProviderComparison(
			forged,
			value.request,
			value.semanticSnapshot,
			value.graph,
			value.observation
		);
		expect(forgedResult.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'DUPLICATE_ID' }),
				expect.objectContaining({ code: 'IDENTITY_MISMATCH' })
			])
		);

		const reordered = clone(value.comparison);
		(reordered.records as unknown as unknown[]).reverse();
		mocks.compareDependencyProviders.mockReturnValue({
			comparison: reordered,
			diagnostics: [],
			outcome: 'partial'
		});
		const reorderedResult = validateDependencyProviderComparison(
			reordered,
			value.request,
			value.semanticSnapshot,
			value.graph,
			value.observation
		);
		expect(reorderedResult.issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: 'NONCANONICAL_ORDER' })])
		);
	});

	it('validates limitation kind order, uniqueness, population, and affected counts', () => {
		const value = fixture();
		mocks.compareDependencyProviders.mockReturnValue({
			comparison: value.comparison,
			diagnostics: [],
			outcome: 'partial'
		});
		const mutated = clone(value.comparison);
		const limitations = mutated.limitations as unknown as MutableRecord[];
		limitations[1]!.affectedRecordCount = 0;
		limitations.reverse();
		mocks.compareDependencyProviders.mockReturnValue({
			comparison: mutated,
			diagnostics: [],
			outcome: 'partial'
		});

		const result = validateDependencyProviderComparison(
			mutated,
			value.request,
			value.semanticSnapshot,
			value.graph,
			value.observation
		);
		expect(result.state).toBe('INVALID');
		expect(result.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'NONCANONICAL_ORDER', path: '$.limitations' }),
				expect.objectContaining({ code: 'POPULATION_MISMATCH', path: '$.limitations' })
			])
		);
	});

	it('is total for hostile shapes and bounds independent diagnostics', () => {
		const value = fixture();
		mocks.compareDependencyProviders.mockReturnValue({
			comparison: value.comparison,
			diagnostics: [],
			outcome: 'partial'
		});
		const malformed = clone(value.comparison);
		(malformed as unknown as MutableRecord).records = [null, null];
		mocks.compareDependencyProviders.mockReturnValue({
			comparison: malformed,
			diagnostics: [],
			outcome: 'partial'
		});

		expect(() =>
			validateDependencyProviderComparison(
				malformed,
				value.request,
				value.semanticSnapshot,
				value.graph,
				value.observation,
				{ maxIssues: 1 }
			)
		).not.toThrow();
		expect(
			validateDependencyProviderComparison(
				malformed,
				value.request,
				value.semanticSnapshot,
				value.graph,
				value.observation,
				{ maxIssues: 1 }
			)
		).toMatchObject({ issues: [{ code: 'INVALID_SHAPE' }], state: 'BUDGET_EXHAUSTED' });
		expect(
			validateDependencyProviderComparison(
				null,
				value.request,
				value.semanticSnapshot,
				value.graph,
				value.observation
			)
		).toMatchObject({ issues: [{ code: 'INVALID_SHAPE' }], state: 'INVALID' });
		expect(
			validateDependencyProviderComparison(
				value.comparison,
				value.request,
				value.semanticSnapshot,
				value.graph,
				value.observation,
				null as unknown as Record<string, never>
			)
		).toMatchObject({ issues: [{ code: 'INVALID_INPUTS' }], state: 'INVALID' });

		mocks.compareDependencyProviders.mockImplementation(() => {
			throw new Error('hostile provider input');
		});
		expect(
			validateDependencyProviderComparison(
				value.comparison,
				value.request,
				value.semanticSnapshot,
				value.graph,
				value.observation
			)
		).toMatchObject({ issues: [{ code: 'INVALID_SHAPE' }], state: 'INVALID' });
	});

	it('rejects malformed composite fields and bound populations at every independent boundary', () => {
		const base = fixture();
		const validate = (
			comparison: unknown,
			request = base.request,
			graph = base.graph,
			observation = base.observation,
			options: Record<string, unknown> = {}
		) => {
			mocks.compareDependencyProviders.mockReturnValue({
				comparison,
				diagnostics: [],
				outcome: 'partial'
			});
			return validateDependencyProviderComparison(
				comparison,
				request,
				base.semanticSnapshot,
				graph,
				observation,
				options
			);
		};
		const mutate = (
			change: (candidate: MutableRecord) => void
		): DependencyProviderComparisonSnapshot => {
			const candidate = clone(base.comparison);
			change(candidate as unknown as MutableRecord);
			return candidate;
		};
		const record = (candidate: MutableRecord, index = 0) =>
			(candidate.records as MutableRecord[])[index]!;
		const compiler = (candidate: MutableRecord) => record(candidate).compiler as MutableRecord;
		const provider = (candidate: MutableRecord) =>
			record(candidate).dependencyCruiser as MutableRecord;
		const limitations = (candidate: MutableRecord) => candidate.limitations as MutableRecord[];
		const scenarios: readonly DependencyProviderComparisonSnapshot[] = [
			mutate((candidate) => Object.assign(candidate, { records: null })),
			mutate((candidate) => Object.assign(record(candidate), { compiler: null })),
			mutate((candidate) => Object.assign(record(candidate), { dependencyCruiser: null })),
			mutate((candidate) => Object.assign(record(candidate), { key: null })),
			mutate((candidate) => Object.assign(compiler(candidate), { edgeIds: null })),
			mutate((candidate) => Object.assign(compiler(candidate), { edgeIds: ['a', 'b', 'c', 'd'] })),
			mutate((candidate) => Object.assign(compiler(candidate), { relationKinds: [1] })),
			mutate((candidate) =>
				Object.assign(compiler(candidate), {
					relationKinds: ['IMPORT_OCCURRENCE', 'EXPORT_OCCURRENCE']
				})
			),
			mutate((candidate) => Object.assign(compiler(candidate), { occurrenceCount: -1 })),
			mutate((candidate) => Object.assign(compiler(candidate), { occurrenceCount: 1 })),
			mutate((candidate) => Object.assign(provider(candidate), { dependencyIds: null })),
			mutate((candidate) => Object.assign(provider(candidate), { dependencyTypes: [1] })),
			mutate((candidate) => Object.assign(provider(candidate), { rowCount: -1 })),
			mutate((candidate) => Object.assign(provider(candidate), { rowCount: 2 })),
			mutate((candidate) => Object.assign(record(candidate), { assessment: 'OTHER' })),
			mutate((candidate) => Object.assign(record(candidate), { disposition: 1 })),
			mutate((candidate) => Object.assign(record(candidate), { rationale: '' })),
			mutate((candidate) => Object.assign(record(candidate), { id: 1 })),
			mutate((candidate) =>
				Object.assign(record(candidate, 1), { key: clone(record(candidate).key) })
			),
			mutate((candidate) => Object.assign(candidate, { coverage: null })),
			mutate((candidate) => Object.assign(candidate, { limitations: null })),
			mutate((candidate) => Object.assign(candidate, { limitations: [null] })),
			mutate((candidate) => Object.assign(limitations(candidate)[0]!, { kind: 1 })),
			mutate((candidate) =>
				Object.assign(limitations(candidate)[1]!, { kind: limitations(candidate)[0]!.kind })
			),
			mutate((candidate) => Object.assign(limitations(candidate)[0]!, { affectedRecordCount: -1 })),
			mutate((candidate) => Object.assign(limitations(candidate)[0]!, { rationale: '' })),
			mutate((candidate) =>
				Object.assign(limitations(candidate)[0]!, { kind: 'UNRECOGNIZED_LIMITATION' })
			),
			mutate((candidate) => Object.assign(candidate, { comparisonContextDigest: 'invalid' }))
		];

		for (const candidate of scenarios) expect(validate(candidate).state).toBe('INVALID');

		expect(validate(base.comparison, base.request, { edges: null } as never)).toMatchObject({
			issues: [expect.objectContaining({ code: 'INVALID_INPUTS', path: '$graph.edges' })],
			state: 'INVALID'
		});
		expect(validate(base.comparison, base.request, { edges: [null] } as never)).toMatchObject({
			state: 'INVALID'
		});
		expect(
			validate(base.comparison, base.request, {
				edges: [{ id: 'edge-a' }, { id: 'edge-a' }]
			} as never)
		).toMatchObject({ state: 'INVALID' });
		expect(
			validate(base.comparison, base.request, base.graph, { dependencies: null } as never)
		).toMatchObject({
			issues: [
				expect.objectContaining({ code: 'INVALID_INPUTS', path: '$observation.dependencies' })
			],
			state: 'INVALID'
		});
		expect(
			validate(base.comparison, base.request, base.graph, { dependencies: [null] } as never)
		).toMatchObject({ state: 'INVALID' });
		expect(
			validate(base.comparison, base.request, base.graph, {
				dependencies: [{ id: 'dependency-a' }, { id: 'dependency-a' }]
			} as never)
		).toMatchObject({ state: 'INVALID' });

		for (const maxIssues of [0, Number.NaN, 100_001])
			expect(
				validate(base.comparison, base.request, base.graph, base.observation, { maxIssues })
			).toMatchObject({
				issues: [expect.objectContaining({ path: '$validationOptions.maxIssues' })],
				state: 'INVALID'
			});
		expect(validate(base.comparison, { ...base.request, budgets: null } as never)).toMatchObject({
			issues: [expect.objectContaining({ path: '$request.budgets' })],
			state: 'INVALID'
		});
		expect(
			validate(base.comparison, {
				...base.request,
				budgets: { ...base.request.budgets, maxComparisonRecords: 1 }
			})
		).toMatchObject({
			issues: [expect.objectContaining({ code: 'POPULATION_BUDGET_EXCEEDED' })],
			state: 'INVALID'
		});
	});
});
