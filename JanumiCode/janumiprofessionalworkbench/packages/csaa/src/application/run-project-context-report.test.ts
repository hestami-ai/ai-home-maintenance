import { Buffer } from 'node:buffer';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	PROJECT_CONTEXT_REPORT_NONCLAIMS,
	PROJECT_CONTEXT_REPORT_OPERATION_VERSION,
	PROJECT_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION,
	PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS,
	type ProjectContextReportRequest
} from '../contracts/project-context-report.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import {
	PROJECT_CONTEXT_REPORT_PROGRESS_NONCLAIMS,
	PROJECT_CONTEXT_REPORT_PROGRESS_SCHEMA_VERSION,
	captureProjectContextReportPipeline,
	captureSemanticReportPipeline,
	projectContextReportExitCode,
	runProjectContextReport,
	type ProjectContextReportProgressEvent
} from './run-project-context-report.js';

const temporaryRoots: string[] = [];

function write(root: string, path: string, contents: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, contents, 'utf8');
}

function json(root: string, path: string, value: unknown): void {
	write(root, path, `${JSON.stringify(value, null, 2)}\n`);
}

function fixture(): string {
	const root = mkdtempSync(join(tmpdir(), 'csaa-project-context-report-'));
	temporaryRoots.push(root);
	json(root, 'package.json', {
		name: 'project-context-report-fixture',
		private: true,
		workspaces: ['projects/*']
	});
	for (const name of ['left', 'right'] as const) {
		json(root, `projects/${name}/package.json`, {
			name: `@fixture/${name}`,
			private: true,
			type: 'module',
			version: '0.0.0'
		});
	}
	json(root, 'tsconfig.json', {
		files: [],
		include: [],
		references: [{ path: './projects/left' }, { path: './projects/right' }]
	});
	json(root, 'projects/left/tsconfig.json', {
		compilerOptions: {
			composite: true,
			module: 'NodeNext',
			moduleResolution: 'NodeNext',
			noEmit: true,
			noLib: true,
			strict: true,
			target: 'ES2022'
		},
		files: ['src/alpha.ts', 'src/middle.ts', 'src/zeta.ts']
	});
	json(root, 'projects/right/tsconfig.json', {
		compilerOptions: {
			composite: true,
			module: 'NodeNext',
			moduleResolution: 'NodeNext',
			noEmit: true,
			noLib: true,
			strict: true,
			target: 'ES2022'
		},
		files: ['src/index.ts']
	});
	write(
		root,
		'projects/left/src/alpha.ts',
		"import { middle } from './middle.js';\nexport const alpha = middle + 1;\n"
	);
	write(
		root,
		'projects/left/src/middle.ts',
		"import { zeta } from './zeta.js';\nexport const middle = zeta + 1;\n"
	);
	write(root, 'projects/left/src/zeta.ts', 'export const zeta = 1;\n');
	write(root, 'projects/right/src/index.ts', 'export const right = 1;\n');
	write(root, 'bun.lock', 'fixture lock\n');
	return root;
}

function request(
	overrides: Partial<ProjectContextReportRequest> = {}
): ProjectContextReportRequest {
	return {
		budgets: {
			maxResultBytes: 16 * 1024 * 1024,
			projectContext: {
				maxConfigurationClosureRecords: 1_000,
				maxDiagnostics: 1_000,
				maxInputRecords: 1_000_000,
				maxInputStringCharacters: 16 * 1024 * 1024,
				maxMemberships: 10_000,
				maxOutputRecords: 20_000,
				maxPrograms: 1_000,
				maxProjectReferences: 1_000,
				maxProjects: 1_000,
				maxSources: 10_000,
				maxTraversalSteps: 100_000
			},
			semantic: {
				maxAstDepth: 256,
				maxAstNodes: 100_000,
				maxCompilerInputMetadataBytes: 16 * 1024 * 1024,
				maxCompilerQueries: 100_000,
				maxCompilerFacts: 100_000,
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
			},
			subject: {
				maxBytes: 32 * 1024 * 1024,
				maxConfigDepth: 32,
				maxDiagnostics: 1_000,
				maxDurationMs: 30_000,
				maxFiles: 10_000,
				maxProjects: 10
			}
		},
		operationVersion: PROJECT_CONTEXT_REPORT_OPERATION_VERSION,
		schemaVersion: PROJECT_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: ['tsconfig.json'],
		...overrides
	};
}

afterEach(() => {
	for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe('runProjectContextReport', () => {
	it('returns exact project, reference, and membership evidence with ordered report progress', async () => {
		const root = fixture();
		const progress: ProjectContextReportProgressEvent[] = [];
		const first = runProjectContextReport(request(), {
			onProgress: (event) => progress.push(event),
			repositoryRoot: root
		});
		expect(first.outcome).toBe('partial');
		expect(projectContextReportExitCode(first)).toBe(3);
		if (first.outcome !== 'partial') throw new Error(JSON.stringify(first));

		expect(first.result.capability).toEqual({
			architectureDiscovery: 'NOT_CLAIMED',
			changeImpact: 'NOT_CLAIMED',
			codeSlice: 'NOT_CLAIMED',
			id: 'JAN-CSAA-CAP-010',
			semanticComparison: 'NOT_CLAIMED',
			semanticQuery: 'NOT_CLAIMED',
			status: 'PARTIAL'
		});
		expect(first.result.facadeNonclaims).toBe(PROJECT_CONTEXT_REPORT_NONCLAIMS);
		expect(PROJECT_CONTEXT_REPORT_NONCLAIMS).toEqual(
			expect.arrayContaining([
				'PROJECT_OR_PROGRAM_SEMANTIC_EQUIVALENCE',
				'GENERATED_SOURCE_LINEAGE_BEYOND_RETAINED_ORIGIN_FACTS'
			])
		);
		expect(first.result.currentness).toMatchObject({
			changedPaths: [],
			scope: 'SELECTED_CAPTURED_SUBJECT_ONLY',
			state: 'CURRENT_FOR_CAPTURED_SUBJECT'
		});
		const graph = first.result.evidence.projectContextGraph;
		expect(first.result.evidence.encoding).toBe(
			'ALL_VALIDATED_PROJECTS_PROGRAMS_SOURCES_MEMBERSHIPS_AND_PROJECT_REFERENCES'
		);
		expect(graph).toMatchObject({
			capability: 'JAN-CSAA-CAP-010',
			capabilityStatus: 'PARTIAL',
			closure: 'CLOSED_FOR_ALL_DECLARED_PROJECT_REFERENCES',
			currentness: 'NOT_CLAIMED',
			freshness: 'NOT_ASSESSED',
			graphAuthority: 'NONE',
			health: 'PARTIAL'
		});
		expect(graph.projects.map((project) => project.configPath).sort()).toEqual([
			'projects/left/tsconfig.json',
			'projects/right/tsconfig.json',
			'tsconfig.json'
		]);
		expect(
			graph.projectReferences
				.map((reference) => [reference.fromConfigPath, reference.declaredTargetConfigPath])
				.sort()
		).toEqual([
			['tsconfig.json', 'projects/left/tsconfig.json'],
			['tsconfig.json', 'projects/right/tsconfig.json']
		]);
		const projects = new Map(graph.projects.map((project) => [project.id, project]));
		const programs = new Map(graph.programs.map((program) => [program.id, program]));
		const sources = new Map(graph.sources.map((source) => [source.id, source]));
		expect(
			graph.memberships.every((membership) =>
				membership.kind === 'PROJECT_HAS_PROGRAM'
					? programs.get(membership.programId)?.projectId === membership.projectId
					: sources.get(membership.sourceId)?.programId === membership.programId
			)
		).toBe(true);
		expect(
			graph.projectReferences.every((reference) => projects.has(reference.targetProjectId))
		).toBe(true);
		expect(graph.memberships).toHaveLength(graph.programs.length + graph.sources.length);
		expect(first.result.semanticSnapshotSummary).toMatchObject({
			id: graph.semanticSnapshotId,
			programs: graph.programs.length,
			projects: graph.projects.length,
			sources: graph.sources.length
		});

		const firstJson = canonicalSemanticJson(first);
		expect(firstJson).not.toContain(root);
		expect(firstJson).not.toContain(root.replaceAll('\\', '/'));
		expect(progress.map((event) => event.sequence)).toEqual(progress.map((_, index) => index + 1));
		expect(
			progress.every(
				(event) =>
					event.nonclaims === PROJECT_CONTEXT_REPORT_PROGRESS_NONCLAIMS &&
					event.schemaVersion === PROJECT_CONTEXT_REPORT_PROGRESS_SCHEMA_VERSION &&
					event.reportIdentityEffect === 'EXCLUDED_FROM_REPORT_IDENTITY'
			)
		).toBe(true);
		const reportStages = progress.filter((event) => event.kind === 'REPORT_STAGE');
		expect(reportStages.map(({ phase, stage, state }) => ({ phase, stage, state }))).toEqual(
			(
				[
					['REQUEST_BIND', 'REQUEST'],
					['SUBJECT_PROJECT_PATH_BIND', 'SUBJECT'],
					['SUBJECT_CAPTURE', 'SUBJECT'],
					['SEMANTIC_SNAPSHOT', 'SEMANTIC_SNAPSHOT'],
					['PROJECT_CONTEXT', 'PROJECT_CONTEXT'],
					['CURRENTNESS', 'CURRENTNESS'],
					['RESULT', 'RESULT']
				] as const
			).flatMap(([phase, stage]) => [
				{ phase, stage, state: 'STARTED' },
				{ phase, stage, state: 'COMPLETED' }
			])
		);
		const projectCompletion = reportStages.find(
			(event) => event.phase === 'PROJECT_CONTEXT' && event.state === 'COMPLETED'
		);
		expect(
			projectCompletion?.observations.find(
				(observation) => observation.metric === 'PROJECT_CONTEXT_PROJECT_REFERENCES'
			)
		).toMatchObject({ basis: 'EXACT', value: 2 });
		expect(progress.at(-1)).toMatchObject({
			detailCode: 'PARTIAL',
			kind: 'REPORT_STAGE',
			phase: 'RESULT',
			state: 'COMPLETED'
		});
		expect(
			progress.at(-1)?.observations.find((observation) => observation.metric === 'RESULT_BYTES')
		).toMatchObject({
			basis: 'EXACT',
			limit: request().budgets.maxResultBytes,
			unit: 'BYTES',
			value: Buffer.byteLength(firstJson, 'utf8') + 1
		});
		const progressLength = progress.length;
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(progress).toHaveLength(progressLength);

		const observed = runProjectContextReport(request(), {
			onProgress: () => {
				throw new Error('Observer failure must remain out of band.');
			},
			repositoryRoot: root
		});
		expect(canonicalSemanticJson(observed)).toBe(firstJson);
	}, 90_000);

	it('preserves captured graph evidence while reporting a post-analysis subject mutation as stale', () => {
		const root = fixture();
		let mutated = false;
		const outcome = runProjectContextReport(request(), {
			onProgress: (event) => {
				if (
					!mutated &&
					event.kind === 'REPORT_STAGE' &&
					event.phase === 'PROJECT_CONTEXT' &&
					event.state === 'COMPLETED'
				) {
					mutated = true;
					write(root, 'projects/left/src/zeta.ts', 'export const zeta = 2;\n');
				}
			},
			repositoryRoot: root
		});
		expect(mutated).toBe(true);
		expect(outcome.outcome).toBe('partial');
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		expect(outcome.result.currentness).toMatchObject({
			changedPaths: ['projects/left/src/zeta.ts'],
			scope: 'SELECTED_CAPTURED_SUBJECT_ONLY',
			state: 'STALE'
		});
		expect(outcome.result.evidence.projectContextGraph.currentness).toBe('NOT_CLAIMED');
		expect(outcome.stageOutcomes.currentness.state).toBe('STALE');
	}, 90_000);

	it('fails closed on hostile shapes, traversal, excessive ceilings, and absent projects', () => {
		const root = fixture();
		const extra = { ...request(), unexpected: true };
		const traversing = request({ subjectProjectConfigPaths: ['../escape.json'] });
		const excessive = request({
			budgets: { ...request().budgets, maxResultBytes: 64 * 1024 * 1024 + 1 }
		});
		const missing = request({ subjectProjectConfigPaths: ['missing.json'] });
		const proxy = new Proxy(request(), {});
		const duplicate = request({ subjectProjectConfigPaths: ['tsconfig.json', 'tsconfig.json'] });
		const accessorProjects = ['tsconfig.json'];
		Object.defineProperty(accessorProjects, '0', {
			configurable: true,
			enumerable: true,
			get: () => {
				throw new Error('The request boundary must not invoke array accessors.');
			}
		});
		const accessorArray = request({ subjectProjectConfigPaths: accessorProjects });

		for (const [candidate, code, exitCode] of [
			[extra, 'REQUEST_SHAPE_INVALID', 2],
			[traversing, 'REQUEST_PATH_INVALID', 2],
			[excessive, 'REQUEST_BUDGET_EXCEEDS_SAFETY_CEILING', 3],
			[missing, 'PROJECT_PATH_INVALID', 2],
			[proxy, 'REQUEST_SHAPE_INVALID', 2],
			[duplicate, 'REQUEST_PROJECTS_INVALID', 2],
			[accessorArray, 'REQUEST_PROJECTS_INVALID', 2]
		] as const) {
			const outcome = runProjectContextReport(candidate, { repositoryRoot: root });
			expect(outcome, code).toMatchObject({ code, outcome: 'unavailable' });
			expect(projectContextReportExitCode(outcome), code).toBe(exitCode);
		}
	});

	it('refuses every constraining project-context population/input budget without partial evidence', () => {
		const root = fixture();
		const limits = {
			maxConfigurationClosureRecords: 1,
			maxInputRecords: 1,
			maxInputStringCharacters: 1,
			maxMemberships: 1,
			maxOutputRecords: 1,
			maxPrograms: 1,
			maxProjectReferences: 0,
			maxProjects: 1,
			maxSources: 0,
			maxTraversalSteps: 1
		} as const;
		for (const [budgetKey, limit] of Object.entries(limits)) {
			const baseline = request();
			const progress: ProjectContextReportProgressEvent[] = [];
			const outcome = runProjectContextReport(
				request({
					budgets: {
						...baseline.budgets,
						projectContext: {
							...baseline.budgets.projectContext,
							[budgetKey]: limit
						}
					}
				}),
				{ onProgress: (event) => progress.push(event), repositoryRoot: root }
			);
			expect(outcome, budgetKey).toMatchObject({
				code: 'PROJECT_CONTEXT_UNAVAILABLE',
				outcome: 'unavailable',
				stage: 'PROJECT_CONTEXT',
				state: 'resource-refused'
			});
			expect(canonicalSemanticJson(outcome), budgetKey).not.toContain('"projectContextGraph"');
			expect(progress.at(-1), budgetKey).toMatchObject({
				detailCode: 'BUDGET_EXCEEDED',
				phase: 'PROJECT_CONTEXT',
				state: 'FAILED'
			});
		}

		const baseline = request();
		const invalidDiagnostics = runProjectContextReport(
			request({
				budgets: {
					...baseline.budgets,
					projectContext: { ...baseline.budgets.projectContext, maxDiagnostics: 0 }
				}
			}),
			{ repositoryRoot: root }
		);
		expect(invalidDiagnostics).toMatchObject({
			code: 'REQUEST_BUDGET_INVALID',
			stage: 'REQUEST',
			state: 'incompatible'
		});
	}, 180_000);

	it('refuses semantic and terminal-result exhaustion', () => {
		const root = fixture();
		const baseline = request();
		const semanticRefusal = runProjectContextReport(
			request({
				budgets: {
					...baseline.budgets,
					semantic: { ...baseline.budgets.semantic, maxAstNodes: 1 }
				}
			}),
			{ repositoryRoot: root }
		);
		expect(semanticRefusal).toMatchObject({
			code: 'SEMANTIC_SNAPSHOT_UNAVAILABLE',
			stage: 'SEMANTIC_SNAPSHOT',
			state: 'resource-refused'
		});

		const resultRefusal = runProjectContextReport(
			request({ budgets: { ...baseline.budgets, maxResultBytes: 1 } }),
			{ repositoryRoot: root }
		);
		expect(resultRefusal).toMatchObject({
			code: 'RESULT_BUDGET_EXCEEDED',
			stage: 'RESULT',
			state: 'resource-refused'
		});
		expect(projectContextReportExitCode(resultRefusal)).toBe(3);
	}, 90_000);

	it('contains rejected observer results without replacing the terminal outcome', async () => {
		const root = fixture();
		const baseline = runProjectContextReport({}, { repositoryRoot: root });
		const observed = runProjectContextReport(
			{},
			{
				onProgress: () => Promise.reject(new Error('observer rejection')),
				repositoryRoot: root
			}
		);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(canonicalSemanticJson(observed)).toBe(canonicalSemanticJson(baseline));
	});

	it('adds successor-owned artifacts only to the internal same-subject capture seam', () => {
		const root = fixture();
		write(root, 'verif/retained-evidence.ts', 'export const retained = true;\n');
		const captured = captureProjectContextReportPipeline(request(), {
			additionalArtifacts: ['verif/retained-evidence.ts'],
			repositoryRoot: root
		});
		expect(captured.outcome).toBe('captured');
		if (captured.outcome !== 'captured') return;
		expect(captured.frozenSubject.artifacts.map((artifact) => artifact.path)).toContain(
			'verif/retained-evidence.ts'
		);

		const publicOutcome = runProjectContextReport(request(), { repositoryRoot: root });
		expect(publicOutcome.outcome).toBe('partial');
		if (publicOutcome.outcome !== 'partial') return;
		expect(publicOutcome.subject.subjectId).not.toBe(captured.frozenSubject.descriptor.subjectId);
		expect(publicOutcome.request).toEqual(request());
	});

	it('snapshots an exact internal graph-budget override without widening public CAP-010 admission', () => {
		const root = fixture();
		const baseline = request();
		const override = {
			...baseline.budgets.projectContext,
			maxInputRecords: PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS.projectContext.maxInputRecords + 1
		};
		const captured = captureProjectContextReportPipeline(baseline, {
			projectContextBudgets: override,
			repositoryRoot: root
		});
		expect(captured.outcome).toBe('captured');
		if (captured.outcome !== 'captured') return;
		const capturedMaxInputRecords = captured.request.budgets.projectContext.maxInputRecords;
		override.maxInputRecords = 1;
		expect(capturedMaxInputRecords).toBe(
			PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS.projectContext.maxInputRecords + 1
		);
		expect(captured.request.budgets.projectContext.maxInputRecords).toBe(capturedMaxInputRecords);
		expect(Object.isFrozen(captured.request.budgets.projectContext)).toBe(true);

		const publicOutcome = runProjectContextReport(
			request({
				budgets: {
					...baseline.budgets,
					projectContext: {
						...baseline.budgets.projectContext,
						maxInputRecords: capturedMaxInputRecords
					}
				}
			}),
			{ repositoryRoot: root }
		);
		expect(publicOutcome).toMatchObject({
			code: 'REQUEST_BUDGET_EXCEEDS_SAFETY_CEILING',
			outcome: 'unavailable',
			state: 'resource-refused'
		});

		let accessorTouched = false;
		const accessorOverride = { ...baseline.budgets.projectContext };
		Object.defineProperty(accessorOverride, 'maxInputRecords', {
			enumerable: true,
			get: () => {
				accessorTouched = true;
				return capturedMaxInputRecords;
			}
		});
		expect(() =>
			captureProjectContextReportPipeline(baseline, {
				projectContextBudgets: accessorOverride,
				repositoryRoot: root
			})
		).toThrow('must be an enumerable data property');
		expect(accessorTouched).toBe(false);
	});

	it('hands off one subject and semantic snapshot without constructing CAP-010 projection evidence', () => {
		const root = fixture();
		write(root, 'verif/retained-evidence.ts', 'export const retained = true;\n');
		const captured = captureSemanticReportPipeline(request(), {
			additionalArtifacts: ['verif/retained-evidence.ts'],
			repositoryRoot: root
		});
		expect(captured.outcome).toBe('semantic-captured');
		if (captured.outcome !== 'semantic-captured') return;
		expect(captured.frozenSubject.artifacts.map((artifact) => artifact.path)).toContain(
			'verif/retained-evidence.ts'
		);
		expect(captured.semanticSnapshot.subjectId).toBe(captured.frozenSubject.descriptor.subjectId);
		expect(captured).not.toHaveProperty('projectContextGraph');
	});
});
