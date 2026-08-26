import { Buffer } from 'node:buffer';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	STRUCTURAL_SCC_REPORT_NONCLAIMS,
	STRUCTURAL_SCC_REPORT_OPERATION_VERSION,
	STRUCTURAL_SCC_REPORT_REQUEST_SCHEMA_VERSION,
	type StructuralSccReportRequest
} from '../contracts/structural-scc-report.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import {
	runStructuralSccReport,
	STRUCTURAL_SCC_REPORT_PROGRESS_NONCLAIMS,
	STRUCTURAL_SCC_REPORT_PROGRESS_SCHEMA_VERSION,
	structuralSccReportExitCode,
	type StructuralSccReportProgressEvent
} from './run-structural-scc-report.js';

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
	const root = mkdtempSync(join(tmpdir(), 'csaa-scc-report-'));
	temporaryRoots.push(root);
	json(root, 'package.json', {
		name: 'scc-report-fixture',
		private: true,
		workspaces: ['packages/*']
	});
	json(root, 'packages/demo/package.json', {
		name: '@fixture/scc-report',
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
		files: ['src/a.ts', 'src/b.ts', 'src/leaf.ts', 'src/open.ts', 'src/self.ts']
	});
	write(root, 'packages/demo/src/a.ts', "import { b } from './b.js';\nexport const a = b + 1;\n");
	write(root, 'packages/demo/src/b.ts', "import { a } from './a.js';\nexport const b = a + 1;\n");
	write(root, 'packages/demo/src/leaf.ts', 'export const leaf = 1;\n');
	write(
		root,
		'packages/demo/src/open.ts',
		"import { absent } from './absent.js';\nexport const open = absent;\n"
	);
	write(
		root,
		'packages/demo/src/self.ts',
		"import { self } from './self.js';\nexport const self = 1;\n"
	);
	write(root, 'bun.lock', 'fixture lock\n');
	return root;
}

function request(overrides: Partial<StructuralSccReportRequest> = {}): StructuralSccReportRequest {
	return {
		budgets: {
			maxResultBytes: 16 * 1024 * 1024,
			scc: {
				maxComponents: 10_000,
				maxDiagnostics: 1_000,
				maxEdges: 10_000,
				maxInputRecords: 1_000_000,
				maxInputStringCharacters: 10_000_000,
				maxNodes: 10_000,
				maxTraversalSteps: 20_000
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
		operationVersion: STRUCTURAL_SCC_REPORT_OPERATION_VERSION,
		schemaVersion: STRUCTURAL_SCC_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: ['packages/demo/tsconfig.json'],
		...overrides
	};
}

afterEach(() => {
	for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe('runStructuralSccReport', () => {
	it('returns the full selected-graph SCC partition with bounded evidence and telemetry', () => {
		const root = fixture();
		const progress: StructuralSccReportProgressEvent[] = [];
		const first = runStructuralSccReport(request(), {
			onProgress: (event) => progress.push(event),
			repositoryRoot: root
		});
		expect(first.outcome).toBe('partial');
		expect(structuralSccReportExitCode(first)).toBe(3);
		if (first.outcome !== 'partial') throw new Error(JSON.stringify(first));

		expect(first.result.capability).toEqual({
			architectureDiscovery: 'NOT_CLAIMED',
			changeImpact: 'NOT_CLAIMED',
			codeSlice: 'NOT_CLAIMED',
			id: 'JAN-CSAA-CAP-027',
			semanticQuery: 'NOT_CLAIMED',
			status: 'PARTIAL'
		});
		expect(first.result.facadeNonclaims).toBe(STRUCTURAL_SCC_REPORT_NONCLAIMS);
		expect(first.result.interpretation).toBe(
			'SELECTED_VALIDATED_MODULE_DEPENDENCY_GRAPH_STRONGLY_CONNECTED_COMPONENTS'
		);
		expect(first.result.currentness).toMatchObject({
			changedPaths: [],
			scope: 'SELECTED_CAPTURED_SUBJECT_ONLY',
			state: 'CURRENT_FOR_CAPTURED_SUBJECT'
		});
		expect(first.result.analysis).toMatchObject({
			capability: 'JAN-CSAA-CAP-027',
			capabilityStatus: 'PARTIAL',
			graphAuthority: 'NONE',
			health: 'PARTIAL',
			structuralClosure: 'EXACT_FOR_SELECTED_VALIDATED_GRAPH'
		});
		expect(first.result.analysis.coverage).toMatchObject({
			edgeAccountingReconciles: true,
			partitionReconciles: true
		});
		expect(first.result.analysis.upstreamClosure).toBe('OPEN');
		expect(first.result.analysis.coverage.cyclicComponents).toBe(2);

		const pathByNode = new Map(
			first.result.evidence.nodes.flatMap((node) =>
				node.kind === 'SOURCE' ? [[node.id, node.logicalPath] as const] : []
			)
		);
		const componentPaths = first.result.analysis.components.map((component) => ({
			cycleKind: component.cycleKind,
			paths: component.nodeIds
				.flatMap((nodeId) => {
					const path = pathByNode.get(nodeId);
					return path === undefined ? [] : [path];
				})
				.sort()
		}));
		expect(componentPaths).toContainEqual({
			cycleKind: 'MULTI_NODE',
			paths: ['packages/demo/src/a.ts', 'packages/demo/src/b.ts']
		});
		expect(componentPaths).toContainEqual({
			cycleKind: 'SELF_LOOP_SINGLETON',
			paths: ['packages/demo/src/self.ts']
		});
		expect(componentPaths).toContainEqual({
			cycleKind: 'ACYCLIC_SINGLETON',
			paths: ['packages/demo/src/leaf.ts']
		});

		const componentNodeIds = first.result.analysis.components
			.flatMap((component) => component.nodeIds)
			.sort();
		expect(componentNodeIds).toEqual(first.result.evidence.nodes.map((node) => node.id).sort());
		const internalEdgeIds = first.result.analysis.components
			.flatMap((component) => component.internalEdgeIds)
			.sort();
		expect(internalEdgeIds).toEqual(
			first.result.evidence.internalEdges.map((edge) => edge.id).sort()
		);
		expect(first.result.evidence.internalEdges).toHaveLength(
			first.result.analysis.coverage.internalEdges
		);
		expect(first.result.evidence.componentEvidenceEncoding).toBe(
			'ALL_SELECTED_VALIDATED_GRAPH_COMPONENT_MEMBERS_WITH_INTERNAL_EDGE_EVIDENCE'
		);
		const componentByNode = new Map(
			first.result.analysis.componentIndex.map(
				(entry) => [entry.nodeId, entry.componentId] as const
			)
		);
		expect(
			first.result.evidence.internalEdges.every(
				(edge) =>
					componentByNode.get(edge.source.nodeId) === componentByNode.get(edge.target.nodeId)
			)
		).toBe(true);

		const firstJson = canonicalSemanticJson(first);
		expect(firstJson).not.toContain(root);
		expect(firstJson).not.toContain(root.replaceAll('\\', '/'));
		expect(progress.map((event) => event.sequence)).toEqual(progress.map((_, index) => index + 1));
		expect(
			progress.every(
				(event) =>
					event.nonclaims === STRUCTURAL_SCC_REPORT_PROGRESS_NONCLAIMS &&
					event.schemaVersion === STRUCTURAL_SCC_REPORT_PROGRESS_SCHEMA_VERSION &&
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
					['MODULE_GRAPH', 'MODULE_GRAPH'],
					['ANALYSIS', 'ANALYSIS'],
					['CURRENTNESS', 'CURRENTNESS'],
					['RESULT', 'RESULT']
				] as const
			).flatMap(([phase, stage]) => [
				{ phase, stage, state: 'STARTED' },
				{ phase, stage, state: 'COMPLETED' }
			])
		);
		const analysisCompletion = reportStages.find(
			(event) => event.phase === 'ANALYSIS' && event.state === 'COMPLETED'
		);
		expect(
			analysisCompletion?.observations.find(
				(observation) => observation.metric === 'ANALYSIS_CYCLIC_COMPONENTS'
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

		const observed = runStructuralSccReport(request(), {
			onProgress: () => {
				throw new Error('Observer failure must remain out of band.');
			},
			repositoryRoot: root
		});
		expect(canonicalSemanticJson(observed)).toBe(firstJson);
	}, 60_000);

	it('contains rejected observer results without replacing the terminal outcome', async () => {
		const root = fixture();
		const baseline = runStructuralSccReport({}, { repositoryRoot: root });
		const observed = runStructuralSccReport(
			{},
			{
				onProgress: () => Promise.reject(new Error('observer rejection')),
				repositoryRoot: root
			}
		);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(canonicalSemanticJson(observed)).toBe(canonicalSemanticJson(baseline));
	});

	it('uses deterministic elapsed time when the monotonic clock is unavailable', () => {
		const root = fixture();
		const progress: StructuralSccReportProgressEvent[] = [];
		const clock = vi.spyOn(process.hrtime, 'bigint').mockImplementationOnce(() => {
			throw new Error('clock unavailable');
		});
		try {
			const outcome = runStructuralSccReport(
				{},
				{
					onProgress: (event) => progress.push(event),
					repositoryRoot: root
				}
			);
			expect(outcome).toMatchObject({ code: 'REQUEST_SHAPE_INVALID', outcome: 'unavailable' });
			expect(progress.length).toBeGreaterThan(0);
			expect(progress.every((event) => event.elapsedMs === 0)).toBe(true);
		} finally {
			clock.mockRestore();
		}
	});

	it('fails closed on hostile shapes, traversal, excessive ceilings, and absent projects', () => {
		const root = fixture();
		const extra = { ...request(), unexpected: true };
		const traversing = request({ subjectProjectConfigPaths: ['../escape.json'] });
		const excessive = request({
			budgets: { ...request().budgets, maxResultBytes: 64 * 1024 * 1024 + 1 }
		});
		const missing = request({ subjectProjectConfigPaths: ['packages/demo/missing.json'] });
		const proxy = new Proxy(request(), {});
		const accessorProjects = ['packages/demo/tsconfig.json'];
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
			[accessorArray, 'REQUEST_PROJECTS_INVALID', 2]
		] as const) {
			const outcome = runStructuralSccReport(candidate, { repositoryRoot: root });
			expect(outcome).toMatchObject({ code, outcome: 'unavailable' });
			expect(structuralSccReportExitCode(outcome)).toBe(exitCode);
		}
	});

	it('rejects malformed scalar, path, and project-list boundaries exactly', () => {
		const root = fixture();
		const base = request();
		const inherited = Object.assign(Object.create({ inherited: true }) as object, base);
		const nonEnumerable = { ...base };
		Object.defineProperty(nonEnumerable, 'schemaVersion', {
			enumerable: false,
			value: base.schemaVersion
		});
		const wrongProjectPrototype = ['packages/demo/tsconfig.json'];
		Object.setPrototypeOf(wrongProjectPrototype, null);
		const sparseProjects: string[] = [];
		sparseProjects.length = 1;

		const cases: readonly {
			readonly code: string;
			readonly path?: string;
			readonly state?: 'incompatible' | 'resource-refused';
			readonly value: unknown;
		}[] = [
			{ code: 'REQUEST_SHAPE_INVALID', value: inherited },
			{ code: 'REQUEST_SHAPE_INVALID', value: nonEnumerable },
			{
				code: 'REQUEST_BUDGET_INVALID',
				value: { ...base, budgets: { ...base.budgets, maxResultBytes: 0 } }
			},
			{
				code: 'REQUEST_SCHEMA_VERSION_UNSUPPORTED',
				value: { ...base, schemaVersion: 'unsupported' }
			},
			{
				code: 'REQUEST_OPERATION_VERSION_UNSUPPORTED',
				value: { ...base, operationVersion: 'unsupported' }
			},
			{
				code: 'REQUEST_PATH_INVALID',
				value: { ...base, subjectProjectConfigPaths: [''] }
			},
			{
				code: 'REQUEST_PATH_BUDGET_EXCEEDED',
				state: 'resource-refused',
				value: {
					...base,
					budgets: {
						...base.budgets,
						semantic: { ...base.budgets.semantic, maxPathCharacters: 1 }
					}
				}
			},
			{
				code: 'REQUEST_PATH_INVALID',
				value: { ...base, subjectProjectConfigPaths: ['bad*path.json'] }
			},
			{
				code: 'REQUEST_PROJECTS_INVALID',
				value: { ...base, subjectProjectConfigPaths: wrongProjectPrototype }
			},
			{
				code: 'REQUEST_PROJECTS_INVALID',
				value: { ...base, subjectProjectConfigPaths: [] }
			},
			{
				code: 'REQUEST_PROJECTS_BUDGET_EXCEEDED',
				state: 'resource-refused',
				value: {
					...base,
					budgets: {
						...base.budgets,
						subject: { ...base.budgets.subject, maxProjects: 1 }
					},
					subjectProjectConfigPaths: ['packages/demo/tsconfig.json', 'packages/other/tsconfig.json']
				}
			},
			{
				code: 'REQUEST_PROJECTS_INVALID',
				value: { ...base, subjectProjectConfigPaths: sparseProjects }
			},
			{
				code: 'REQUEST_PROJECTS_INVALID',
				value: {
					...base,
					subjectProjectConfigPaths: ['packages/demo/tsconfig.json', 'packages/demo/tsconfig.json']
				}
			}
		];

		for (const malformed of cases) {
			const outcome = runStructuralSccReport(malformed.value, { repositoryRoot: root });
			expect(outcome, malformed.code).toMatchObject({
				code: malformed.code,
				outcome: 'unavailable',
				stage: 'REQUEST',
				state: malformed.state ?? 'incompatible'
			});
		}
	});

	it('classifies bounded, forbidden, missing, incompatible, and ambiguous subjects', () => {
		const budgetRoot = fixture();
		const base = request();
		const budget = runStructuralSccReport(
			request({
				budgets: {
					...base.budgets,
					subject: { ...base.budgets.subject, maxFiles: 1 }
				}
			}),
			{ repositoryRoot: budgetRoot }
		);
		expect(budget).toMatchObject({
			code: 'SUBJECT_RESOURCE_REFUSED',
			outcome: 'unavailable',
			stage: 'SUBJECT',
			state: 'resource-refused'
		});

		const forbiddenRoot = fixture();
		json(forbiddenRoot, 'packages/demo/tsconfig.json', {
			compilerOptions: { noLib: true },
			include: ['src/*/../outside.ts']
		});
		const forbidden = runStructuralSccReport(request(), { repositoryRoot: forbiddenRoot });
		expect(forbidden).toMatchObject({
			code: 'SUBJECT_FORBIDDEN',
			outcome: 'unavailable',
			stage: 'SUBJECT',
			state: 'incompatible'
		});

		const missingRoot = fixture();
		rmSync(join(missingRoot, 'package.json'));
		const missing = runStructuralSccReport(request(), { repositoryRoot: missingRoot });
		expect(missing).toMatchObject({
			code: 'SUBJECT_NOT_FOUND',
			outcome: 'unavailable',
			stage: 'SUBJECT',
			state: 'incompatible'
		});

		const incompatibleRoot = fixture();
		write(incompatibleRoot, 'packages/demo/package.json', '{ malformed');
		const incompatible = runStructuralSccReport(request(), { repositoryRoot: incompatibleRoot });
		expect(incompatible).toMatchObject({
			code: 'SUBJECT_INCOMPATIBLE',
			outcome: 'unavailable',
			stage: 'SUBJECT',
			state: 'incompatible'
		});

		const ambiguousRoot = fixture();
		json(ambiguousRoot, 'packages/other/package.json', {
			name: '@fixture/scc-report',
			private: true,
			version: '0.0.0'
		});
		write(ambiguousRoot, 'packages/other/src/index.ts', 'export const other = true;\n');
		const ambiguous = runStructuralSccReport(request(), { repositoryRoot: ambiguousRoot });
		expect(ambiguous).toMatchObject({
			code: 'SUBJECT_AMBIGUOUS',
			outcome: 'unavailable',
			stage: 'SUBJECT',
			state: 'incompatible'
		});
	}, 60_000);

	it('rejects directory project selectors and invalid repository roots distinctly', () => {
		const root = fixture();
		const directory = runStructuralSccReport(
			request({ subjectProjectConfigPaths: ['packages/demo'] }),
			{ repositoryRoot: root }
		);
		expect(directory).toMatchObject({
			code: 'PROJECT_PATH_INVALID',
			outcome: 'unavailable',
			stage: 'SUBJECT',
			state: 'incompatible'
		});

		const invalidRoot = runStructuralSccReport(request(), {
			repositoryRoot: join(root, 'missing-root')
		});
		expect(invalidRoot).toMatchObject({
			code: 'REPOSITORY_ROOT_UNAVAILABLE',
			outcome: 'unavailable',
			stage: 'REQUEST',
			state: 'failed'
		});
		expect(structuralSccReportExitCode(invalidRoot)).toBe(4);
	});

	it('reports stale and unavailable currentness without changing captured SCC evidence', () => {
		for (const [expectedState, mutate] of [
			[
				'STALE',
				(root: string) => write(root, 'packages/demo/src/leaf.ts', 'export const leaf = 2;\n')
			],
			['UNAVAILABLE', (root: string) => write(root, 'package.json', '{ malformed')]
		] as const) {
			const root = fixture();
			let mutated = false;
			const outcome = runStructuralSccReport(request(), {
				onProgress: (event) => {
					if (
						!mutated &&
						event.kind === 'REPORT_STAGE' &&
						event.phase === 'ANALYSIS' &&
						event.state === 'COMPLETED'
					) {
						mutated = true;
						mutate(root);
					}
				},
				repositoryRoot: root
			});
			expect(mutated, expectedState).toBe(true);
			expect(outcome.outcome, expectedState).toBe('partial');
			if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
			expect(outcome.result.currentness.state).toBe(expectedState);
			expect(outcome.stageOutcomes.currentness.state).toBe(expectedState);
			expect(outcome.result.analysis.coverage.partitionReconciles).toBe(true);
			if (expectedState === 'STALE')
				expect(outcome.result.currentness.changedPaths).toContain('packages/demo/src/leaf.ts');
			else expect(outcome.result.currentness.diagnosticCodes).toContain('CONFIG_MALFORMED');
		}
	}, 60_000);

	it('refuses result and SCC population budgets without returning a partial population', () => {
		const root = fixture();
		const resultRefusal = runStructuralSccReport(
			request({ budgets: { ...request().budgets, maxResultBytes: 1 } }),
			{ repositoryRoot: root }
		);
		expect(resultRefusal).toMatchObject({
			code: 'RESULT_BUDGET_EXCEEDED',
			outcome: 'unavailable',
			stage: 'RESULT',
			state: 'resource-refused'
		});
		expect(structuralSccReportExitCode(resultRefusal)).toBe(3);

		for (const budgetKey of [
			'maxComponents',
			'maxEdges',
			'maxInputRecords',
			'maxInputStringCharacters',
			'maxNodes',
			'maxTraversalSteps'
		] as const) {
			const baseline = request();
			const progress: StructuralSccReportProgressEvent[] = [];
			const analysisRefusal = runStructuralSccReport(
				request({
					budgets: {
						...baseline.budgets,
						scc: { ...baseline.budgets.scc, [budgetKey]: 1 }
					}
				}),
				{ onProgress: (event) => progress.push(event), repositoryRoot: root }
			);
			expect(analysisRefusal, budgetKey).toMatchObject({
				code: 'STRUCTURAL_SCC_UNAVAILABLE',
				outcome: 'unavailable',
				stage: 'ANALYSIS',
				state: 'resource-refused'
			});
			expect(structuralSccReportExitCode(analysisRefusal)).toBe(3);
			expect(progress.at(-1), budgetKey).toMatchObject({
				detailCode: 'BUDGET_EXCEEDED',
				kind: 'REPORT_STAGE',
				phase: 'ANALYSIS',
				state: 'FAILED'
			});
			expect(canonicalSemanticJson(analysisRefusal)).not.toContain('"analysis":');
		}
	}, 60_000);

	it('reports exact semantic bytes when snapshot serialization exceeds its budget', () => {
		const root = fixture();
		const calibrationProgress: StructuralSccReportProgressEvent[] = [];
		const calibration = runStructuralSccReport(request(), {
			onProgress: (event) => calibrationProgress.push(event),
			repositoryRoot: root
		});
		expect(calibration.outcome).toBe('partial');
		const calibratedBytes = calibrationProgress
			.find(
				(event) =>
					event.kind === 'SEMANTIC_SNAPSHOT' &&
					event.semanticProgress.phase === 'SERIALIZE' &&
					event.semanticProgress.state === 'COMPLETED'
			)
			?.observations.find(
				(observation) => observation.metric === 'SEMANTIC_CANONICAL_BYTES'
			)?.value;
		expect(calibratedBytes).toBeGreaterThan(2_048);
		const maxSnapshotBytes = calibratedBytes! - 1_024;
		const baseline = request();
		const progress: StructuralSccReportProgressEvent[] = [];
		const outcome = runStructuralSccReport(
			request({
				budgets: {
					...baseline.budgets,
					semantic: { ...baseline.budgets.semantic, maxSnapshotBytes }
				}
			}),
			{ onProgress: (event) => progress.push(event), repositoryRoot: root }
		);
		expect(outcome).toMatchObject({
			code: 'SEMANTIC_SNAPSHOT_UNAVAILABLE',
			outcome: 'unavailable',
			stage: 'SEMANTIC_SNAPSHOT',
			state: 'resource-refused'
		});
		const failedSerialization = progress.find(
			(event) =>
				event.kind === 'SEMANTIC_SNAPSHOT' &&
				event.semanticProgress.phase === 'SERIALIZE' &&
				event.semanticProgress.state === 'FAILED'
		);
		expect(failedSerialization?.detailCode).toBe('SEMANTIC_BUDGET_EXCEEDED');
		const bytes = failedSerialization?.observations.find(
			(observation) => observation.metric === 'SEMANTIC_CANONICAL_BYTES'
		);
		expect(bytes).toMatchObject({ basis: 'EXACT', limit: maxSnapshotBytes, unit: 'BYTES' });
		expect(bytes?.value).toBeGreaterThan(maxSnapshotBytes);
		expect(progress.at(-1)).toMatchObject({
			detailCode: 'SEMANTIC_SNAPSHOT_UNAVAILABLE',
			kind: 'REPORT_STAGE',
			phase: 'SEMANTIC_SNAPSHOT',
			state: 'FAILED'
		});
	}, 60_000);
});
