import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	CURRENT_DEPENDENCY_CRUISER_CONFIG_PATH,
	CURRENT_DEPENDENCY_CRUISER_ENTRY_PATH,
	CURRENT_DEPENDENCY_CRUISER_EVIDENCE_PATH,
	CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_EVIDENCE_PATH,
	CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_INPUT_PATHS,
	CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_PROVIDER_ARGS,
	CURRENT_DEPENDENCY_CRUISER_HISTORICAL_DIFFERENTIAL_DIGEST,
	CURRENT_DEPENDENCY_CRUISER_INPUT_PATHS,
	CURRENT_DEPENDENCY_CRUISER_LOCK_PATH,
	CURRENT_DEPENDENCY_CRUISER_PACKAGE_PATH,
	CURRENT_DEPENDENCY_CRUISER_PROJECT_PATHS,
	CURRENT_DEPENDENCY_CRUISER_PROVIDER_ARGS,
	CURRENT_DEPENDENCY_CRUISER_REVIEWED_DIFFERENTIAL_DIGEST,
	CURRENT_DEPENDENCY_CRUISER_SOURCE_INCLUDE_FILTERS,
	assessCurrentDependencyCruiserG4Closure,
	currentDependencyCruiserEvidenceDigestsAreValid,
	defaultCurrentDependencyCruiserG4ClosureRequest,
	defaultCurrentDependencyCruiserDifferentialRequest,
	runCurrentDependencyCruiserG4Closure,
	runCurrentDependencyCruiserDifferential,
	type CurrentDependencyCruiserDifferentialDependencies,
	type CurrentDependencyCruiserDifferentialRequest,
	type CurrentDependencyCruiserExecutorRequest,
	type CurrentDependencyCruiserExecutorResult
} from './run-current-dependency-cruiser-differential.js';
import type { FrozenSubject, ResolveSubjectRequest } from '../contracts/subject.js';
import { canonicalJson, sha256 } from '../inventory/canonical.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import {
	createStructuralWorkspaceDependencyFixture,
	createStructuralWorkspaceDependencyObservation,
	type StructuralWorkspaceDependencyFixture
} from './structural-workspace-dependency-fixture.test-support.js';
import {
	DEPENDENCY_CRUISER_DIFFERENTIAL_OPERATION_VERSION,
	DEPENDENCY_CRUISER_DIFFERENTIAL_REQUEST_SCHEMA_VERSION,
	assessDependencyCruiserDifferential
} from './assess-dependency-cruiser-differential.js';

function rawDependency(module: string, resolved: string): Record<string, unknown> {
	return {
		circular: false,
		coreModule: false,
		couldNotResolve: false,
		dependencyTypes: ['import', 'local', 'type-import', 'type-only'],
		dynamic: false,
		exoticallyRequired: false,
		followable: true,
		module,
		moduleSystem: 'es6',
		resolved,
		typeOnly: true,
		valid: true
	};
}

function providerRaw(root: string): string {
	const modules = [
		{
			dependencies: [rawDependency('../../b/src/b.js', 'packages/b/src/b.ts')],
			source: 'packages/a/src/a.ts',
			valid: true
		},
		{
			dependencies: [rawDependency('../../a/src/a.js', 'packages/a/src/a.ts')],
			source: 'packages/b/src/b.ts',
			valid: true
		},
		{
			dependencies: [rawDependency('../../../packages/a/src/a.js', 'packages/a/src/a.ts')],
			source: 'apps/demo/src/main.ts',
			valid: true
		}
	];
	return JSON.stringify({
		modules,
		summary: {
			error: 0,
			ignore: 0,
			info: 0,
			optionsUsed: { baseDir: root },
			totalCruised: modules.length,
			totalDependenciesCruised: 3,
			violations: [],
			warn: 0
		}
	});
}

function result(
	stdout: string,
	overrides: Partial<CurrentDependencyCruiserExecutorResult> = {}
): CurrentDependencyCruiserExecutorResult {
	return {
		errorCode: null,
		errorMessage: null,
		signal: null,
		status: 0,
		stderr: '',
		stdout,
		timedOut: false,
		...overrides
	};
}

describe('current dependency-cruiser differential runner', () => {
	let fixture: StructuralWorkspaceDependencyFixture;

	it('retains the pre-integration digest as historical and binds the reviewed final graph', () => {
		expect(CURRENT_DEPENDENCY_CRUISER_HISTORICAL_DIFFERENTIAL_DIGEST).toBe(
			'702f5a25ee3316c43a4066d3d0cd95bb860950a1a24663b4b43b4c3962a5e355'
		);
		expect(CURRENT_DEPENDENCY_CRUISER_REVIEWED_DIFFERENTIAL_DIGEST).toBe(
			'b4eddb605074ed4554dbc7999c075a2585c290faf37e9668b104ee5a692fa825'
		);
	});

	beforeAll(() => {
		fixture = createStructuralWorkspaceDependencyFixture();
		for (const [path, text] of [
			[
				CURRENT_DEPENDENCY_CRUISER_PACKAGE_PATH,
				JSON.stringify({ name: 'dependency-cruiser', version: '16.10.4' })
			],
			[CURRENT_DEPENDENCY_CRUISER_ENTRY_PATH, '#!/usr/bin/env node\n']
		] as const) {
			const absolute = join(fixture.root, ...path.split('/'));
			mkdirSync(dirname(absolute), { recursive: true });
			writeFileSync(absolute, text, 'utf8');
		}
		for (const path of CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_INPUT_PATHS) {
			const absolute = join(fixture.root, ...path.split('/'));
			mkdirSync(dirname(absolute), { recursive: true });
			writeFileSync(absolute, 'export {};\n', 'utf8');
		}
	});

	afterAll(() => fixture.cleanup());

	function request(
		expectedDifferentialDigest: string | null,
		mutate?: (
			value: CurrentDependencyCruiserDifferentialRequest
		) => CurrentDependencyCruiserDifferentialRequest
	): CurrentDependencyCruiserDifferentialRequest {
		const value = defaultCurrentDependencyCruiserDifferentialRequest(
			fixture.root,
			expectedDifferentialDigest
		);
		return mutate?.(value) ?? value;
	}

	function dependencies(
		execute: (
			request: CurrentDependencyCruiserExecutorRequest
		) => CurrentDependencyCruiserExecutorResult,
		overrides: CurrentDependencyCruiserDifferentialDependencies = {}
	): CurrentDependencyCruiserDifferentialDependencies {
		let nowIndex = 0;
		let monotonicIndex = 0;
		const dates = [new Date('2026-08-25T16:00:00.000Z'), new Date('2026-08-25T16:00:00.025Z')];
		const monotonic = [100, 125];
		return {
			buildGraph: () => ({ diagnostics: [], graph: fixture.graph, outcome: 'complete' }),
			buildSemantic: () => ({
				diagnostics: [],
				outcome: 'complete',
				snapshot: fixture.semanticSnapshot
			}),
			clock: {
				monotonicMs: () => monotonic[monotonicIndex++]!,
				now: () => dates[nowIndex++]!
			},
			execute,
			resolve: () => ({
				completeness:
					fixture.frozenSubject.descriptor.dirtyState === 'UNKNOWN' ? 'PARTIAL' : 'COMPLETE',
				diagnostics: [],
				outcome: 'resolved',
				subject: fixture.frozenSubject
			}),
			verifyCurrentness: () => ({ changedPaths: [], diagnostics: [], state: 'CURRENT' }),
			...overrides
		};
	}

	function discover(
		execute: (
			request: CurrentDependencyCruiserExecutorRequest
		) => CurrentDependencyCruiserExecutorResult = () => result(providerRaw(fixture.root)),
		overrides: CurrentDependencyCruiserDifferentialDependencies = {}
	) {
		const outcome = runCurrentDependencyCruiserDifferential(
			request(null),
			dependencies(execute, overrides)
		);
		expect(outcome.outcome, JSON.stringify(outcome)).toBe('rejected');
		if (outcome.outcome !== 'rejected') throw new Error(JSON.stringify(outcome));
		expect(outcome.diagnostics[0].code).toBe('BASELINE_REQUIRED');
		return outcome.discovery.differentialDigest;
	}

	it('closes only an exact compiler-root, provider-module, and represented-relation population', () => {
		const inputPaths = [
			'apps/demo/src/main.ts',
			'packages/a/src/a.ts',
			'packages/b/src/b.ts'
		] as const;
		const observation = createStructuralWorkspaceDependencyObservation(fixture, { inputPaths });
		const discovery = assessDependencyCruiserDifferential(
			{
				budgets: {
					comparison: {
						maxComparisonRecords: 1_000,
						maxDiagnostics: 100,
						maxRationaleCharacters: 10_000
					},
					maxResultBytes: 4_000_000
				},
				configPath: CURRENT_DEPENDENCY_CRUISER_CONFIG_PATH,
				expectedDifferentialDigest: null,
				expectedInputPaths: inputPaths,
				operationVersion: DEPENDENCY_CRUISER_DIFFERENTIAL_OPERATION_VERSION,
				schemaVersion: DEPENDENCY_CRUISER_DIFFERENTIAL_REQUEST_SCHEMA_VERSION
			},
			fixture.frozenSubject,
			fixture.semanticSnapshot,
			fixture.graph,
			observation
		);
		expect(discovery.outcome).toBe('rejected');
		if (discovery.outcome !== 'rejected') throw new Error(JSON.stringify(discovery));
		const closure = assessCurrentDependencyCruiserG4Closure(
			fixture.semanticSnapshot,
			fixture.graph,
			observation,
			discovery.evidence,
			inputPaths,
			'tsconfig.json'
		);
		expect(closure).toMatchObject({
			outcome: 'closed',
			witness: {
				comparison: { observedDifferenceRecords: 0, reconciles: true },
				contextEquivalence: 'UNKNOWN',
				populationClosure: {
					compilerRootsEqualProviderInputs: true,
					compilerSourcesEqualProviderModules: true,
					state: 'CLOSED_FOR_EXACT_BUILD_ROOT_AND_REPRESENTED_RELATION_POPULATIONS'
				},
				state: 'CLOSED_NO_OBSERVED_DIFFERENCE',
				underlyingComparisonNegativeCoverage: 'OPEN'
			}
		});
		const generatedRootClosure = assessCurrentDependencyCruiserG4Closure(
			{
				...fixture.semanticSnapshot,
				sources: fixture.semanticSnapshot.sources.map((source, index) =>
					index === 0 ? { ...source, origin: 'GENERATED' as const } : source
				)
			},
			fixture.graph,
			observation,
			discovery.evidence,
			inputPaths,
			'tsconfig.json'
		);
		expect(generatedRootClosure).toMatchObject({ outcome: 'closed' });
		const incomplete = assessCurrentDependencyCruiserG4Closure(
			fixture.semanticSnapshot,
			fixture.graph,
			observation,
			discovery.evidence,
			inputPaths.slice(1),
			'tsconfig.json'
		);
		expect(incomplete).toMatchObject({ outcome: 'unavailable' });
		const observedDifference = assessCurrentDependencyCruiserG4Closure(
			fixture.semanticSnapshot,
			fixture.graph,
			observation,
			{
				...discovery.evidence,
				comparison: {
					...discovery.evidence.comparison,
					coverage: {
						...discovery.evidence.comparison.coverage,
						observedDifferenceRecords: 1
					}
				}
			},
			inputPaths,
			'tsconfig.json'
		);
		expect(observedDifference).toMatchObject({ outcome: 'unavailable' });
		const widenedProviderPopulation = assessCurrentDependencyCruiserG4Closure(
			fixture.semanticSnapshot,
			fixture.graph,
			{
				...observation,
				modules: Object.freeze([
					...observation.modules,
					Object.freeze({
						...observation.modules[0]!,
						sourcePath: 'packages/outside/src/unselected.ts'
					})
				])
			},
			discovery.evidence,
			inputPaths,
			'tsconfig.json'
		);
		expect(widenedProviderPopulation).toMatchObject({ outcome: 'unavailable' });
		const duplicateProviderModule = assessCurrentDependencyCruiserG4Closure(
			fixture.semanticSnapshot,
			fixture.graph,
			{
				...observation,
				modules: Object.freeze([...observation.modules, observation.modules[0]!])
			},
			discovery.evidence,
			inputPaths,
			'tsconfig.json'
		);
		expect(duplicateProviderModule).toMatchObject({
			diagnostic: expect.stringContaining('duplicate rows'),
			outcome: 'unavailable'
		});
		const wrongProject = assessCurrentDependencyCruiserG4Closure(
			fixture.semanticSnapshot,
			fixture.graph,
			observation,
			discovery.evidence,
			inputPaths,
			'packages/other/tsconfig.json'
		);
		expect(wrongProject).toMatchObject({ outcome: 'unavailable' });
		const duplicateExpected = assessCurrentDependencyCruiserG4Closure(
			fixture.semanticSnapshot,
			fixture.graph,
			observation,
			discovery.evidence,
			[...inputPaths, inputPaths[0]],
			'tsconfig.json'
		);
		expect(duplicateExpected).toMatchObject({ outcome: 'unavailable' });
		const unknownImporter = assessCurrentDependencyCruiserG4Closure(
			fixture.semanticSnapshot,
			{
				...fixture.graph,
				edges: [
					{
						...fixture.graph.edges[0]!,
						source: { ...fixture.graph.edges[0]!.source, nodeId: 'missing-node' as never }
					}
				]
			},
			observation,
			discovery.evidence,
			inputPaths,
			'tsconfig.json'
		);
		expect(unknownImporter).toMatchObject({ outcome: 'unavailable' });
	});

	it('uses an exact fixed root-file argv and a distinct evidence subject for G4 closure', () => {
		let capturedExecutor: CurrentDependencyCruiserExecutorRequest | null = null;
		const capturedSubjectRequests: ResolveSubjectRequest[] = [];
		const outcome = runCurrentDependencyCruiserG4Closure(
			defaultCurrentDependencyCruiserG4ClosureRequest(fixture.root, null),
			dependencies(
				(executorRequest) => {
					capturedExecutor = executorRequest;
					return result(providerRaw(fixture.root));
				},
				{
					resolve: (subjectRequest) => {
						capturedSubjectRequests.push(subjectRequest);
						return {
							completeness: 'COMPLETE',
							diagnostics: [],
							outcome: 'resolved',
							subject: fixture.frozenSubject
						};
					}
				}
			)
		);
		expect(outcome.outcome).toBe('unavailable');
		expect(capturedExecutor).toMatchObject({
			args: CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_PROVIDER_ARGS,
			networkUse: 'NONE',
			shell: false,
			subjectEntryPoints: []
		});
		expect(capturedSubjectRequests).toHaveLength(1);
		expect(capturedSubjectRequests[0]).toMatchObject({
			outputs: [CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_EVIDENCE_PATH],
			scope: {
				kind: 'EXPLICIT_PROJECTS',
				projects: CURRENT_DEPENDENCY_CRUISER_PROJECT_PATHS
			}
		});
		expect(CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_INPUT_PATHS).toHaveLength(10);
		expect(
			CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_INPUT_PATHS.every(
				(path) => path.startsWith('packages/rph-contracts/src/') && path.endsWith('.ts')
			)
		).toBe(true);
	});

	it('uses one exact fixed local-provider argv with no shell, network use, or subject entrypoint', () => {
		let captured: CurrentDependencyCruiserExecutorRequest | null = null;
		const capturedSubjectRequests: ResolveSubjectRequest[] = [];
		const digest = discover(
			(executorRequest) => {
				captured = executorRequest;
				return result(providerRaw(fixture.root));
			},
			{
				resolve: (subjectRequest) => {
					capturedSubjectRequests.push(subjectRequest);
					return {
						completeness:
							fixture.frozenSubject.descriptor.dirtyState === 'UNKNOWN' ? 'PARTIAL' : 'COMPLETE',
						diagnostics: [],
						outcome: 'resolved',
						subject: fixture.frozenSubject
					};
				}
			}
		);
		expect(digest).toMatch(/^[0-9a-f]{64}$/u);
		expect(captured).not.toBeNull();
		expect(captured).toMatchObject({
			args: CURRENT_DEPENDENCY_CRUISER_PROVIDER_ARGS,
			cwd: fixture.root,
			executable: process.execPath,
			networkUse: 'NONE',
			shell: false,
			subjectEntryPoints: []
		});
		expect(captured!.args.slice(1, 3)).toEqual(CURRENT_DEPENDENCY_CRUISER_INPUT_PATHS);
		expect(captured!.args).toContain(CURRENT_DEPENDENCY_CRUISER_CONFIG_PATH);
		expect(capturedSubjectRequests).toHaveLength(1);
		const capturedSubjectRequest = capturedSubjectRequests[0]!;
		const expectedAdditionalArtifacts = [
			CURRENT_DEPENDENCY_CRUISER_CONFIG_PATH,
			CURRENT_DEPENDENCY_CRUISER_LOCK_PATH,
			'apps/demo/package.json',
			'packages/a/package.json',
			'packages/b/package.json',
			'tsconfig.json'
		].sort();
		expect(capturedSubjectRequest).toMatchObject({
			filters: { exclude: [] },
			outputs: [CURRENT_DEPENDENCY_CRUISER_EVIDENCE_PATH],
			scope: {
				kind: 'EXPLICIT_PROJECTS',
				projects: CURRENT_DEPENDENCY_CRUISER_PROJECT_PATHS
			}
		});
		if (capturedSubjectRequest.scope.kind !== 'EXPLICIT_PROJECTS')
			throw new Error('Expected one explicit-project subject request.');
		expect(capturedSubjectRequest.scope.projects).toEqual([
			'packages/rph-contracts/tsconfig.build.json'
		]);
		expect(capturedSubjectRequest.filters.include).toEqual(
			[...expectedAdditionalArtifacts, ...CURRENT_DEPENDENCY_CRUISER_SOURCE_INCLUDE_FILTERS].sort()
		);
		expect(capturedSubjectRequest.scope.additionalArtifacts).toEqual(expectedAdditionalArtifacts);
		expect(
			expectedAdditionalArtifacts.every((path) =>
				capturedSubjectRequest.filters.include.includes(path)
			)
		).toBe(true);
	});

	it('captures exact finite manifest, configuration, and declaration context without widening selected projects', () => {
		const contextFixture = createStructuralWorkspaceDependencyFixture();
		try {
			writeFileSync(join(contextFixture.root, 'packages/a/base.json'), '{}\n', 'utf8');
			mkdirSync(join(contextFixture.root, 'packages/a/dist'), { recursive: true });
			writeFileSync(
				join(contextFixture.root, 'packages/a/dist/index.d.ts'),
				'export interface ContextOnly {}\n',
				'utf8'
			);
			for (const [path, text] of [
				[
					CURRENT_DEPENDENCY_CRUISER_PACKAGE_PATH,
					JSON.stringify({ name: 'dependency-cruiser', version: '16.10.4' })
				],
				[CURRENT_DEPENDENCY_CRUISER_ENTRY_PATH, '#!/usr/bin/env node\n']
			] as const) {
				const absolute = join(contextFixture.root, ...path.split('/'));
				mkdirSync(dirname(absolute), { recursive: true });
				writeFileSync(absolute, text, 'utf8');
			}
			const capturedRequests: ResolveSubjectRequest[] = [];
			const outcome = runCurrentDependencyCruiserDifferential(
				defaultCurrentDependencyCruiserDifferentialRequest(contextFixture.root, null),
				{
					resolve: (subjectRequest) => {
						capturedRequests.push(subjectRequest);
						return {
							diagnostics: [
								{
									code: 'REPOSITORY_ROOT_INVALID',
									message: 'Intentional request-capture stop.',
									path: null,
									phase: 'RESOLVE',
									severity: 'ERROR'
								}
							],
							outcome: 'unavailable'
						};
					}
				}
			);
			expect(outcome).toMatchObject({
				diagnostics: [{ code: 'SUBJECT_RESOLUTION_FAILED' }],
				outcome: 'unavailable'
			});
			expect(capturedRequests).toHaveLength(1);
			const captured = capturedRequests[0]!;
			if (captured.scope.kind !== 'EXPLICIT_PROJECTS')
				throw new Error('Expected one explicit-project subject request.');
			expect(captured.scope.projects).toEqual(CURRENT_DEPENDENCY_CRUISER_PROJECT_PATHS);
			const expectedAdditionalArtifacts = [
				CURRENT_DEPENDENCY_CRUISER_CONFIG_PATH,
				CURRENT_DEPENDENCY_CRUISER_LOCK_PATH,
				'apps/demo/package.json',
				'packages/a/base.json',
				'packages/a/package.json',
				'packages/b/package.json',
				'tsconfig.json'
			].sort();
			expect(captured.filters).toEqual({
				exclude: [],
				include: [
					...expectedAdditionalArtifacts,
					...CURRENT_DEPENDENCY_CRUISER_SOURCE_INCLUDE_FILTERS
				].sort()
			});
			expect(captured.scope.additionalArtifacts).toEqual(expectedAdditionalArtifacts);
			expect(
				expectedAdditionalArtifacts.every((path) => captured.filters.include.includes(path))
			).toBe(true);
			expect(captured.scope.additionalArtifacts?.some((path) => path.includes('/dist/'))).toBe(
				false
			);
		} finally {
			contextFixture.cleanup();
		}
	});

	it('accepts the reviewed discovery digest with nonempty reconciled populations', () => {
		const digest = discover();
		const outcome = runCurrentDependencyCruiserDifferential(
			request(digest),
			dependencies(() => result(providerRaw(fixture.root)))
		);
		expect(outcome.outcome).toBe('accepted');
		if (outcome.outcome !== 'accepted') throw new Error(JSON.stringify(outcome));
		expect(outcome.evidence).toMatchObject({
			analysisAuthority: 'NONE',
			capabilityStatus: 'PARTIAL',
			gateEffect: 'NONE',
			graph: {
				edges: fixture.graph.edges.length,
				reconciles: true,
				representedModuleResolutions: fixture.semanticSnapshot.moduleResolutions.length,
				representedSources: fixture.semanticSnapshot.sources.length
			},
			reviewedBaseline: { expectedDifferentialDigest: digest, state: 'EXACT_MATCH' },
			subject: {
				contextArtifacts: 4,
				contextConfigurations: 1,
				contextWorkspaceManifests: 3,
				sourceIncludeFilters: CURRENT_DEPENDENCY_CRUISER_SOURCE_INCLUDE_FILTERS,
				populationReconciles: true
			}
		});
		expect(outcome.evidence.graph.nodes).toBeGreaterThan(0);
		expect(outcome.evidence.graph.edges).toBeGreaterThan(0);
		expect(outcome.evidence.differential.coverage.providerModules).toBeGreaterThan(0);
		expect(outcome.evidence.differential.coverage.dependencyCruiserDependencies).toBeGreaterThan(0);
		expect(outcome.evidence.differential.coverage.comparisonRecords).toBeGreaterThan(0);
		expect(outcome.evidence.differential.coverage.reconciles).toBe(true);
		expect(outcome.evidence.resourceGuard).toMatchObject({
			admittedContextArtifacts: 4,
			admittedManifestDerivedDeclarationRoots: 0,
			admittedProviderDependencies: 3,
			admittedProviderModules: 3,
			memoryCheckpointState: 'WITHIN_BOUND_AT_ALL_OPERATION_CHECKPOINTS'
		});
		expect(outcome.evidence.nonclaims).toContain('ARCHITECTURE_RULE_COMPLIANCE');
		expect(outcome.evidence.nonclaims).toContain('G4_PASS');
		expect(outcome.evidence.nonclaims).toContain('DECLARATION_CONTEXT_POST_PROVIDER_CURRENTNESS');
		expect(outcome.evidence.nonclaims).toContain('WHOLE_APPS_PACKAGES_FROZEN_SUBJECT_CLOSURE');
		expect(outcome.evidence.semanticSnapshot.projectionBoundary).toBe(
			'EXACT_ONE_PROJECT_RPH_CONTRACTS_BUILD_SLICE'
		);
		expect(outcome.evidence.nonclaims).toContain('MULTI_PROJECT_SEMANTIC_CLOSURE');
		expect(outcome.evidence.nonclaims).toContain(
			'OPTIONAL_DEPENDENCY_CRUISER_METADATA_INTERPRETATION'
		);
		expect(outcome.evidence.nonclaims).toContain('RPH_CONTRACTS_CHECK_TYPES_PROJECT_CLOSURE');
		expect(outcome.evidence.nonclaims).toContain('COMPILER_PROVIDER_PERIMETER_EQUIVALENCE');
		expect(outcome.evidence.nonclaims).toContain(
			'DIFFERENTIAL_DRIFT_LOCALIZATION_TO_COMPILER_SLICE'
		);
		expect(outcome.evidence.semanticSnapshot.declarationContext).toEqual({
			authority: 'CONTEXT_ONLY',
			currentness: 'NOT_RECHECKED_AFTER_PROVIDER',
			manifestDerivedRoots: 0,
			source: 'CAPTURED_WORKSPACE_MANIFEST_EXPORTS_TYPES'
		});
		expect(outcome.evidence.currentness.declarationContextState).toBe(
			'CONTEXT_ONLY_NOT_RECHECKED_AFTER_PROVIDER'
		);
		expect(outcome.evidence.currentness).toMatchObject({
			checkedAfterProviderExecution: true,
			checkedAtFinalEvidenceBoundary: true,
			state: 'CURRENT_FOR_CAPTURED_SUBJECT_AT_PROVIDER_AND_FINAL_BOUNDARIES'
		});
		expect(outcome.evidence.execution.stageOrder).toBe(
			'PROVIDER_COMPLETE_BEFORE_SEMANTIC_MATERIALIZATION'
		);
		expect(currentDependencyCruiserEvidenceDigestsAreValid(outcome.evidence)).toBe(true);
	});

	it('rejects comparison tampering even when both persisted envelope digests are recomputed', () => {
		const digest = discover();
		const outcome = runCurrentDependencyCruiserDifferential(
			request(digest),
			dependencies(() => result(providerRaw(fixture.root)))
		);
		expect(outcome.outcome).toBe('accepted');
		if (outcome.outcome !== 'accepted') throw new Error(JSON.stringify(outcome));
		const firstRecord = outcome.evidence.differential.comparison.records[0]!;
		const changedDifferential = {
			...outcome.evidence.differential,
			comparison: {
				...outcome.evidence.differential.comparison,
				records: Object.freeze([
					{ ...firstRecord, rationale: `${firstRecord.rationale} TAMPERED` },
					...outcome.evidence.differential.comparison.records.slice(1)
				])
			}
		};
		const {
			contentDigest: _originalDifferentialContentDigest,
			...differentialWithoutContentDigest
		} = changedDifferential;
		const differential = {
			...differentialWithoutContentDigest,
			contentDigest: sha256(canonicalSemanticJson(differentialWithoutContentDigest))
		};
		const { contentDigest: _originalContentDigest, ...withoutContentDigest } = outcome.evidence;
		const tamperedWithoutContentDigest = { ...withoutContentDigest, differential };
		const tampered = {
			...tamperedWithoutContentDigest,
			contentDigest: sha256(canonicalJson(tamperedWithoutContentDigest))
		} as typeof outcome.evidence;
		expect(currentDependencyCruiserEvidenceDigestsAreValid(tampered)).toBe(false);
	});

	it('bounds manifest-derived declaration roots as context-only evidence', () => {
		const contextSubject: FrozenSubject = {
			...fixture.frozenSubject,
			workspaces: fixture.frozenSubject.workspaces.map((workspace) =>
				workspace.path === 'packages/a'
					? {
							...workspace,
							exports: [
								{
									conditions: ['types'],
									exportName: '.',
									target: './dist/index.d.ts'
								}
							]
						}
					: workspace
			)
		};
		const overrides: CurrentDependencyCruiserDifferentialDependencies = {
			resolve: () => ({
				completeness: 'COMPLETE',
				diagnostics: [],
				outcome: 'resolved',
				subject: contextSubject
			})
		};
		const digest = discover(() => result(providerRaw(fixture.root)), overrides);
		const outcome = runCurrentDependencyCruiserDifferential(
			request(digest),
			dependencies(() => result(providerRaw(fixture.root)), overrides)
		);
		expect(outcome.outcome).toBe('accepted');
		if (outcome.outcome !== 'accepted') throw new Error(JSON.stringify(outcome));
		expect(outcome.evidence.resourceGuard).toMatchObject({
			admittedManifestDerivedDeclarationRoots: 1,
			maxContextPopulationRecords: expect.any(Number)
		});
		expect(
			outcome.evidence.resourceGuard.admittedManifestDerivedDeclarationRoots
		).toBeLessThanOrEqual(outcome.evidence.resourceGuard.maxContextPopulationRecords);
		expect(outcome.evidence.semanticSnapshot.declarationContext).toMatchObject({
			authority: 'CONTEXT_ONLY',
			manifestDerivedRoots: 1,
			source: 'CAPTURED_WORKSPACE_MANIFEST_EXPORTS_TYPES'
		});
	});

	it('rejects reviewed-baseline drift after discovery', () => {
		const outcome = runCurrentDependencyCruiserDifferential(
			request('0'.repeat(64)),
			dependencies(() => result(providerRaw(fixture.root)))
		);
		expect(outcome.outcome).toBe('rejected');
		if (outcome.outcome !== 'rejected') throw new Error(JSON.stringify(outcome));
		expect(outcome.diagnostics[0].code).toBe('DIFFERENTIAL_DRIFT');
	});

	it('fails closed when the subject drifts after provider execution', () => {
		const phases: string[] = [];
		const outcome = runCurrentDependencyCruiserDifferential(
			request(null),
			dependencies(
				() => {
					phases.push('execute');
					return result(providerRaw(fixture.root));
				},
				{
					verifyCurrentness: () => {
						phases.push('verify');
						return { changedPaths: ['packages/a/src/a.ts'], diagnostics: [], state: 'STALE' };
					}
				}
			)
		);
		expect(phases).toEqual(['execute', 'verify']);
		expect(outcome).toMatchObject({
			diagnostics: [{ code: 'SUBJECT_CURRENTNESS_FAILED' }],
			outcome: 'unavailable'
		});
	});

	it('finishes provider execution before semantic materialization and checks final currentness after both', () => {
		const phases: string[] = [];
		let providerFinished = false;
		let semanticFinished = false;
		let currentnessChecks = 0;
		const outcome = runCurrentDependencyCruiserDifferential(
			request(null),
			dependencies(
				() => {
					phases.push('provider:start');
					providerFinished = true;
					phases.push('provider:finish');
					return result(providerRaw(fixture.root));
				},
				{
					buildSemantic: () => {
						expect(providerFinished).toBe(true);
						phases.push('semantic:start');
						semanticFinished = true;
						phases.push('semantic:finish');
						return {
							diagnostics: [],
							outcome: 'complete',
							snapshot: fixture.semanticSnapshot
						};
					},
					verifyCurrentness: () => {
						currentnessChecks += 1;
						if (currentnessChecks === 1) {
							expect(providerFinished).toBe(true);
							expect(semanticFinished).toBe(false);
							phases.push('currentness:post-provider');
						} else {
							expect(semanticFinished).toBe(true);
							phases.push('currentness:final');
						}
						return { changedPaths: [], diagnostics: [], state: 'CURRENT' };
					}
				}
			)
		);
		expect(outcome).toMatchObject({
			diagnostics: [{ code: 'BASELINE_REQUIRED' }],
			outcome: 'rejected'
		});
		expect(currentnessChecks).toBe(2);
		expect(phases).toEqual([
			'provider:start',
			'provider:finish',
			'currentness:post-provider',
			'semantic:start',
			'semantic:finish',
			'currentness:final'
		]);
	});

	it.each([
		[
			'timeout',
			result('', {
				errorCode: 'ETIMEDOUT',
				errorMessage: 'timed out',
				status: null,
				timedOut: true
			}),
			'PROCESS_TIMEOUT'
		],
		[
			'crash',
			result('', { errorCode: 'ENOENT', errorMessage: 'missing', status: null }),
			'PROCESS_CRASH'
		],
		[
			'bounded output overflow',
			result('', { errorCode: 'ENOBUFS', errorMessage: 'buffer full', status: null }),
			'PROCESS_OUTPUT_OVERSIZE'
		],
		['malformed output', result('{not-json'), 'PROVIDER_OUTPUT_INVALID']
	] as const)('fails closed on provider %s', (_name, executorResult, code) => {
		const outcome = runCurrentDependencyCruiserDifferential(
			request(null),
			dependencies(() => executorResult)
		);
		expect(outcome.outcome).toBe('unavailable');
		if (outcome.outcome !== 'unavailable') throw new Error(JSON.stringify(outcome));
		expect(outcome.diagnostics[0].code).toBe(code);
	});

	it('preflights provider JSON cardinality, baseDir identity, and lexical integrity', () => {
		const raw = providerRaw(fixture.root);
		const marker = `"baseDir":${JSON.stringify(fixture.root)}`;
		const empty = JSON.stringify({
			modules: [],
			summary: {
				error: 0,
				ignore: 0,
				info: 0,
				optionsUsed: { baseDir: fixture.root },
				totalCruised: 0,
				totalDependenciesCruised: 0,
				violations: [],
				warn: 0
			}
		});
		const cases = [
			['unterminated string', '{"baseDir":"unterminated}', 'PROVIDER_OUTPUT_INVALID', undefined],
			[
				'dependency bound',
				raw,
				'PROVIDER_CARDINALITY_EXCEEDED',
				(value: CurrentDependencyCruiserDifferentialRequest) => ({
					...value,
					budgets: { ...value.budgets, maxProviderDependencies: 2 }
				})
			],
			[
				'non-string baseDir',
				raw.replace(marker, '"baseDir":0'),
				'PROVIDER_OUTPUT_INVALID',
				undefined
			],
			[
				'malformed baseDir',
				raw.replace(marker, '"baseDir":"\\u"'),
				'PROVIDER_OUTPUT_INVALID',
				undefined
			],
			[
				'missing baseDir',
				raw.replace(marker, `"other":${JSON.stringify(fixture.root)}`),
				'PROVIDER_BASE_DIR_MISMATCH',
				undefined
			],
			[
				'duplicate baseDir',
				raw.replace(marker, `${marker},${marker}`),
				'PROVIDER_BASE_DIR_MISMATCH',
				undefined
			],
			[
				'wrong baseDir',
				raw.replace(marker, '"baseDir":"relative"'),
				'PROVIDER_BASE_DIR_MISMATCH',
				undefined
			],
			['empty population', empty, 'PROVIDER_OUTPUT_INVALID', undefined]
		] as const;
		for (const [_name, candidateRaw, code, mutate] of cases) {
			const outcome = runCurrentDependencyCruiserDifferential(
				request(null, mutate),
				dependencies(() => result(candidateRaw))
			);
			expect(outcome).toMatchObject({ diagnostics: [{ code }], outcome: 'unavailable' });
		}
		const escapedKey = raw.replace('"baseDir"', '"base\\u0044ir"');
		expect(
			runCurrentDependencyCruiserDifferential(
				request(null),
				dependencies(() => result(` \n${escapedKey}\r\n `))
			)
		).toMatchObject({ diagnostics: [{ code: 'BASELINE_REQUIRED' }], outcome: 'rejected' });
	});

	it('fails closed for invalid request, subject, semantic, graph, and final-currentness stages', () => {
		const invalidRequest = runCurrentDependencyCruiserDifferential(
			{
				...request(null),
				operationVersion: 'unsupported'
			} as unknown as CurrentDependencyCruiserDifferentialRequest,
			dependencies(() => result(providerRaw(fixture.root)))
		);
		expect(invalidRequest).toMatchObject({
			diagnostics: [{ code: 'REQUEST_INVALID' }],
			outcome: 'unavailable'
		});

		const emptySubject = runCurrentDependencyCruiserDifferential(
			request(null),
			dependencies(() => result(providerRaw(fixture.root)), {
				resolve: () => ({
					completeness: 'COMPLETE',
					diagnostics: [],
					outcome: 'resolved',
					subject: { ...fixture.frozenSubject, artifacts: [] }
				})
			})
		);
		expect(emptySubject).toMatchObject({
			diagnostics: [{ code: 'SUBJECT_POPULATION_INVALID' }],
			outcome: 'unavailable'
		});

		const missingContext = runCurrentDependencyCruiserDifferential(
			request(null),
			dependencies(() => result(providerRaw(fixture.root)), {
				resolve: () => ({
					completeness: 'COMPLETE',
					diagnostics: [],
					outcome: 'resolved',
					subject: {
						...fixture.frozenSubject,
						artifacts: fixture.frozenSubject.artifacts.filter(
							(artifact) => artifact.path !== CURRENT_DEPENDENCY_CRUISER_CONFIG_PATH
						)
					}
				})
			})
		);
		expect(missingContext).toMatchObject({
			diagnostics: [{ code: 'SUBJECT_POPULATION_INVALID' }],
			outcome: 'unavailable'
		});

		for (const [code, overrides] of [
			[
				'SEMANTIC_UNAVAILABLE',
				{
					buildSemantic: () =>
						({
							diagnostics: [{ message: 'semantic unavailable' }],
							outcome: 'unavailable'
						}) as never
				}
			],
			[
				'SEMANTIC_INVALID',
				{
					validateSemantic: () =>
						({ issues: [{ message: 'invalid semantic' }], state: 'INVALID' }) as never
				}
			],
			[
				'GRAPH_UNAVAILABLE',
				{
					buildGraph: () =>
						({
							diagnostics: [{ message: 'graph unavailable' }],
							outcome: 'unavailable'
						}) as never
				}
			],
			[
				'GRAPH_INVALID',
				{
					validateGraph: () =>
						({ issues: [{ message: 'invalid graph' }], state: 'INVALID' }) as never
				}
			]
		] as const) {
			const outcome = runCurrentDependencyCruiserDifferential(
				request(null),
				dependencies(() => result(providerRaw(fixture.root)), overrides)
			);
			expect(outcome).toMatchObject({ diagnostics: [{ code }], outcome: 'unavailable' });
		}

		let checks = 0;
		const staleAtFinalBoundary = runCurrentDependencyCruiserDifferential(
			request(null),
			dependencies(() => result(providerRaw(fixture.root)), {
				verifyCurrentness: () =>
					++checks === 1
						? { changedPaths: [], diagnostics: [], state: 'CURRENT' }
						: { changedPaths: ['packages/a/src/a.ts'], diagnostics: [], state: 'STALE' }
			})
		);
		expect(staleAtFinalBoundary).toMatchObject({
			diagnostics: [{ code: 'SUBJECT_CURRENTNESS_FAILED' }],
			outcome: 'unavailable'
		});

		const digest = discover();
		const evidenceOversize = runCurrentDependencyCruiserDifferential(
			request(digest, (value) => ({
				...value,
				budgets: { ...value.budgets, maxEvidenceBytes: 1 }
			})),
			dependencies(() => result(providerRaw(fixture.root)))
		);
		expect(evidenceOversize).toMatchObject({
			diagnostics: [{ code: 'EVIDENCE_OVERSIZE' }],
			outcome: 'unavailable'
		});
	});

	it('fails closed on explicit stdout and stderr oversize bounds', () => {
		for (const stream of ['stdout', 'stderr'] as const) {
			const raw = providerRaw(fixture.root);
			const executorResult =
				stream === 'stdout' ? result(raw) : result(raw, { stderr: 'too-large' });
			const outcome = runCurrentDependencyCruiserDifferential(
				request(null, (value) => ({
					...value,
					budgets: {
						...value.budgets,
						[stream === 'stdout' ? 'maxStdoutBytes' : 'maxStderrBytes']: 4
					}
				})),
				dependencies(() => executorResult)
			);
			expect(outcome).toMatchObject({
				diagnostics: [{ code: 'PROCESS_OUTPUT_OVERSIZE' }],
				outcome: 'unavailable'
			});
		}
	});

	it('refuses provider cardinality before normalization expansion', () => {
		const outcome = runCurrentDependencyCruiserDifferential(
			request(null, (value) => ({
				...value,
				budgets: { ...value.budgets, maxProviderModules: 2 }
			})),
			dependencies(() => result(providerRaw(fixture.root)))
		);
		expect(outcome).toMatchObject({
			diagnostics: [{ code: 'PROVIDER_CARDINALITY_EXCEEDED', phase: 'NORMALIZE' }],
			outcome: 'unavailable'
		});
	});

	it('refuses an exceeded process-memory checkpoint before provider execution', () => {
		let executed = false;
		const outcome = runCurrentDependencyCruiserDifferential(
			request(null),
			dependencies(
				() => {
					executed = true;
					return result(providerRaw(fixture.root));
				},
				{
					memoryUsage: () => ({
						arrayBuffers: 0,
						external: 0,
						heapTotal: 0,
						heapUsed: 0,
						rss: 7 * 1024 * 1024 * 1024
					})
				}
			)
		);
		expect(executed).toBe(false);
		expect(outcome).toMatchObject({
			diagnostics: [{ code: 'RESOURCE_MEMORY_EXCEEDED', phase: 'REQUEST' }],
			outcome: 'unavailable'
		});
	});

	it('emits deterministic canonical evidence under an injected clock and executor', () => {
		const digest = discover();
		const first = runCurrentDependencyCruiserDifferential(
			request(digest),
			dependencies(() => result(providerRaw(fixture.root)))
		);
		const second = runCurrentDependencyCruiserDifferential(
			request(digest),
			dependencies(() => result(providerRaw(fixture.root)))
		);
		expect(first.outcome).toBe('accepted');
		expect(second).toEqual(first);
		if (first.outcome !== 'accepted') throw new Error(JSON.stringify(first));
		expect(first.evidence.execution.durationMs).toBe(25);
		expect(first.evidence.subject.projectPaths).toEqual(CURRENT_DEPENDENCY_CRUISER_PROJECT_PATHS);
		expect(first.evidence.contentDigest).toMatch(/^[0-9a-f]{64}$/u);
	});
});
