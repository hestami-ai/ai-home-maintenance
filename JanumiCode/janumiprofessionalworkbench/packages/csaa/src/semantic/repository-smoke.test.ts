import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_REQUEST_SCHEMA_VERSION,
	SUBJECT_POLICY_VERSION,
	SUBJECT_REQUEST_SCHEMA_VERSION,
	buildStaticSemanticSnapshot,
	canonicalSemanticJsonWitness,
	resolveSubject,
	validateStaticSemanticSnapshot
} from '@janumipwb/csaa';

const RUN_REPOSITORY_SMOKE = process.env.CSAA_REPOSITORY_SMOKE === '1';
const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

describe('current JPWB repository semantic smoke', () => {
	it.runIf(RUN_REPOSITORY_SMOKE)('freezes, replays, and validates every discovered TypeScript project', () => {
		const subjectOutcome = resolveSubject({
			budgets: { maxBytes: 1_000_000_000, maxConfigDepth: 64, maxDiagnostics: 100_000, maxDurationMs: 180_000, maxFiles: 100_000, maxProjects: 200 },
			expectEmpty: false,
			filters: { exclude: [], include: [] },
			operationVersion: 'jan-csaa-repository-smoke/1.0.0',
			outputs: [],
			policyVersion: SUBJECT_POLICY_VERSION,
			rootLocator: REPOSITORY_ROOT,
			schemaVersion: SUBJECT_REQUEST_SCHEMA_VERSION,
			scope: { kind: 'REPOSITORY' },
			subjectKind: 'WORKTREE'
		});
		expect(subjectOutcome.outcome, JSON.stringify(subjectOutcome)).toBe('resolved');
		if (subjectOutcome.outcome !== 'resolved') throw new Error(JSON.stringify(subjectOutcome));
		const subject = subjectOutcome.subject;
		const projectPaths = subject.projects.map((project) => project.configPath);
		expect(projectPaths).toEqual(expect.arrayContaining([
			'apps/rph-demo/tsconfig.json',
			'packages/csaa/tsconfig.json',
			'scripts/tsconfig.json',
			'verif/tsconfig.json'
		]));

		const outcome = buildStaticSemanticSnapshot({
			budgets: {
				maxAstDepth: 2_048,
				maxAstNodes: 5_000_000,
				maxCompilerInputMetadataBytes: 536_870_912,
				maxCompilerQueries: 5_000_000,
				maxCompilerQueryInvocations: 50_000_000,
				maxContextBytes: 536_870_912,
				maxContextFileBytes: 67_108_864,
				maxContextFiles: 100_000,
				maxDiagnosticCharacters: 50_000_000,
				maxDiagnostics: 500_000,
				maxDirectoryEntries: 5_000_000,
				maxDurationMs: 900_000,
				maxLiteralCharacters: 10_000,
				maxPathCharacters: 4_096,
				maxProjects: 200,
				maxSnapshotBytes: 1_000_000_000,
				maxSources: 100_000
			},
			capabilities: ['TS_PROJECT', 'TS_SYNTAX'],
			expectEmpty: false,
			operationVersion: SEMANTIC_OPERATION_VERSION,
			rootLocator: REPOSITORY_ROOT,
			schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
			subjectId: subject.descriptor.subjectId
		}, { subject });
		const outcomeSummary = JSON.stringify({ diagnostics: outcome.diagnostics, outcome: outcome.outcome });
		expect(['complete', 'partial'], outcomeSummary).toContain(outcome.outcome);
		if (outcome.outcome !== 'complete' && outcome.outcome !== 'partial') throw new Error(outcomeSummary);
		const snapshot = outcome.snapshot;
		expect(validateStaticSemanticSnapshot(snapshot, {
			maxDepth: 4_096,
			maxDiagnostics: snapshot.budgets.maxDiagnostics,
			maxIssues: 100_000,
			maxRecords: snapshot.budgets.maxSnapshotBytes,
			maxReferenceChecks: snapshot.budgets.maxSnapshotBytes,
			maxStringCharacters: snapshot.budgets.maxSnapshotBytes
		}, { frozenSubject: subject })).toEqual({ issues: [], state: 'VALID' });
		expect(snapshot.projects).toHaveLength(subject.projects.length);
		expect(snapshot.programs).toHaveLength(subject.projects.length);
		expect(snapshot.sources.length).toBeGreaterThan(0);
		expect(snapshot.astNodes.length).toBeGreaterThan(snapshot.sources.length);
		expect(snapshot.declarationCandidates.length).toBeGreaterThan(0);
		const canonicalWitness = canonicalSemanticJsonWitness(snapshot);
		expect(canonicalWitness.bytes).toBeLessThanOrEqual(snapshot.budgets.maxSnapshotBytes);
		expect(canonicalWitness.sha256).toMatch(/^[a-f0-9]{64}$/u);
	}, 1_200_000);
});
