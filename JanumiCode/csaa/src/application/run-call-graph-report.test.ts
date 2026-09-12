import { Buffer } from 'node:buffer';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	CALL_GRAPH_REPORT_AUTHORITY,
	CALL_GRAPH_REPORT_AUTHORITY_TRANSFER,
	CALL_GRAPH_REPORT_GATE_EFFECT,
	CALL_GRAPH_REPORT_NONCLAIMS,
	CALL_GRAPH_REPORT_OPERATION_VERSION,
	CALL_GRAPH_REPORT_REQUEST_SCHEMA_VERSION,
	CALL_GRAPH_REPORT_SAFETY_CEILINGS,
	type CallGraphReportRequest
} from '../contracts/call-graph-report.js';
import type { BoundedCallGraphBuildDiagnostic } from '../graph/build-call-graph.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import { captureProjectContextReportPipeline } from './run-project-context-report.js';
import {
	CALL_GRAPH_REPORT_PROGRESS_NONCLAIMS,
	callGraphReportExitCode,
	classifyCallGraphFailureState,
	runCallGraphReport,
	type CallGraphReportProgressEvent
} from './run-call-graph-report.js';

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
	const root = mkdtempSync(join(tmpdir(), 'csaa-call-graph-report-'));
	temporaryRoots.push(root);
	json(root, 'package.json', {
		name: 'call-graph-report-fixture',
		private: true,
		type: 'module',
		workspaces: ['projects/*']
	});
	json(root, 'projects/app/package.json', {
		name: '@fixture/call-graph-report',
		private: true,
		type: 'module',
		version: '0.0.0'
	});
	json(root, 'projects/app/tsconfig.json', {
		compilerOptions: {
			module: 'NodeNext',
			moduleResolution: 'NodeNext',
			noEmit: true,
			noLib: true,
			strict: true,
			target: 'ES2022'
		},
		files: ['src/external.d.ts', 'src/library.ts', 'src/agent.ts']
	});
	write(
		root,
		'projects/app/src/external.d.ts',
		"declare module 'external-call' { export function externalCall(): void; }\n"
	);
	write(
		root,
		'projects/app/src/library.ts',
		[
			'export function local(value: number): number { return value + 1; }',
			'export class Worker { constructor(readonly value: number) {} }',
			'export function tag(_parts: unknown): string { return "tag"; }',
			''
		].join('\n')
	);
	write(
		root,
		'projects/app/src/agent.ts',
		[
			"import { externalCall } from 'external-call';",
			"import { local, tag, Worker } from './library.js';",
			'export const direct = local(1);',
			'externalCall();',
			'export const worker = new Worker(direct);',
			'export const tagged = tag`fixture`;',
			'eval("fixture");',
			''
		].join('\n')
	);
	write(root, 'bun.lock', 'fixture lock\n');
	return root;
}

function request(overrides: Partial<CallGraphReportRequest> = {}): CallGraphReportRequest {
	return {
		budgets: CALL_GRAPH_REPORT_SAFETY_CEILINGS,
		operationVersion: CALL_GRAPH_REPORT_OPERATION_VERSION,
		schemaVersion: CALL_GRAPH_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: ['projects/app/tsconfig.json'],
		...overrides
	};
}

function withGraphBudgets(
	base: CallGraphReportRequest,
	values: Partial<CallGraphReportRequest['budgets']['callGraph']>
): CallGraphReportRequest {
	return {
		...base,
		budgets: {
			...base.budgets,
			callGraph: { ...base.budgets.callGraph, ...values }
		}
	};
}

afterEach(() => {
	for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe('runCallGraphReport', () => {
	it('classifies graph budget, compatibility, and internal failures distinctly', () => {
		const diagnostic = (
			code: BoundedCallGraphBuildDiagnostic['code']
		): BoundedCallGraphBuildDiagnostic => ({
			code,
			message: code,
			path: null,
			phase: 'REQUEST'
		});
		expect(classifyCallGraphFailureState([diagnostic('BUDGET_EXCEEDED')])).toBe('resource-refused');
		for (const code of ['REQUEST_INVALID', 'SEMANTIC_CAPABILITY_UNAVAILABLE'] as const)
			expect(classifyCallGraphFailureState([diagnostic(code)]), code).toBe('incompatible');
		for (const code of [
			'DANGLING_SEMANTIC_REFERENCE',
			'GRAPH_VALIDATION_FAILED',
			'SEMANTIC_SNAPSHOT_ID_MISMATCH',
			'SUBJECT_ID_MISMATCH'
		] as const)
			expect(classifyCallGraphFailureState([diagnostic(code)]), code).toBe('failed');
	});

	it('rejects exact request shape, version, property, and predecessor-admission violations', () => {
		const root = fixture();
		const accessor = { ...request() };
		Object.defineProperty(accessor, 'operationVersion', {
			enumerable: true,
			get: () => CALL_GRAPH_REPORT_OPERATION_VERSION
		});
		const cases: ReadonlyArray<readonly [unknown, string, string]> = [
			[Object.assign(Object.create({ inherited: true }), request()), 'REQUEST_SHAPE_INVALID', '$'],
			[{ ...request(), unexpected: true }, 'REQUEST_SHAPE_INVALID', '$'],
			[accessor, 'REQUEST_SHAPE_INVALID', '$.operationVersion'],
			[
				{ ...request(), operationVersion: 'call-graph-report/0.0.0' },
				'REQUEST_OPERATION_INCOMPATIBLE',
				'$.operationVersion'
			],
			[
				{ ...request(), schemaVersion: 'call-graph-report-request/0.0.0' },
				'REQUEST_SCHEMA_INCOMPATIBLE',
				'$.schemaVersion'
			]
		];
		for (const [value, code, path] of cases) {
			const outcome = runCallGraphReport(value, { repositoryRoot: root });
			expect(outcome).toMatchObject({ code, outcome: 'unavailable', stage: 'REQUEST' });
			if (outcome.outcome !== 'unavailable') throw new Error(JSON.stringify(outcome));
			expect(outcome.diagnostics).toContainEqual(expect.objectContaining({ path }));
		}

		const predecessorRefusal = runCallGraphReport(
			{ ...request(), subjectProjectConfigPaths: [] },
			{ repositoryRoot: root }
		);
		expect(predecessorRefusal).toMatchObject({ outcome: 'unavailable', stage: 'REQUEST' });
	});

	it('uses stable elapsed telemetry when the monotonic clock is unavailable', () => {
		const root = fixture();
		const progress: CallGraphReportProgressEvent[] = [];
		const clock = vi.spyOn(process.hrtime, 'bigint').mockImplementation(() => {
			throw new Error('synthetic monotonic clock failure');
		});
		try {
			const outcome = runCallGraphReport(request(), {
				onProgress: (event) => void progress.push(event),
				repositoryRoot: root
			});
			expect(outcome.outcome).toBe('partial');
			expect(progress.length).toBeGreaterThan(0);
			expect(progress.every((event) => event.elapsedMs === 0)).toBe(true);
		} finally {
			clock.mockRestore();
		}
	});

	it('projects unavailable predecessor diagnostics and contains hostile adapter options', () => {
		const missingRoot = join(tmpdir(), 'csaa-call-graph-report-missing-root');
		rmSync(missingRoot, { force: true, recursive: true });
		const unavailable = runCallGraphReport(request(), { repositoryRoot: missingRoot });
		expect(unavailable).toMatchObject({
			outcome: 'unavailable',
			stage: 'PREDECESSOR_PIPELINE'
		});
		expect(unavailable.diagnostics).toEqual(
			expect.arrayContaining([expect.objectContaining({ source: 'PREDECESSOR_PIPELINE' })])
		);

		const hostileOptions = {} as { readonly repositoryRoot: string };
		Object.defineProperty(hostileOptions, 'repositoryRoot', {
			enumerable: true,
			get() {
				throw new Error('synthetic adapter option failure');
			}
		});
		const internal = runCallGraphReport(request(), hostileOptions);
		expect(internal).toMatchObject({
			code: 'INTERNAL_FAILURE',
			outcome: 'unavailable',
			stage: 'RESULT',
			state: 'failed'
		});
		expect(callGraphReportExitCode(internal)).toBe(4);
	});

	it(
		'returns one deterministic full selected graph with exact context identity and paired progress',
		{ timeout: 120_000 },
		() => {
			const root = fixture();
			const progress: CallGraphReportProgressEvent[] = [];
			const first = runCallGraphReport(request(), {
				onProgress: (event) => progress.push(event),
				repositoryRoot: root
			});
			expect(first.outcome).toBe('partial');
			expect(callGraphReportExitCode(first)).toBe(3);
			if (first.outcome !== 'partial') throw new Error(JSON.stringify(first));

			expect(first).toMatchObject({
				analysisAuthority: CALL_GRAPH_REPORT_AUTHORITY,
				authorityTransfer: CALL_GRAPH_REPORT_AUTHORITY_TRANSFER,
				gateEffect: CALL_GRAPH_REPORT_GATE_EFFECT,
				state: 'partial'
			});
			expect(first.result.capability).toEqual({
				architectureDiscovery: 'NOT_CLAIMED',
				changeImpact: 'NOT_CLAIMED',
				codeSlice: 'NOT_CLAIMED',
				fullJanCsaaCapability005CallGraph: 'NOT_CLAIMED',
				id: 'JAN-CSAA-CAP-005',
				semanticComparison: 'NOT_CLAIMED',
				semanticQuery: 'NOT_CLAIMED',
				status: 'PARTIAL'
			});
			expect(first.result.facadeNonclaims).toBe(CALL_GRAPH_REPORT_NONCLAIMS);
			expect(first.result.currentness).toMatchObject({
				scope: 'SELECTED_CAPTURED_SUBJECT_ONLY',
				state: 'CURRENT_FOR_CAPTURED_SUBJECT'
			});
			expect(first.result.evidence.callGraph).toMatchObject({
				capability: 'JAN-CSAA-CAP-005',
				health: 'PARTIAL'
			});
			expect(first.result.evidence.callGraph.coverage).toMatchObject({
				closure: 'OPEN',
				expectedCallSites: first.result.semanticSnapshotSummary.invocations,
				reconciles: true,
				wholeProgramReachability: 'NOT_CLAIMED'
			});
			expect(first.result.coverage.representedCallSites).toBe(
				first.result.semanticSnapshotSummary.invocations
			);
			expect(first.result.coverage.edges).toBe(first.result.evidence.callGraph.edges.length);
			expect(first.result.coverage.nodes).toBe(first.result.evidence.callGraph.nodes.length);
			expect(first.result.coverage.limitations).toBe(
				first.result.evidence.callGraph.limitations.length
			);
			expect(
				first.result.evidence.callGraph.nodes.filter((node) => node.kind === 'CALL_SITE')
			).toHaveLength(first.result.semanticSnapshotSummary.invocations);
			expect(progress.map((event) => [event.phase, event.state])).toEqual([
				['REQUEST_BIND', 'STARTED'],
				['REQUEST_BIND', 'COMPLETED'],
				['PREDECESSOR_PIPELINE', 'STARTED'],
				['PREDECESSOR_PIPELINE', 'COMPLETED'],
				['CALL_GRAPH', 'STARTED'],
				['CALL_GRAPH', 'COMPLETED'],
				['CURRENTNESS', 'STARTED'],
				['CURRENTNESS', 'COMPLETED'],
				['RESULT', 'STARTED'],
				['RESULT', 'COMPLETED']
			]);
			expect(
				progress.every((event) => event.nonclaims === CALL_GRAPH_REPORT_PROGRESS_NONCLAIMS)
			).toBe(true);

			const repeated = runCallGraphReport(request(), { repositoryRoot: root });
			expect(repeated).toEqual(first);
		}
	);

	it(
		'preserves the CAP-010 default while the successor capture explicitly supplies TS_TYPE',
		{ timeout: 120_000 },
		() => {
			const root = fixture();
			const predecessorRequest = {
				...request(),
				budgets: {
					maxResultBytes: request().budgets.maxResultBytes,
					projectContext: request().budgets.projectContext,
					semantic: request().budgets.semantic,
					subject: request().budgets.subject
				},
				operationVersion: 'jan-csaa-report-project-context/0.1.0',
				schemaVersion: 'jan-csaa-project-context-report-request/0.1.0'
			};
			const ordinary = captureProjectContextReportPipeline(predecessorRequest, {
				repositoryRoot: root
			});
			const enriched = captureProjectContextReportPipeline(predecessorRequest, {
				includeTypeCapability: true,
				repositoryRoot: root
			});
			if (ordinary.outcome !== 'captured' || enriched.outcome !== 'captured')
				throw new Error(JSON.stringify({ enriched, ordinary }));
			expect(
				ordinary.semanticSnapshot.capabilities.find((entry) => entry.capability === 'TS_TYPE')
			).toMatchObject({ state: 'UNSUPPORTED' });
			expect(
				enriched.semanticSnapshot.capabilities.find((entry) => entry.capability === 'TS_TYPE')
			).toMatchObject({ state: expect.not.stringMatching('UNSUPPORTED') });
		}
	);

	it(
		'admits exact graph populations and refuses every one-below population without evidence truncation',
		{ timeout: 180_000 },
		() => {
			const root = fixture();
			const baseline = runCallGraphReport(request(), { repositoryRoot: root });
			if (baseline.outcome !== 'partial') throw new Error(JSON.stringify(baseline));
			const exact = withGraphBudgets(request(), {
				maxEdges: baseline.result.coverage.edges,
				maxLimitations: baseline.result.coverage.limitations,
				maxNodes: baseline.result.coverage.nodes
			});
			const admitted = runCallGraphReport(exact, { repositoryRoot: root });
			expect(admitted.outcome).toBe('partial');
			if (admitted.outcome !== 'partial') throw new Error(JSON.stringify(admitted));
			expect(admitted.result.evidence.callGraph).toEqual(baseline.result.evidence.callGraph);

			for (const key of ['maxEdges', 'maxLimitations', 'maxNodes'] as const) {
				const refused = runCallGraphReport(
					withGraphBudgets(exact, { [key]: exact.budgets.callGraph[key] - 1 }),
					{ repositoryRoot: root }
				);
				expect(refused, key).toMatchObject({
					code: 'CALL_GRAPH_UNAVAILABLE',
					outcome: 'unavailable',
					stage: 'CALL_GRAPH',
					state: 'resource-refused'
				});
				if (refused.outcome !== 'unavailable') throw new Error(JSON.stringify(refused));
				expect(refused.diagnostics).toEqual(
					expect.arrayContaining([
						expect.objectContaining({
							code: 'BUDGET_EXCEEDED',
							path: `$.budgets.callGraph.${key}`
						})
					])
				);
				expect('result' in refused).toBe(false);
			}

			const workRefused = runCallGraphReport(
				withGraphBudgets(request(), { maxClassificationSteps: 1 }),
				{ repositoryRoot: root }
			);
			expect(workRefused).toMatchObject({
				code: 'CALL_GRAPH_UNAVAILABLE',
				state: 'resource-refused'
			});
		}
	);

	it(
		'enforces exact terminal UTF-8 bytes including LF and retains a small refusal envelope',
		{ timeout: 180_000 },
		() => {
			const root = fixture();
			let maximum = request().budgets.maxResultBytes;
			let admitted: ReturnType<typeof runCallGraphReport> | null = null;
			for (let attempt = 0; attempt < 8; attempt += 1) {
				const candidate = runCallGraphReport(
					{
						...request(),
						budgets: { ...request().budgets, maxResultBytes: maximum }
					},
					{ repositoryRoot: root }
				);
				if (candidate.outcome !== 'partial') throw new Error(JSON.stringify(candidate));
				const measured = Buffer.byteLength(`${canonicalSemanticJson(candidate)}\n`, 'utf8');
				admitted = candidate;
				if (measured === maximum) break;
				maximum = measured;
			}
			if (admitted?.outcome !== 'partial') throw new Error(JSON.stringify(admitted));
			expect(Buffer.byteLength(`${canonicalSemanticJson(admitted)}\n`, 'utf8')).toBe(maximum);

			const refused = runCallGraphReport(
				{
					...request(),
					budgets: { ...request().budgets, maxResultBytes: maximum - 1 }
				},
				{ repositoryRoot: root }
			);
			expect(refused).toMatchObject({
				code: 'RESULT_BUDGET_EXCEEDED',
				outcome: 'unavailable',
				state: 'resource-refused'
			});
			expect(Buffer.byteLength(`${canonicalSemanticJson(refused)}\n`, 'utf8')).toBeLessThan(
				maximum
			);
		}
	);

	it(
		'contains throwing and rejecting progress observers without changing terminal evidence',
		{ timeout: 120_000 },
		async () => {
			const root = fixture();
			const baseline = canonicalSemanticJson(
				runCallGraphReport(request(), { repositoryRoot: root })
			);
			const throwing = runCallGraphReport(request(), {
				onProgress: () => {
					throw new Error('Observer failure must remain out of band.');
				},
				repositoryRoot: root
			});
			const rejecting = runCallGraphReport(request(), {
				onProgress: () => Promise.reject(new Error('Rejected observer must remain out of band.')),
				repositoryRoot: root
			});
			expect(canonicalSemanticJson(throwing)).toBe(baseline);
			expect(canonicalSemanticJson(rejecting)).toBe(baseline);
			await new Promise<void>((resolve) => setImmediate(resolve));
		}
	);

	it(
		'reports selected-subject mutation without changing snapshot-bound graph evidence',
		{ timeout: 120_000 },
		() => {
			const root = fixture();
			let changed = false;
			const outcome = runCallGraphReport(request(), {
				onProgress: (event) => {
					if (!changed && event.phase === 'CURRENTNESS' && event.state === 'STARTED') {
						changed = true;
						write(root, 'projects/app/src/library.ts', 'export const changed = true;\n');
					}
				},
				repositoryRoot: root
			});
			expect(outcome.outcome).toBe('partial');
			if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
			expect(outcome.result.currentness.state).toBe('STALE');
			expect(outcome.result.currentness.changedPaths).toContain('projects/app/src/library.ts');
			expect(
				outcome.result.evidence.callGraph.nodes.every(
					(node) => node.epistemic.freshness === 'SNAPSHOT_BOUND'
				)
			).toBe(true);
		}
	);

	it(
		'retains capture-bound graph evidence when final subject currentness is unavailable',
		{ timeout: 120_000 },
		() => {
			const root = fixture();
			let removed = false;
			const outcome = runCallGraphReport(request(), {
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
			expect(outcome.result.evidence.callGraph.nodes.length).toBeGreaterThan(0);
		}
	);

	it('rejects hostile or over-ceiling request budgets and preserves exit-code classes', () => {
		const root = fixture();
		for (const value of [0, -0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
			const outcome = runCallGraphReport(withGraphBudgets(request(), { maxEdges: value }), {
				repositoryRoot: root
			});
			expect(outcome).toMatchObject({ outcome: 'unavailable', state: 'incompatible' });
			expect(callGraphReportExitCode(outcome)).toBe(2);
		}
		const overCeiling = runCallGraphReport(
			withGraphBudgets(request(), {
				maxEdges: CALL_GRAPH_REPORT_SAFETY_CEILINGS.callGraph.maxEdges + 1
			}),
			{ repositoryRoot: root }
		);
		expect(overCeiling).toMatchObject({ outcome: 'unavailable', state: 'resource-refused' });
		expect(callGraphReportExitCode(overCeiling)).toBe(3);

		const hostile = new Proxy(request(), {
			ownKeys() {
				throw new Error('trap');
			}
		});
		const rejected = runCallGraphReport(hostile, { repositoryRoot: root });
		expect(rejected).toMatchObject({ outcome: 'unavailable', state: 'incompatible' });
	});
});
