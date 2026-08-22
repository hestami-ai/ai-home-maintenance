import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { ModuleDependencyGraphBuildDiagnostic } from '../contracts/graph.js';
import {
	MODULE_DEPENDENCY_REPORT_AUTHORITY,
	MODULE_DEPENDENCY_REPORT_AUTHORITY_TRANSFER,
	MODULE_DEPENDENCY_REPORT_GATE_EFFECT,
	MODULE_DEPENDENCY_REPORT_NONCLAIMS,
	MODULE_DEPENDENCY_REPORT_OPERATION_VERSION,
	MODULE_DEPENDENCY_REPORT_REQUEST_SCHEMA_VERSION,
	MODULE_DEPENDENCY_REPORT_SAFETY_CEILINGS,
	type ModuleDependencyReportRequest
} from '../contracts/module-dependency-report.js';
import { validateModuleDependencyGraph } from '../graph/validate-graph.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import { captureProjectContextReportPipeline } from './run-project-context-report.js';
import {
	MODULE_DEPENDENCY_REPORT_PROGRESS_NONCLAIMS,
	classifyModuleDependencyGraphFailureState,
	moduleDependencyReportExitCode,
	projectedModuleDependencyPopulation,
	runModuleDependencyReport,
	type ModuleDependencyReportProgressEvent
} from './run-module-dependency-report.js';

const temporaryRoots: string[] = [];

function write(root: string, path: string, contents: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, contents, 'utf8');
}

function json(root: string, path: string, value: unknown): void {
	write(root, path, `${JSON.stringify(value, null, 2)}\n`);
}

function fixture(source?: string): string {
	const root = mkdtempSync(join(tmpdir(), 'csaa-module-dependency-report-'));
	temporaryRoots.push(root);
	json(root, 'package.json', {
		name: 'module-dependency-report-fixture',
		private: true,
		type: 'module',
		workspaces: ['projects/*']
	});
	json(root, 'projects/app/package.json', {
		name: '@fixture/module-dependency-report',
		private: true,
		type: 'module',
		version: '0.0.0'
	});
	json(root, 'tsconfig.json', {
		files: [],
		include: [],
		references: [{ path: './projects/app' }]
	});
	json(root, 'projects/app/tsconfig.json', {
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
	write(
		root,
		'projects/app/src/alpha.ts',
		source ??
			[
				"import { middle } from './middle.js';",
				"export { middle as middleAgain } from './middle.js';",
				"import './missing.js';",
				'export const alpha = middle;',
				''
			].join('\n')
	);
	write(
		root,
		'projects/app/src/middle.ts',
		"import { zeta } from './zeta.js';\nexport const middle = zeta;\n"
	);
	write(root, 'projects/app/src/zeta.ts', 'export const zeta = 1;\n');
	write(root, 'bun.lock', 'fixture lock\n');
	return root;
}

function request(
	overrides: Partial<ModuleDependencyReportRequest> = {}
): ModuleDependencyReportRequest {
	return {
		budgets: MODULE_DEPENDENCY_REPORT_SAFETY_CEILINGS,
		operationVersion: MODULE_DEPENDENCY_REPORT_OPERATION_VERSION,
		schemaVersion: MODULE_DEPENDENCY_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: ['projects/app/tsconfig.json'],
		...overrides
	};
}

function withGraphBudgets(
	base: ModuleDependencyReportRequest,
	values: Partial<ModuleDependencyReportRequest['budgets']['moduleDependency']>
): ModuleDependencyReportRequest {
	return {
		...base,
		budgets: {
			...base.budgets,
			moduleDependency: { ...base.budgets.moduleDependency, ...values }
		}
	};
}

afterEach(() => {
	for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe('runModuleDependencyReport', () => {
	it('classifies graph request/precondition and internal failures distinctly', () => {
		const diagnostic = (
			code: ModuleDependencyGraphBuildDiagnostic['code']
		): ModuleDependencyGraphBuildDiagnostic => ({
			code,
			message: code,
			path: null,
			phase: 'REQUEST'
		});
		for (const code of ['REQUEST_INVALID', 'SEMANTIC_CAPABILITY_UNAVAILABLE'] as const)
			expect(classifyModuleDependencyGraphFailureState([diagnostic(code)]), code).toBe(
				'incompatible'
			);
		for (const code of [
			'DANGLING_SEMANTIC_REFERENCE',
			'GRAPH_VALIDATION_FAILED',
			'SEMANTIC_SNAPSHOT_ID_MISMATCH',
			'SUBJECT_ID_MISMATCH'
		] as const)
			expect(classifyModuleDependencyGraphFailureState([diagnostic(code)]), code).toBe('failed');
	});

	it(
		'returns one deterministic full graph with every occurrence edge and exact context identities',
		{ timeout: 120_000 },
		() => {
			const root = fixture();
			const progress: ModuleDependencyReportProgressEvent[] = [];
			const first = runModuleDependencyReport(request(), {
				onProgress: (event) => progress.push(event),
				repositoryRoot: root
			});
			expect(first.outcome).toBe('partial');
			expect(moduleDependencyReportExitCode(first)).toBe(3);
			if (first.outcome !== 'partial') throw new Error(JSON.stringify(first));

			expect(first).toMatchObject({
				analysisAuthority: MODULE_DEPENDENCY_REPORT_AUTHORITY,
				authorityTransfer: MODULE_DEPENDENCY_REPORT_AUTHORITY_TRANSFER,
				gateEffect: MODULE_DEPENDENCY_REPORT_GATE_EFFECT,
				state: 'partial'
			});
			expect(first.result.capability).toEqual({
				architectureDiscovery: 'NOT_CLAIMED',
				changeImpact: 'NOT_CLAIMED',
				codeSlice: 'NOT_CLAIMED',
				fullJanCsaaCapability004DependencyAnalysis: 'NOT_CLAIMED',
				id: 'JAN-CSAA-CAP-004',
				semanticComparison: 'NOT_CLAIMED',
				semanticQuery: 'NOT_CLAIMED',
				status: 'PARTIAL'
			});
			expect(first.result.facadeNonclaims).toBe(MODULE_DEPENDENCY_REPORT_NONCLAIMS);
			expect(MODULE_DEPENDENCY_REPORT_NONCLAIMS).toEqual(
				expect.arrayContaining([
					'DEPENDENCY_CRUISER_EXECUTION_OR_CORROBORATION',
					'WHOLE_REPOSITORY_OR_WHOLE_PROGRAM_DEPENDENCY_CLOSURE',
					'ZERO_EDGE_OR_ZERO_INCOMING_EDGE_AS_UNUSED_DEAD_ORPHAN_IRRELEVANT_NON_IMPACT_OR_SAFE_REMOVAL'
				])
			);
			expect(first.result.currentness).toMatchObject({
				changedPaths: [],
				scope: 'SELECTED_CAPTURED_SUBJECT_ONLY',
				state: 'CURRENT_FOR_CAPTURED_SUBJECT'
			});
			const graph = first.result.evidence.moduleDependencyGraph;
			const context = first.result.evidence.projectContextGraph;
			expect(graph).toMatchObject({
				coverage: { closure: 'OPEN', reconciles: true },
				health: 'PARTIAL',
				semanticSnapshotId: context.semanticSnapshotId,
				subjectId: context.subjectId
			});
			expect(graph.edges.length).toBe(first.result.semanticSnapshotSummary.moduleResolutions);
			expect(graph.edges.length).toBeGreaterThanOrEqual(4);
			expect(graph.edges.filter((edge) => edge.specifier === './middle.js')).toHaveLength(2);
			expect(graph.forwardIndex).toHaveLength(graph.nodes.length);
			expect(graph.reverseIndex).toHaveLength(graph.nodes.length);
			expect(graph.forwardIndex.flatMap((entry) => entry.edgeIds)).toHaveLength(graph.edges.length);
			expect(graph.reverseIndex.flatMap((entry) => entry.edgeIds)).toHaveLength(graph.edges.length);
			expect(graph.layers[0].nodeIds).toHaveLength(graph.nodes.length);
			expect(graph.layers[0].edgeIds).toHaveLength(graph.edges.length);
			expect(graph.limitations).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ kind: 'DEPCRUISE_NOT_RUN' }),
					expect.objectContaining({ kind: 'UNRESOLVED_MODULE' })
				])
			);

			const contextSources = new Map(
				context.sources.map((source) => [source.semanticSourceId, source])
			);
			for (const node of graph.nodes.filter((node) => node.kind === 'SOURCE')) {
				const source = contextSources.get(node.semanticSourceId);
				expect(source).toMatchObject({
					analysisDisposition: node.analysisDisposition,
					logicalPath: node.logicalPath,
					semanticProgramId: node.programId,
					semanticProjectId: node.projectId
				});
			}

			const captured = captureProjectContextReportPipeline(
				{
					budgets: {
						maxResultBytes: request().budgets.maxResultBytes,
						projectContext: request().budgets.projectContext,
						semantic: request().budgets.semantic,
						subject: request().budgets.subject
					},
					operationVersion: 'jan-csaa-report-project-context/0.1.0',
					schemaVersion: 'jan-csaa-project-context-report-request/0.1.0',
					subjectProjectConfigPaths: ['projects/app/tsconfig.json']
				},
				{ repositoryRoot: root }
			);
			if (captured.outcome !== 'captured') throw new Error(JSON.stringify(captured));
			expect(validateModuleDependencyGraph(graph, captured.semanticSnapshot)).toEqual({
				issues: [],
				state: 'VALID'
			});
			expect(projectedModuleDependencyPopulation(captured.semanticSnapshot)).toEqual({
				edges: graph.edges.length,
				limitations: graph.limitations.length,
				nodes: graph.nodes.length
			});

			const second = runModuleDependencyReport(request(), { repositoryRoot: root });
			expect(canonicalSemanticJson(second)).toBe(canonicalSemanticJson(first));
			expect(progress).toHaveLength(10);
			expect(progress.map((event) => event.sequence)).toEqual(
				progress.map((_, index) => index + 1)
			);
			expect(
				progress.filter((event) => event.state === 'STARTED').map((event) => event.phase)
			).toEqual([
				'REQUEST_BIND',
				'PREDECESSOR_PIPELINE',
				'MODULE_DEPENDENCY',
				'CURRENTNESS',
				'RESULT'
			]);
			expect(progress.at(-1)).toMatchObject({ phase: 'RESULT', state: 'COMPLETED' });
			expect(
				progress.every((event) => event.nonclaims === MODULE_DEPENDENCY_REPORT_PROGRESS_NONCLAIMS)
			).toBe(true);
		}
	);

	it(
		'accepts exact graph populations and atomically refuses each one-record-short budget',
		{ timeout: 120_000 },
		() => {
			const root = fixture();
			const baseline = runModuleDependencyReport(request(), { repositoryRoot: root });
			if (baseline.outcome !== 'partial') throw new Error(JSON.stringify(baseline));
			const graph = baseline.result.evidence.moduleDependencyGraph;
			const exact = {
				maxEdges: graph.edges.length,
				maxLimitations: graph.limitations.length,
				maxNodes: graph.nodes.length
			};
			expect(
				runModuleDependencyReport(withGraphBudgets(request(), exact), { repositoryRoot: root })
			).toMatchObject({
				outcome: 'partial'
			});
			for (const key of ['maxEdges', 'maxLimitations', 'maxNodes'] as const) {
				const refused = runModuleDependencyReport(
					withGraphBudgets(request(), { ...exact, [key]: exact[key] - 1 }),
					{ repositoryRoot: root }
				);
				expect(refused, key).toMatchObject({
					code: 'MODULE_DEPENDENCY_GRAPH_BUDGET_EXCEEDED',
					stage: 'MODULE_DEPENDENCY',
					state: 'resource-refused'
				});
				expect(moduleDependencyReportExitCode(refused)).toBe(3);
			}
		}
	);

	it(
		'admits the exact terminal-byte boundary including LF and refuses one byte below it',
		{ timeout: 120_000 },
		() => {
			const root = fixture();
			let limit = request().budgets.maxResultBytes;
			let exactBytes = 0;
			for (let attempt = 0; attempt < 4; attempt += 1) {
				const candidate = request({
					budgets: { ...request().budgets, maxResultBytes: limit }
				});
				const outcome = runModuleDependencyReport(candidate, { repositoryRoot: root });
				expect(outcome.outcome).toBe('partial');
				exactBytes = Buffer.byteLength(canonicalSemanticJson(outcome), 'utf8') + 1;
				if (exactBytes === limit) break;
				limit = exactBytes;
			}
			expect(exactBytes).toBe(limit);
			const refused = runModuleDependencyReport(
				request({ budgets: { ...request().budgets, maxResultBytes: limit - 1 } }),
				{ repositoryRoot: root }
			);
			expect(refused).toMatchObject({
				code: 'RESULT_BUDGET_EXCEEDED',
				outcome: 'unavailable',
				stage: 'RESULT',
				state: 'resource-refused'
			});
		}
	);

	it(
		'contains throwing and rejecting progress observers without changing terminal evidence',
		{ timeout: 120_000 },
		async () => {
			const root = fixture();
			const baseline = canonicalSemanticJson(
				runModuleDependencyReport(request(), { repositoryRoot: root })
			);
			const throwing = runModuleDependencyReport(request(), {
				onProgress: () => {
					throw new Error('Observer failure must remain out of band.');
				},
				repositoryRoot: root
			});
			const rejecting = runModuleDependencyReport(request(), {
				onProgress: () => Promise.reject(new Error('Rejected observer must remain out of band.')),
				repositoryRoot: root
			});
			expect(canonicalSemanticJson(throwing)).toBe(baseline);
			expect(canonicalSemanticJson(rejecting)).toBe(baseline);
			await new Promise<void>((resolve) => setImmediate(resolve));
		}
	);

	it('keeps a zero-edge closed graph preliminary and does not promote absence claims', () => {
		const root = fixture('export const alpha = 1;\n');
		write(root, 'projects/app/src/middle.ts', 'export const middle = 1;\n');
		const outcome = runModuleDependencyReport(request(), { repositoryRoot: root });
		expect(outcome.outcome).toBe('partial');
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		expect(outcome.result.coverage).toMatchObject({
			closure: 'CLOSED',
			edges: 0,
			health: 'COMPLETE',
			limitations: 1,
			reconciles: true
		});
		expect(outcome.stageOutcomes.moduleDependency.outcome).toBe('complete');
		expect(outcome.state).toBe('partial');
		expect(outcome.result.facadeNonclaims).toContain(
			'EMBEDDED_CLOSED_GRAPH_AS_FULL_CAPABILITY_OR_WHOLE_PROGRAM_CLOSURE'
		);
	});

	it('retains capture-bound graph evidence while reporting a final subject mutation as stale', () => {
		const root = fixture();
		let mutated = false;
		const outcome = runModuleDependencyReport(request(), {
			onProgress: (event) => {
				if (!mutated && event.phase === 'CURRENTNESS' && event.state === 'STARTED') {
					mutated = true;
					write(root, 'projects/app/src/zeta.ts', 'export const zeta = 2;\n');
				}
			},
			repositoryRoot: root
		});
		expect(mutated).toBe(true);
		expect(outcome.outcome).toBe('partial');
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		expect(outcome.result.currentness).toEqual({
			changedPaths: ['projects/app/src/zeta.ts'],
			diagnosticCodes: ['SUBJECT_CHANGED_DURING_RESOLUTION'],
			scope: 'SELECTED_CAPTURED_SUBJECT_ONLY',
			state: 'STALE'
		});
		expect(outcome.result.evidence.moduleDependencyGraph.edges.length).toBeGreaterThan(0);
	});

	it('retains capture-bound graph evidence when final subject currentness is unavailable', () => {
		const root = fixture();
		let removed = false;
		const outcome = runModuleDependencyReport(request(), {
			onProgress: (event) => {
				if (!removed && event.phase === 'CURRENTNESS' && event.state === 'STARTED') {
					removed = true;
					rmSync(join(root, 'projects/app/tsconfig.json'));
				}
			},
			repositoryRoot: root
		});
		expect(removed).toBe(true);
		expect(outcome.outcome).toBe('partial');
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		expect(outcome.result.currentness).toMatchObject({
			changedPaths: [],
			scope: 'SELECTED_CAPTURED_SUBJECT_ONLY',
			state: 'UNAVAILABLE'
		});
		expect(outcome.result.currentness.diagnosticCodes.length).toBeGreaterThan(0);
		expect(outcome.result.evidence.moduleDependencyGraph.edges.length).toBeGreaterThan(0);
	});

	it('rejects hostile wire values without invoking accessors and enforces absolute ceilings', () => {
		const root = fixture();
		expect(
			runModuleDependencyReport(new Proxy(request(), {}), { repositoryRoot: root })
		).toMatchObject({
			code: 'REQUEST_SHAPE_INVALID',
			stage: 'REQUEST',
			state: 'incompatible'
		});

		let getterReads = 0;
		const hostile = { ...request() } as Record<string, unknown>;
		Object.defineProperty(hostile, 'budgets', {
			enumerable: true,
			get() {
				getterReads += 1;
				return request().budgets;
			}
		});
		expect(runModuleDependencyReport(hostile, { repositoryRoot: root })).toMatchObject({
			code: 'REQUEST_SHAPE_INVALID',
			stage: 'REQUEST',
			state: 'incompatible'
		});
		expect(getterReads).toBe(0);

		for (const key of ['maxEdges', 'maxLimitations', 'maxNodes'] as const) {
			const refused = runModuleDependencyReport(
				withGraphBudgets(request(), {
					[key]: MODULE_DEPENDENCY_REPORT_SAFETY_CEILINGS.moduleDependency[key] + 1
				}),
				{ repositoryRoot: root }
			);
			expect(refused, key).toMatchObject({
				analysisAuthority: 'NONE',
				authorityTransfer: 'NONE',
				code: 'REQUEST_BUDGET_EXCEEDS_SAFETY_CEILING',
				gateEffect: 'NONE',
				stage: 'REQUEST',
				state: 'resource-refused'
			});
		}

		const missingRoot = runModuleDependencyReport(request(), {
			repositoryRoot: join(root, 'absent')
		});
		expect(missingRoot).toMatchObject({
			outcome: 'unavailable',
			stage: 'PREDECESSOR_PIPELINE',
			state: 'failed'
		});
		expect(moduleDependencyReportExitCode(missingRoot)).toBe(4);
	});
});
