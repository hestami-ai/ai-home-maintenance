import { Buffer } from 'node:buffer';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
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
