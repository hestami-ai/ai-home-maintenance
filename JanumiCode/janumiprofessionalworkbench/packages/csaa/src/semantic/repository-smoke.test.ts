import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
	MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_REQUEST_SCHEMA_VERSION,
	SUBJECT_POLICY_VERSION,
	SUBJECT_REQUEST_SCHEMA_VERSION,
	type ResolveSubjectRequest,
	buildModuleDependencyGraph,
	buildStaticSemanticSnapshot,
	canonicalSemanticJsonWitness,
	resolveSubject,
	validateModuleDependencyGraph,
	validateStaticSemanticSnapshot
} from '@janumipwb/csaa';

const SMOKE_SELECTOR = process.env.CSAA_REPOSITORY_SMOKE;
const RUN_REPOSITORY_SMOKE =
	SMOKE_SELECTOR !== undefined && SMOKE_SELECTOR !== '' && SMOKE_SELECTOR !== '0';
// Generous fail-safe ceilings for this opt-in repository smoke only. They are
// not product defaults, SLOs, or owner-authorized normative performance thresholds.
const REPOSITORY_SMOKE_SUBJECT_MAX_BYTES = 1_000_000_000;
const REPOSITORY_SMOKE_SEMANTIC_MAX_DURATION_MS = 900_000;
const REPOSITORY_SMOKE_SNAPSHOT_MAX_BYTES = 1_000_000_000;
// Leaves runner-level margin after the semantic deadline for failure reporting and cleanup.
const REPOSITORY_SMOKE_TEST_TIMEOUT_MS = 1_200_000;
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

function resolveSmokeSubject(scope: ResolveSubjectRequest['scope']) {
	return resolveSubject({
		budgets: {
			maxBytes: REPOSITORY_SMOKE_SUBJECT_MAX_BYTES,
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

describe('current JPWB repository semantic and module-graph smoke', () => {
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
						maxDurationMs: REPOSITORY_SMOKE_SEMANTIC_MAX_DURATION_MS,
						maxLiteralCharacters: 10_000,
						maxPathCharacters: 4_096,
						maxProjects: 200,
						maxSnapshotBytes: REPOSITORY_SMOKE_SNAPSHOT_MAX_BYTES,
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
			process.stdout.write(
				`${JSON.stringify({
					artifactCount: subject.artifacts.length,
					event: 'CSAA_REPOSITORY_SMOKE_RESULT',
					graphBytes: graphWitness.bytes,
					graphDurationMs,
					graphEdgeCount: graph.edges.length,
					graphHealth: graph.health,
					graphNodeCount: graph.nodes.length,
					outcome: outcome.outcome,
					projectCount: snapshot.projects.length,
					selector: SMOKE_SELECTOR,
					semanticDurationMs,
					snapshotBytes: canonicalWitness.bytes,
					sourceCount: snapshot.sources.length,
					subjectArtifactBytes: subject.artifacts.reduce(
						(total, artifact) => total + artifact.bytes,
						0
					)
				})}\n`
			);
		},
		REPOSITORY_SMOKE_TEST_TIMEOUT_MS
	);
});
