import { Buffer } from 'node:buffer';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	PROJECT_CONTEXT_REPORT_OPERATION_VERSION,
	PROJECT_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION
} from '../contracts/project-context-report.js';
import {
	READ_WRITE_ACCESS_REPORT_AUTHORITY,
	READ_WRITE_ACCESS_REPORT_AUTHORITY_TRANSFER,
	READ_WRITE_ACCESS_REPORT_GATE_EFFECT,
	READ_WRITE_ACCESS_REPORT_NONCLAIMS,
	READ_WRITE_ACCESS_REPORT_OPERATION_VERSION,
	READ_WRITE_ACCESS_REPORT_REQUEST_SCHEMA_VERSION,
	READ_WRITE_ACCESS_REPORT_SAFETY_CEILINGS,
	READ_WRITE_ACCESS_REPORT_SCHEMA_VERSION,
	type ReadWriteAccessReportRequest
} from '../contracts/read-write-access-report.js';
import type { ReadWriteAccessGraphBuildDiagnostic } from '../contracts/read-write-access-graph.js';
import { validateReadWriteAccessGraph } from '../graph/validate-read-write-access-graph.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import { captureProjectContextReportPipeline } from './run-project-context-report.js';
import {
	READ_WRITE_ACCESS_REPORT_PROGRESS_NONCLAIMS,
	READ_WRITE_ACCESS_REPORT_PROGRESS_SCHEMA_VERSION,
	classifyReadWriteAccessGraphFailureState,
	readWriteAccessReportExitCode,
	runReadWriteAccessReport,
	type ReadWriteAccessReportProgressEvent
} from './run-read-write-access-report.js';

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
	const root = mkdtempSync(join(tmpdir(), 'csaa-read-write-access-report-'));
	temporaryRoots.push(root);
	json(root, 'package.json', {
		name: 'read-write-access-report-fixture',
		private: true,
		workspaces: ['projects/*']
	});
	for (const name of ['left', 'right'] as const)
		json(root, `projects/${name}/package.json`, {
			name: `@fixture/${name}`,
			private: true,
			type: 'module',
			version: '0.0.0'
		});
	json(root, 'tsconfig.json', {
		files: [],
		include: [],
		references: [{ path: './projects/left' }, { path: './projects/right' }]
	});
	const compilerOptions = {
		composite: true,
		module: 'NodeNext',
		moduleResolution: 'NodeNext',
		noEmit: true,
		noLib: true,
		strict: true,
		target: 'ES2022'
	};
	json(root, 'projects/left/tsconfig.json', {
		compilerOptions,
		files: ['src/alpha.ts', 'src/middle.ts', 'src/zeta.ts']
	});
	json(root, 'projects/right/tsconfig.json', {
		compilerOptions,
		files: ['src/index.ts']
	});
	write(
		root,
		'projects/left/src/alpha.ts',
		source ??
			[
				"import { middle } from './middle.js';",
				'export let alpha = middle + 1;',
				'alpha += middle;',
				'const bag: { [key: string]: number } = {};',
				"const key = 'x';",
				'bag[key] = alpha;',
				"bag[key + 'next'] = middle;",
				''
			].join('\n')
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
	overrides: Partial<ReadWriteAccessReportRequest> = {}
): ReadWriteAccessReportRequest {
	return {
		budgets: READ_WRITE_ACCESS_REPORT_SAFETY_CEILINGS,
		operationVersion: READ_WRITE_ACCESS_REPORT_OPERATION_VERSION,
		schemaVersion: READ_WRITE_ACCESS_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: ['tsconfig.json'],
		...overrides
	};
}

function withReadWriteBudget(
	base: ReadWriteAccessReportRequest,
	key: keyof ReadWriteAccessReportRequest['budgets']['readWriteAccess'],
	value: number
): ReadWriteAccessReportRequest {
	return {
		...base,
		budgets: {
			...base.budgets,
			readWriteAccess: { ...base.budgets.readWriteAccess, [key]: value }
		}
	};
}

afterEach(() => {
	for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe('runReadWriteAccessReport', () => {
	it('classifies graph resource, request/precondition, and internal failures distinctly', () => {
		const diagnostic = (
			code: ReadWriteAccessGraphBuildDiagnostic['code']
		): ReadWriteAccessGraphBuildDiagnostic => ({
			code,
			message: code,
			path: null,
			phase: code === 'BUDGET_EXCEEDED' ? 'CLASSIFY' : 'REQUEST'
		});

		expect(classifyReadWriteAccessGraphFailureState([diagnostic('BUDGET_EXCEEDED')])).toBe(
			'resource-refused'
		);
		for (const code of ['REQUEST_INVALID', 'SEMANTIC_CAPABILITY_UNAVAILABLE'] as const)
			expect(classifyReadWriteAccessGraphFailureState([diagnostic(code)]), code).toBe(
				'incompatible'
			);
		for (const code of [
			'SEMANTIC_SNAPSHOT_ID_MISMATCH',
			'SUBJECT_ID_MISMATCH',
			'UNSAFE_SEMANTIC_INPUT'
		] as const)
			expect(classifyReadWriteAccessGraphFailureState([diagnostic(code)]), code).toBe('failed');
	});

	it(
		'returns one deterministic full Program-local graph with exact project/source evidence',
		{ timeout: 120_000 },
		async () => {
			const root = fixture();
			const progress: ReadWriteAccessReportProgressEvent[] = [];
			const first = runReadWriteAccessReport(request(), {
				onProgress: (event) => progress.push(event),
				repositoryRoot: root
			});
			expect(first.outcome).toBe('partial');
			expect(readWriteAccessReportExitCode(first)).toBe(3);
			if (first.outcome !== 'partial') throw new Error(JSON.stringify(first));

			expect(first).toMatchObject({
				analysisAuthority: READ_WRITE_ACCESS_REPORT_AUTHORITY,
				authorityTransfer: READ_WRITE_ACCESS_REPORT_AUTHORITY_TRANSFER,
				gateEffect: READ_WRITE_ACCESS_REPORT_GATE_EFFECT,
				state: 'partial'
			});
			expect(first.result.capability).toEqual({
				architectureDiscovery: 'NOT_CLAIMED',
				changeImpact: 'NOT_CLAIMED',
				codeSlice: 'NOT_CLAIMED',
				fullJanCsaaCapability007DataFlow: 'NOT_CLAIMED',
				id: 'TYPESCRIPT_READ_WRITE_ACCESS',
				semanticComparison: 'NOT_CLAIMED',
				semanticQuery: 'NOT_CLAIMED',
				status: 'PARTIAL'
			});
			expect(first.result.facadeNonclaims).toBe(READ_WRITE_ACCESS_REPORT_NONCLAIMS);
			expect(READ_WRITE_ACCESS_REPORT_NONCLAIMS).toEqual(
				expect.arrayContaining([
					'JAN_CSAA_CAP_007_DATA_FLOW',
					'ZERO_RECORDED_ACCESS_AS_UNUSED_UNREAD_UNWRITTEN_DEAD_IRRELEVANT_NON_IMPACT_OR_SAFE_REMOVAL',
					'RULE_FINDING_SEVERITY_GATE_DESIGN_MERGE_REMEDIATION_OR_DISPOSITION_AUTHORITY'
				])
			);
			expect(first.result.currentness).toMatchObject({
				changedPaths: [],
				scope: 'SELECTED_CAPTURED_SUBJECT_ONLY',
				state: 'CURRENT_FOR_CAPTURED_SUBJECT'
			});
			expect(first.result.evidence.coordinateSystem).toBe('UTF16_CODE_UNIT_ZERO_BASED_HALF_OPEN');
			const graph = first.result.evidence.readWriteAccessGraph;
			const context = first.result.evidence.projectContextGraph;
			expect(graph).toMatchObject({
				capability: 'TYPESCRIPT_READ_WRITE_ACCESS',
				capabilityStatus: 'PARTIAL',
				fullJanCsaaCapability007DataFlow: 'NOT_CLAIMED',
				health: 'PARTIAL',
				semanticSnapshotId: context.semanticSnapshotId,
				subjectId: context.subjectId
			});
			expect(graph.coverage).toMatchObject({ closure: 'OPEN', reconciles: true });
			expect(graph.coverage.accessOccurrences).toBeGreaterThan(0);
			expect(graph.coverage.readAccesses).toBeGreaterThan(0);
			expect(graph.coverage.writeAccesses + graph.coverage.readWriteAccesses).toBeGreaterThan(0);
			expect(graph.coverage.frontierNodes).toBeGreaterThanOrEqual(2);
			expect(first.result.coverage).toEqual({
				accessOccurrences: graph.coverage.accessOccurrences,
				closure: graph.coverage.closure,
				edges: graph.coverage.edges,
				frontierNodes: graph.coverage.frontierNodes,
				readAccesses: graph.coverage.readAccesses,
				readWriteAccesses: graph.coverage.readWriteAccesses,
				reconciles: graph.coverage.reconciles,
				symbolSlots: graph.coverage.symbolSlots,
				writeAccesses: graph.coverage.writeAccesses
			});
			const contextSourceIds = new Set(context.sources.map((source) => source.semanticSourceId));
			expect(
				graph.nodes.every((node) =>
					node.sourceLocations.every((location) => contextSourceIds.has(location.sourceId))
				)
			).toBe(true);
			expect(context.sources.every((source) => source.logicalPath.length > 0)).toBe(true);

			const predecessor = captureProjectContextReportPipeline(
				{
					budgets: {
						maxResultBytes: first.request.budgets.maxResultBytes,
						projectContext: first.request.budgets.projectContext,
						semantic: first.request.budgets.semantic,
						subject: first.request.budgets.subject
					},
					operationVersion: PROJECT_CONTEXT_REPORT_OPERATION_VERSION,
					schemaVersion: PROJECT_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION,
					subjectProjectConfigPaths: first.request.subjectProjectConfigPaths
				},
				{ repositoryRoot: root }
			);
			expect(predecessor.outcome).toBe('captured');
			if (predecessor.outcome !== 'captured') throw new Error(JSON.stringify(predecessor));
			expect(validateReadWriteAccessGraph(graph, predecessor.semanticSnapshot).state).toBe('VALID');

			const firstJson = canonicalSemanticJson(first);
			expect(firstJson).not.toContain(root);
			expect(firstJson).not.toContain(root.replaceAll('\\', '/'));
			expect(progress.map((event) => event.sequence)).toEqual(
				progress.map((_, index) => index + 1)
			);
			expect(
				progress.every(
					(event) =>
						event.nonclaims === READ_WRITE_ACCESS_REPORT_PROGRESS_NONCLAIMS &&
						event.schemaVersion === READ_WRITE_ACCESS_REPORT_PROGRESS_SCHEMA_VERSION &&
						event.reportIdentityEffect === 'EXCLUDED_FROM_REPORT_IDENTITY'
				)
			).toBe(true);
			expect(progress.map(({ phase, stage, state }) => ({ phase, stage, state }))).toEqual(
				(
					[
						['REQUEST_BIND', 'REQUEST'],
						['PREDECESSOR_PIPELINE', 'PREDECESSOR_PIPELINE'],
						['READ_WRITE_ACCESS', 'READ_WRITE_ACCESS'],
						['CURRENTNESS', 'CURRENTNESS'],
						['RESULT', 'RESULT']
					] as const
				).flatMap(([phase, stage]) => [
					{ phase, stage, state: 'STARTED' },
					{ phase, stage, state: 'COMPLETED' }
				])
			);
			expect(progress.at(-1)).toMatchObject({
				detailCode: 'PARTIAL',
				phase: 'RESULT',
				state: 'COMPLETED'
			});
			expect(
				progress.at(-1)?.observations.find((candidate) => candidate.metric === 'RESULT_BYTES')
			).toMatchObject({
				limit: first.request.budgets.maxResultBytes,
				unit: 'BYTES',
				value: Buffer.byteLength(firstJson, 'utf8') + 1
			});
			const progressLength = progress.length;
			await new Promise<void>((resolve) => setImmediate(resolve));
			expect(progress).toHaveLength(progressLength);

			const second = runReadWriteAccessReport(request(), {
				onProgress: () => {
					throw new Error('Observer failure must remain out of band.');
				},
				repositoryRoot: root
			});
			expect(canonicalSemanticJson(second)).toBe(firstJson);
		}
	);

	it(
		'admits exact graph populations and atomically refuses every one-record-short budget',
		{ timeout: 120_000 },
		() => {
			const root = fixture();
			const baselineRequest = request();
			const baseline = runReadWriteAccessReport(baselineRequest, { repositoryRoot: root });
			expect(baseline.outcome).toBe('partial');
			if (baseline.outcome !== 'partial') throw new Error(JSON.stringify(baseline));
			const graph = baseline.result.evidence.readWriteAccessGraph;
			const populations = {
				maxAccesses: graph.coverage.accessOccurrences,
				maxEdges: graph.edges.length,
				maxFrontiers: graph.coverage.frontierNodes,
				maxNodes: graph.nodes.length
			} as const;
			for (const [key, population] of Object.entries(populations) as [
				keyof typeof populations,
				number
			][]) {
				expect(population, key).toBeGreaterThan(1);
				const exact = runReadWriteAccessReport(
					withReadWriteBudget(baselineRequest, key, population),
					{ repositoryRoot: root }
				);
				expect(exact.outcome, key).toBe('partial');
				const refused = runReadWriteAccessReport(
					withReadWriteBudget(baselineRequest, key, population - 1),
					{ repositoryRoot: root }
				);
				expect(refused, key).toMatchObject({
					code: 'READ_WRITE_ACCESS_UNAVAILABLE',
					outcome: 'unavailable',
					stage: 'READ_WRITE_ACCESS',
					state: 'resource-refused'
				});
				if (refused.outcome !== 'unavailable') throw new Error(JSON.stringify(refused));
				expect(refused).not.toHaveProperty('result');
				expect(
					refused.diagnostics.some((diagnostic) => diagnostic.code === 'BUDGET_EXCEEDED')
				).toBe(true);
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
				const outcome = runReadWriteAccessReport(candidate, { repositoryRoot: root });
				expect(outcome.outcome).toBe('partial');
				exactBytes = Buffer.byteLength(canonicalSemanticJson(outcome), 'utf8') + 1;
				if (exactBytes === limit) break;
				limit = exactBytes;
			}
			expect(exactBytes).toBe(limit);
			const refused = runReadWriteAccessReport(
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

	it('retains capture-bound graph evidence while reporting a final subject mutation as stale', () => {
		const root = fixture();
		let mutated = false;
		const outcome = runReadWriteAccessReport(request(), {
			onProgress: (event) => {
				if (!mutated && event.phase === 'CURRENTNESS' && event.state === 'STARTED') {
					mutated = true;
					write(root, 'projects/left/src/zeta.ts', 'export const zeta = 2;\n');
				}
			},
			repositoryRoot: root
		});
		expect(mutated).toBe(true);
		expect(outcome.outcome).toBe('partial');
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		expect(outcome.result.currentness).toEqual({
			changedPaths: ['projects/left/src/zeta.ts'],
			diagnosticCodes: ['SUBJECT_CHANGED_DURING_RESOLUTION'],
			scope: 'SELECTED_CAPTURED_SUBJECT_ONLY',
			state: 'STALE'
		});
		expect(outcome.result.evidence.readWriteAccessGraph.coverage.accessOccurrences).toBeGreaterThan(
			0
		);
	});

	it('keeps an empty supported access population explicitly partial and open', () => {
		const root = fixture('export interface Marker { readonly value: string }\n');
		write(root, 'projects/left/src/middle.ts', 'export interface Middle {}\n');
		write(root, 'projects/left/src/zeta.ts', 'export type Zeta = string;\n');
		write(root, 'projects/right/src/index.ts', 'export interface Right {}\n');
		const outcome = runReadWriteAccessReport(request(), { repositoryRoot: root });
		expect(outcome.outcome).toBe('partial');
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		expect(outcome.result.coverage).toMatchObject({
			accessOccurrences: 0,
			closure: 'OPEN',
			edges: 0,
			readAccesses: 0,
			readWriteAccesses: 0,
			writeAccesses: 0
		});
		expect(outcome.result.facadeNonclaims).toContain(
			'ZERO_RECORDED_ACCESS_AS_UNUSED_UNREAD_UNWRITTEN_DEAD_IRRELEVANT_NON_IMPACT_OR_SAFE_REMOVAL'
		);
	});

	it('rejects non-data records, incompatible versions, invalid local budgets, and invalid predecessor input', () => {
		const root = fixture();
		const inherited = Object.assign(Object.create({ inherited: true }) as object, request());
		const cases: readonly {
			readonly code: string;
			readonly path: string;
			readonly value: unknown;
		}[] = [
			{ code: 'REQUEST_SHAPE_INVALID', path: '$', value: inherited },
			{ code: 'REQUEST_SHAPE_INVALID', path: '$', value: { ...request(), unexpected: true } },
			{
				code: 'REQUEST_OPERATION_INCOMPATIBLE',
				path: '$.operationVersion',
				value: { ...request(), operationVersion: 'unsupported' }
			},
			{
				code: 'REQUEST_SCHEMA_INCOMPATIBLE',
				path: '$.schemaVersion',
				value: { ...request(), schemaVersion: 'unsupported' }
			},
			{
				code: 'REQUEST_PROJECTS_INVALID',
				path: '$.subjectProjectConfigPaths',
				value: { ...request(), subjectProjectConfigPaths: [] }
			}
		];

		for (const malformed of cases) {
			const outcome = runReadWriteAccessReport(malformed.value, { repositoryRoot: root });
			expect(outcome, malformed.code).toMatchObject({
				code: malformed.code,
				outcome: 'unavailable',
				stage: 'REQUEST',
				state: 'incompatible'
			});
			expect(outcome.diagnostics[0], malformed.code).toMatchObject({ path: malformed.path });
			expect(readWriteAccessReportExitCode(outcome), malformed.code).toBe(2);
		}

		for (const value of [0, -0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
			const outcome = runReadWriteAccessReport(withReadWriteBudget(request(), 'maxEdges', value), {
				repositoryRoot: root
			});
			expect(outcome, String(value)).toMatchObject({
				code: 'REQUEST_BUDGET_INVALID',
				outcome: 'unavailable',
				stage: 'REQUEST',
				state: 'incompatible'
			});
		}
	});

	it('contains rejected telemetry and retains a monotonic zero fallback when the host clock fails', async () => {
		const root = fixture();
		const baseline = runReadWriteAccessReport({}, { repositoryRoot: root });
		const progress: ReadWriteAccessReportProgressEvent[] = [];
		const clock = vi.spyOn(process.hrtime, 'bigint').mockImplementation(() => {
			throw new Error('The trusted-host monotonic clock is unavailable.');
		});
		let observed;
		try {
			observed = runReadWriteAccessReport(
				{},
				{
					onProgress: (event) => {
						progress.push(event);
						return Promise.reject(new Error('Rejected telemetry remains out of band.'));
					},
					repositoryRoot: root
				}
			);
		} finally {
			clock.mockRestore();
		}

		expect(canonicalSemanticJson(observed)).toBe(canonicalSemanticJson(baseline));
		expect(progress).toHaveLength(2);
		expect(progress.every((event) => event.elapsedMs === 0)).toBe(true);
		await new Promise<void>((resolve) => setImmediate(resolve));
	});

	it('retains capture-bound evidence when final selected-subject currentness becomes unavailable', () => {
		const root = fixture();
		let removed = false;
		const outcome = runReadWriteAccessReport(request(), {
			onProgress: (event) => {
				if (!removed && event.phase === 'CURRENTNESS' && event.state === 'STARTED') {
					removed = true;
					rmSync(join(root, 'projects/left/tsconfig.json'));
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
		expect(outcome.result.currentness.diagnosticCodes).toContain('REFERENCE_REQUIRED_MISSING');
		expect(outcome.result.evidence.readWriteAccessGraph.coverage.accessOccurrences).toBeGreaterThan(
			0
		);
	});

	it('preserves predecessor resource refusal without publishing graph evidence', () => {
		const root = fixture();
		const baseline = request();
		const outcome = runReadWriteAccessReport(
			request({
				budgets: {
					...baseline.budgets,
					subject: { ...baseline.budgets.subject, maxFiles: 1 }
				}
			}),
			{ repositoryRoot: root }
		);

		expect(outcome).toMatchObject({
			code: 'SUBJECT_RESOURCE_REFUSED',
			outcome: 'unavailable',
			stage: 'PREDECESSOR_PIPELINE',
			state: 'resource-refused'
		});
		expect(outcome).not.toHaveProperty('result');
		expect(
			outcome.diagnostics.every((diagnostic) => diagnostic.source === 'PREDECESSOR_PIPELINE')
		).toBe(true);
	});

	it('fails closed when the trusted host throws while supplying the fixed repository root', () => {
		const root = fixture();
		const progress: ReadWriteAccessReportProgressEvent[] = [];
		const options = new Proxy(
			{
				onProgress: (event: ReadWriteAccessReportProgressEvent) => progress.push(event),
				repositoryRoot: root
			},
			{
				get(target, property, receiver) {
					if (property === 'repositoryRoot')
						throw new Error('The trusted host could not supply its fixed root.');
					return Reflect.get(target, property, receiver);
				}
			}
		);
		const outcome = runReadWriteAccessReport(request(), options);

		expect(outcome).toMatchObject({
			code: 'INTERNAL_FAILURE',
			outcome: 'unavailable',
			stage: 'RESULT',
			state: 'failed'
		});
		expect(readWriteAccessReportExitCode(outcome)).toBe(4);
		expect(progress.at(-1)).toMatchObject({
			detailCode: 'INTERNAL_FAILURE',
			phase: 'PREDECESSOR_PIPELINE',
			state: 'FAILED'
		});
	});

	it('fails closed when independently validated graph evidence is structurally inconsistent', async () => {
		const root = fixture();
		vi.resetModules();
		vi.doMock('../graph/build-read-write-access-graph.js', async (importOriginal) => {
			const actual =
				await importOriginal<typeof import('../graph/build-read-write-access-graph.js')>();
			return {
				...actual,
				buildReadWriteAccessGraph: (
					...args: Parameters<typeof actual.buildReadWriteAccessGraph>
				) => {
					const outcome = actual.buildReadWriteAccessGraph(...args);
					if (outcome.outcome !== 'partial') return outcome;
					return {
						...outcome,
						graph: {
							...outcome.graph,
							coverage: {
								...outcome.graph.coverage,
								edges: outcome.graph.coverage.edges + 1
							}
						}
					};
				}
			};
		});

		try {
			const isolated = await import('./run-read-write-access-report.js');
			const outcome = isolated.runReadWriteAccessReport(request(), { repositoryRoot: root });
			expect(outcome).toMatchObject({
				code: 'GRAPH_VALIDATION_FAILED',
				outcome: 'unavailable',
				stage: 'READ_WRITE_ACCESS',
				state: 'failed'
			});
			expect(
				outcome.diagnostics.some(
					(diagnostic) =>
						diagnostic.source === 'READ_WRITE_ACCESS' && diagnostic.phase === 'VALIDATE'
				)
			).toBe(true);
		} finally {
			vi.doUnmock('../graph/build-read-write-access-graph.js');
			vi.resetModules();
		}
	});

	it('redacts absolute graph diagnostics and rejects paths outside the fixed repository root', async () => {
		const root = fixture();
		vi.resetModules();
		vi.doMock('../graph/build-read-write-access-graph.js', () => ({
			buildReadWriteAccessGraph: () => ({
				diagnostics: [
					{
						code: 'UNSAFE_SEMANTIC_INPUT',
						message: `Unsafe source under ${root}.`,
						path: join(root, 'projects/left/src/alpha.ts'),
						phase: 'CLASSIFY'
					},
					{
						code: 'UNSAFE_SEMANTIC_INPUT',
						message: 'Unsafe source outside the selected root.',
						path: '../outside.ts',
						phase: 'CLASSIFY'
					}
				],
				outcome: 'unavailable'
			})
		}));

		try {
			const isolated = await import('./run-read-write-access-report.js');
			const outcome = isolated.runReadWriteAccessReport(request(), { repositoryRoot: root });
			expect(outcome).toMatchObject({
				code: 'READ_WRITE_ACCESS_UNAVAILABLE',
				outcome: 'unavailable',
				stage: 'READ_WRITE_ACCESS',
				state: 'failed'
			});
			expect(outcome.diagnostics.slice(-2).map((diagnostic) => diagnostic.path)).toEqual([
				'projects/left/src/alpha.ts',
				null
			]);
			expect(canonicalSemanticJson(outcome)).not.toContain(root);
		} finally {
			vi.doUnmock('../graph/build-read-write-access-graph.js');
			vi.resetModules();
		}
	});

	it('rejects a graph that passes its validator but does not reconcile with captured evidence', async () => {
		const root = fixture();
		const baseline = runReadWriteAccessReport(request(), { repositoryRoot: root });
		expect(baseline.outcome).toBe('partial');
		if (baseline.outcome !== 'partial') throw new Error(JSON.stringify(baseline));
		const nonReconcilingGraph = {
			...baseline.result.evidence.readWriteAccessGraph,
			subjectId: 'non-reconciling-subject'
		};
		vi.resetModules();
		vi.doMock('../graph/build-read-write-access-graph.js', () => ({
			buildReadWriteAccessGraph: () => ({
				diagnostics: [],
				graph: nonReconcilingGraph,
				outcome: 'partial'
			})
		}));
		vi.doMock('../graph/validate-read-write-access-graph.js', () => ({
			validateReadWriteAccessGraph: () => ({ issues: [], state: 'VALID' })
		}));

		try {
			const isolated = await import('./run-read-write-access-report.js');
			const outcome = isolated.runReadWriteAccessReport(request(), { repositoryRoot: root });
			expect(outcome).toMatchObject({
				code: 'EVIDENCE_IDENTITY_MISMATCH',
				outcome: 'unavailable',
				stage: 'RESULT',
				state: 'failed'
			});
			expect(outcome.diagnostics.at(-1)).toMatchObject({
				code: 'EVIDENCE_IDENTITY_MISMATCH',
				source: 'REPORT'
			});
		} finally {
			vi.doUnmock('../graph/build-read-write-access-graph.js');
			vi.doUnmock('../graph/validate-read-write-access-graph.js');
			vi.resetModules();
		}
	});

	it('fails closed when canonical terminal-report serialization is unavailable', async () => {
		const root = fixture();
		vi.resetModules();
		vi.doMock('../semantic/canonical.js', async (importOriginal) => {
			const actual = await importOriginal<typeof import('../semantic/canonical.js')>();
			return {
				...actual,
				canonicalSemanticJsonWitness: (value: unknown) => {
					const record = value as Readonly<Record<string, unknown>>;
					if (
						value !== null &&
						typeof value === 'object' &&
						record.schemaVersion === READ_WRITE_ACCESS_REPORT_SCHEMA_VERSION &&
						record.outcome === 'partial'
					)
						throw new Error('Canonical report serialization is unavailable.');
					return actual.canonicalSemanticJsonWitness(value);
				}
			};
		});

		try {
			const isolated = await import('./run-read-write-access-report.js');
			const outcome = isolated.runReadWriteAccessReport(request(), { repositoryRoot: root });
			expect(outcome).toMatchObject({
				code: 'RESULT_SERIALIZATION_FAILED',
				outcome: 'unavailable',
				stage: 'RESULT',
				state: 'failed'
			});
		} finally {
			vi.doUnmock('../semantic/canonical.js');
			vi.resetModules();
		}
	});

	it('rejects hostile wire values without invoking accessors and enforces absolute ceilings', () => {
		const root = fixture();
		expect(
			runReadWriteAccessReport(new Proxy(request(), {}), { repositoryRoot: root })
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
		expect(runReadWriteAccessReport(hostile, { repositoryRoot: root })).toMatchObject({
			code: 'REQUEST_SHAPE_INVALID',
			stage: 'REQUEST',
			state: 'incompatible'
		});
		expect(getterReads).toBe(0);

		for (const key of ['maxAccesses', 'maxEdges', 'maxFrontiers', 'maxNodes'] as const) {
			const refused = runReadWriteAccessReport(
				withReadWriteBudget(
					request(),
					key,
					READ_WRITE_ACCESS_REPORT_SAFETY_CEILINGS.readWriteAccess[key] + 1
				),
				{ repositoryRoot: root }
			);
			expect(refused, key).toMatchObject({
				code: 'REQUEST_BUDGET_EXCEEDS_SAFETY_CEILING',
				analysisAuthority: 'NONE',
				authorityTransfer: 'NONE',
				gateEffect: 'NONE',
				stage: 'REQUEST',
				state: 'resource-refused'
			});
		}

		const missingRoot = runReadWriteAccessReport(request(), {
			repositoryRoot: join(root, 'absent')
		});
		expect(missingRoot).toMatchObject({
			analysisAuthority: 'NONE',
			authorityTransfer: 'NONE',
			gateEffect: 'NONE',
			outcome: 'unavailable',
			stage: 'PREDECESSOR_PIPELINE',
			state: 'failed'
		});
		expect(readWriteAccessReportExitCode(missingRoot)).toBe(4);
	});
});
