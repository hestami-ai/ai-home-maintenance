import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	CALL_GRAPH_OPERATION_VERSION,
	CALL_GRAPH_REQUEST_SCHEMA_VERSION,
	DEPENDENCY_CRUISER_INVOCATION_SCHEMA_VERSION,
	DEPENDENCY_CRUISER_ARGV_GRAMMAR_VERSION,
	DEPENDENCY_CRUISER_PROVIDER_ID,
	DEPENDENCY_CRUISER_PROVIDER_VERSION,
	DEPENDENCY_CRUISER_RAW_SCHEMA_ID,
	DEPENDENCY_PROVIDER_COMPARISON_OPERATION_VERSION,
	DEPENDENCY_PROVIDER_COMPARISON_REQUEST_SCHEMA_VERSION,
	MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
	MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_REQUEST_SCHEMA_VERSION,
	STATE_MACHINE_GRAPH_OPERATION_VERSION,
	STATE_MACHINE_GRAPH_REQUEST_SCHEMA_VERSION,
	STATE_MACHINE_TOPOLOGY_OBSERVATION_OPERATION_VERSION,
	STATE_MACHINE_TOPOLOGY_OBSERVATION_REQUEST_SCHEMA_VERSION,
	SUBJECT_POLICY_VERSION,
	SUBJECT_REQUEST_SCHEMA_VERSION,
	type ResolveSubjectRequest,
	buildCallGraph,
	buildModuleDependencyGraph,
	buildStaticSemanticSnapshot,
	buildStateMachineGraph,
	canonicalSemanticJson,
	canonicalSemanticJsonWitness,
	compareDependencyProviders,
	normalizeDependencyCruiserOutput,
	observeStateMachineTopology,
	resolveSubject,
	sha256,
	validateDependencyCruiserObservation,
	validateDependencyProviderComparison,
	validateModuleDependencyGraph,
	validateStateMachineGraph,
	validateStateMachineTopologyObservation,
	validateStaticSemanticSnapshot
} from '@janumipwb/csaa';

const SMOKE_SELECTOR = process.env.CSAA_REPOSITORY_SMOKE;
const RUN_REPOSITORY_SMOKE =
	SMOKE_SELECTOR !== undefined && SMOKE_SELECTOR !== '' && SMOKE_SELECTOR !== '0';
// Provisional runaway guards required by the budgeted APIs and test runner for this opt-in
// smoke. They are not empirically established operating ceilings, product defaults, SLOs, or
// acceptance targets. Snapshot bytes are canonical JSON UTF-8 bytes; semantic duration is
// observed at phase checkpoints rather than by cancelling computation at an exact instant.
const REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES = 1_000_000_000;
const REPOSITORY_SMOKE_FAILSAFE_SEMANTIC_DURATION_MS = 3_600_000;
const REPOSITORY_SMOKE_FAILSAFE_SNAPSHOT_BYTES = 1_000_000_000;
// Leaves runner-level margin after the semantic guard for failure reporting and cleanup.
const REPOSITORY_SMOKE_FAILSAFE_TEST_TIMEOUT_MS = 3_900_000;
const REPOSITORY_SMOKE_FAILSAFE_PROVIDER_DURATION_MS = 300_000;
// Dependency-closed real domain slice; the separate CSAA smoke covers the analyzer Program.
const REPRESENTATIVE_PROJECTS = [
	'packages/rph-contracts/tsconfig.json',
	'packages/rph-domain/tsconfig.json'
] as const;
const SELECTED_PROJECTS =
	SMOKE_SELECTOR === 'all'
		? null
		: SMOKE_SELECTOR === undefined || SMOKE_SELECTOR === '1'
			? REPRESENTATIVE_PROJECTS
			: SMOKE_SELECTOR.split(',')
					.map((path) => path.trim())
					.filter((path) => path.length > 0);
const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

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
			maxConfigDepth: 64,
			maxDiagnostics: 100_000,
			maxDurationMs: 180_000,
			maxFiles: 100_000,
			maxProjects: 200
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

describe('current JPWB repository semantic and graph smoke', () => {
	it.runIf(RUN_REPOSITORY_SMOKE)(
		'freezes, replays, validates, and projects the selected TypeScript project closure',
		() => {
			if (SELECTED_PROJECTS !== null) {
				const repositoryOutcome = resolveSmokeSubject({ kind: 'REPOSITORY' });
				expect(repositoryOutcome.outcome, JSON.stringify(repositoryOutcome)).toBe('resolved');
				if (repositoryOutcome.outcome !== 'resolved')
					throw new Error(JSON.stringify(repositoryOutcome));
				const discoveredProjectPaths = repositoryOutcome.subject.projects.map(
					(project) => project.configPath
				);
				expect(discoveredProjectPaths).toEqual(
					expect.arrayContaining([...REPRESENTATIVE_PROJECTS])
				);
				expect(discoveredProjectPaths.length).toBeGreaterThan(REPRESENTATIVE_PROJECTS.length);
			}
			const subjectOutcome = resolveSmokeSubject(
				SELECTED_PROJECTS === null
					? { kind: 'REPOSITORY' }
					: { kind: 'EXPLICIT_PROJECTS', projects: SELECTED_PROJECTS }
			);
			expect(subjectOutcome.outcome, JSON.stringify(subjectOutcome)).toBe('resolved');
			if (subjectOutcome.outcome !== 'resolved') throw new Error(JSON.stringify(subjectOutcome));
			const subject = subjectOutcome.subject;
			const projectPaths = subject.projects.map((project) => project.configPath);
			expect(projectPaths).toEqual(
				expect.arrayContaining([...(SELECTED_PROJECTS ?? REPRESENTATIVE_PROJECTS)])
			);

			const semanticStartedAt = Date.now();
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
					capabilities: ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX', 'TS_TYPE'],
					expectEmpty: false,
					operationVersion: SEMANTIC_OPERATION_VERSION,
					rootLocator: REPOSITORY_ROOT,
					schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
					subjectId: subject.descriptor.subjectId
				},
				{ subject }
			);
			const outcomeSummary = JSON.stringify({
				diagnostics: outcome.diagnostics,
				outcome: outcome.outcome
			});
			expect(['complete', 'partial'], outcomeSummary).toContain(outcome.outcome);
			if (outcome.outcome !== 'complete' && outcome.outcome !== 'partial')
				throw new Error(outcomeSummary);
			const snapshot = outcome.snapshot;
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
			const canonicalWitness = canonicalSemanticJsonWitness(snapshot);
			expect(canonicalWitness.bytes).toBeLessThanOrEqual(snapshot.budgets.maxSnapshotBytes);
			expect(canonicalWitness.sha256).toMatch(/^[a-f0-9]{64}$/u);
			const semanticDurationMs = Date.now() - semanticStartedAt;
			const graphStartedAt = Date.now();
			const graphOutcome = buildModuleDependencyGraph(
				{
					operationVersion: MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
					schemaVersion: MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
					semanticSnapshotId: snapshot.id,
					subjectId: snapshot.subjectId
				},
				snapshot
			);
			expect(['complete', 'partial'], JSON.stringify(graphOutcome)).toContain(graphOutcome.outcome);
			if (graphOutcome.outcome === 'unavailable') throw new Error(JSON.stringify(graphOutcome));
			const graph = graphOutcome.graph;
			expect(validateModuleDependencyGraph(graph, snapshot)).toEqual({
				issues: [],
				state: 'VALID'
			});
			expect(graph.coverage.reconciles).toBe(true);
			expect(graph.coverage.representedSources).toBe(snapshot.sources.length);
			expect(graph.coverage.representedModuleResolutions).toBe(snapshot.moduleResolutions.length);
			expect(graph.edges).toHaveLength(snapshot.moduleResolutions.length);
			const graphWitness = canonicalSemanticJsonWitness(graph);
			const graphDurationMs = Date.now() - graphStartedAt;
			const callGraphStartedAt = Date.now();
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
			const callGraph = callGraphOutcome.graph;
			expect(callGraph.coverage.reconciles).toBe(true);
			expect(callGraph.coverage.representedCallSites).toBe(snapshot.invocations.length);
			expect(callGraph.coverage.closure).toBe('OPEN');
			expect(callGraph.coverage.wholeProgramReachability).toBe('NOT_CLAIMED');
			const callGraphWitness = canonicalSemanticJsonWitness(callGraph);
			const callGraphDurationMs = Date.now() - callGraphStartedAt;
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
			if (stateMachineArtifact !== undefined) {
				const stateMachineStartedAt = Date.now();
				const populationBudget = Math.max(1, stateMachineArtifact.bytes);
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
				const matchingSources = snapshot.sources.filter(
					(source) => source.logicalPath === stateMachineArtifact.path
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
				stateMachineResult = {
					bytes: stateMachineWitness.bytes,
					crossAxisRules: observation.crossAxisRules.length,
					durationMs: Date.now() - stateMachineStartedAt,
					edges: stateMachineGraph.edges.length,
					machines: observation.machines.length,
					nodes: stateMachineGraph.nodes.length,
					states: observation.states.length,
					transitions:
						observation.legalTransitions.length + observation.explicitlyIllegalTransitions.length
				};
			}

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
			const providerStartedMs = Date.now();
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
				throw new Error('dependency-cruiser did not report the expected absolute subject root.');
			expect(resolve(providerReportedBaseDir)).toBe(resolve(REPOSITORY_ROOT));
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
			expect(providerNormalization.outcome, JSON.stringify(providerNormalization)).toBe('complete');
			if (providerNormalization.outcome === 'unavailable')
				throw new Error(JSON.stringify(providerNormalization));
			const providerObservation = providerNormalization.observation;
			expect(validateDependencyCruiserObservation(providerObservation)).toEqual({
				issues: [],
				state: 'VALID'
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
			process.stdout.write(
				`${JSON.stringify({
					artifactCount: subject.artifacts.length,
					callGraphBytes: callGraphWitness.bytes,
					callGraphCandidateCallSites: callGraph.coverage.candidateSetCallSites,
					callGraphDurationMs,
					callGraphExternalDispatchCallSites: callGraph.coverage.externalDispatchCallSites,
					callGraphNodeCount: callGraph.nodes.length,
					callGraphTargetEdgeCount: callGraph.coverage.targetEdges,
					callGraphUnresolvedCallSites: callGraph.coverage.unresolvedCallSites,
					callGraphUnsupportedCallSites: callGraph.coverage.unsupportedCallSites,
					event: 'CSAA_REPOSITORY_SMOKE_RESULT',
					graphBytes: graphWitness.bytes,
					graphDurationMs,
					graphEdgeCount: graph.edges.length,
					graphHealth: graph.health,
					graphNodeCount: graph.nodes.length,
					outcome: outcome.outcome,
					providerComparisonAgreementRecords: comparison.coverage.agreementRecords,
					providerComparisonCorroborationRecords: comparison.coverage.corroborationRecords,
					providerComparisonIncomparableRecords: comparison.coverage.incomparableRecords,
					providerComparisonObservedDifferenceRecords:
						comparison.coverage.observedDifferenceRecords,
					providerComparisonRecordCount: comparison.coverage.recordCount,
					providerDependencyCount: providerObservation.dependencies.length,
					providerDurationMs: Date.now() - providerStartedMs,
					providerHealth: providerObservation.health,
					providerModuleCount: providerObservation.modules.length,
					projectCount: snapshot.projects.length,
					selector: SMOKE_SELECTOR,
					semanticDurationMs,
					snapshotBytes: canonicalWitness.bytes,
					stateMachine: stateMachineResult,
					sourceCount: snapshot.sources.length,
					subjectArtifactBytes: subject.artifacts.reduce(
						(total, artifact) => total + artifact.bytes,
						0
					)
				})}\n`
			);
		},
		REPOSITORY_SMOKE_FAILSAFE_TEST_TIMEOUT_MS
	);
});
