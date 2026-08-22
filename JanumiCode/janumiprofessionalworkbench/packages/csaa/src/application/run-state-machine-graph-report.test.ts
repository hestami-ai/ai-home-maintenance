import { Buffer } from 'node:buffer';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
	STATE_MACHINE_GRAPH_REPORT_AUTHORITY,
	STATE_MACHINE_GRAPH_REPORT_AUTHORITY_TRANSFER,
	STATE_MACHINE_GRAPH_REPORT_GATE_EFFECT,
	STATE_MACHINE_GRAPH_REPORT_NONCLAIMS,
	STATE_MACHINE_GRAPH_REPORT_OPERATION_VERSION,
	STATE_MACHINE_GRAPH_REPORT_REQUEST_SCHEMA_VERSION,
	STATE_MACHINE_GRAPH_REPORT_SAFETY_CEILINGS,
	type StateMachineGraphReportRequest
} from '../contracts/state-machine-graph-report.js';
import type {
	StateMachineGraphBuildDiagnostic,
	StateMachineTopologyObservationDiagnostic
} from '../contracts/state-machine-graph.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import {
	STATE_MACHINE_GRAPH_REPORT_PROGRESS_NONCLAIMS,
	classifyStateMachineGraphFailureState,
	classifyStateMachineObservationFailureState,
	runStateMachineGraphReport,
	stateMachineGraphReportExitCode,
	type StateMachineGraphReportProgressEvent
} from './run-state-machine-graph-report.js';

const SOURCE_PATH = 'packages/domain/src/transitions.data.ts';
const PROJECT_PATH = 'packages/domain/tsconfig.json';
const temporaryRoots: string[] = [];

const TRANSITIONS = `// GENERATED FILE — do not edit by hand.
export const STATE_MACHINES = {
  'Work.lifecycle': {
    name: 'Work.lifecycle',
    states: ['PROPOSED', 'EXECUTING', 'DONE'],
    initialState: 'PROPOSED',
    terminalStates: ['DONE'],
    transitions: [
      { from: 'PROPOSED', to: 'EXECUTING', trigger: 'start', guard: 'authorized', note: '§1' },
      { from: 'EXECUTING', to: 'DONE', trigger: 'finish' }
    ],
    illegal: [{ from: 'DONE', to: 'EXECUTING', reason: 'terminal' }],
    guarded: [
      { from: 'PROPOSED', to: 'EXECUTING', reason: 'requires authorization' },
      { from: 'PROPOSED', to: 'EXECUTING', reason: 'requires an approved plan' }
    ],
    sourceSection: 'fixture §1'
  },
  'Execution.status': {
    name: 'Execution.status',
    states: ['IDLE', 'RUNNING'],
    initialState: 'IDLE',
    terminalStates: [],
    transitions: [{ from: 'IDLE', to: 'RUNNING' }],
    illegal: [],
    guarded: []
  }
};
export const CROSS_AXIS_RULES = [
  { machine: 'Work.lifecycle', from: 'execution=SUCCEEDED', to: 'DONE', reason: 'separate axis' }
];
`;

function write(root: string, path: string, contents: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, contents, 'utf8');
}

function json(root: string, path: string, value: unknown): void {
	write(root, path, `${JSON.stringify(value, null, 2)}\n`);
}

function fixture(): string {
	const root = mkdtempSync(join(tmpdir(), 'csaa-state-machine-report-'));
	temporaryRoots.push(root);
	json(root, 'package.json', {
		name: 'state-machine-report-fixture',
		private: true,
		type: 'module',
		workspaces: ['packages/*']
	});
	json(root, 'packages/domain/package.json', {
		name: '@fixture/domain',
		private: true,
		type: 'module',
		version: '0.0.0'
	});
	json(root, PROJECT_PATH, {
		compilerOptions: {
			module: 'NodeNext',
			moduleResolution: 'NodeNext',
			noEmit: true,
			noLib: true,
			strict: true,
			target: 'ES2022'
		},
		files: ['src/transitions.data.ts']
	});
	write(root, SOURCE_PATH, TRANSITIONS);
	write(root, 'bun.lock', 'fixture lock\n');
	return root;
}

function request(
	overrides: Partial<StateMachineGraphReportRequest> = {}
): StateMachineGraphReportRequest {
	return {
		budgets: STATE_MACHINE_GRAPH_REPORT_SAFETY_CEILINGS,
		operationVersion: STATE_MACHINE_GRAPH_REPORT_OPERATION_VERSION,
		schemaVersion: STATE_MACHINE_GRAPH_REPORT_REQUEST_SCHEMA_VERSION,
		source: { logicalPath: SOURCE_PATH, projectConfigPath: PROJECT_PATH },
		subjectProjectConfigPaths: [PROJECT_PATH],
		...overrides
	};
}

function withGraphBudgets(
	base: StateMachineGraphReportRequest,
	values: Partial<StateMachineGraphReportRequest['budgets']['stateMachineGraph']>
): StateMachineGraphReportRequest {
	return {
		...base,
		budgets: {
			...base.budgets,
			stateMachineGraph: { ...base.budgets.stateMachineGraph, ...values }
		}
	};
}

function withObservationBudgets(
	base: StateMachineGraphReportRequest,
	values: Partial<StateMachineGraphReportRequest['budgets']['topologyObservation']>
): StateMachineGraphReportRequest {
	return {
		...base,
		budgets: {
			...base.budgets,
			topologyObservation: { ...base.budgets.topologyObservation, ...values }
		}
	};
}

function withSemanticBudgets(
	base: StateMachineGraphReportRequest,
	values: Partial<StateMachineGraphReportRequest['budgets']['semantic']>
): StateMachineGraphReportRequest {
	return {
		...base,
		budgets: {
			...base.budgets,
			semantic: { ...base.budgets.semantic, ...values }
		}
	};
}

afterEach(() => {
	for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe('runStateMachineGraphReport', () => {
	it('classifies observation and graph refusals without conflating budgets and failures', () => {
		const graphDiagnostic = (
			code: StateMachineGraphBuildDiagnostic['code']
		): StateMachineGraphBuildDiagnostic => ({ code, message: code, path: null, phase: 'REQUEST' });
		expect(classifyStateMachineGraphFailureState([graphDiagnostic('BUDGET_EXHAUSTED')])).toBe(
			'resource-refused'
		);
		expect(
			classifyStateMachineGraphFailureState([graphDiagnostic('SEMANTIC_CAPABILITY_UNAVAILABLE')])
		).toBe('incompatible');
		expect(
			classifyStateMachineGraphFailureState([graphDiagnostic('SOURCE_BINDING_MISMATCH')])
		).toBe('failed');

		const observationDiagnostic = (
			code: StateMachineTopologyObservationDiagnostic['code']
		): StateMachineTopologyObservationDiagnostic => ({
			code,
			message: code,
			path: null,
			phase: 'REQUEST'
		});
		expect(
			classifyStateMachineObservationFailureState([observationDiagnostic('BUDGET_EXHAUSTED')])
		).toBe('resource-refused');
		expect(
			classifyStateMachineObservationFailureState([
				observationDiagnostic('UNSUPPORTED_GENERATED_TABLE')
			])
		).toBe('incompatible');
		expect(
			classifyStateMachineObservationFailureState([
				observationDiagnostic('MALFORMED_GENERATED_TABLE')
			])
		).toBe('incompatible');
	});

	it(
		'returns deterministic complete selected topology evidence and a paired six-stage transcript',
		{ timeout: 120_000 },
		() => {
			const root = fixture();
			const progress: StateMachineGraphReportProgressEvent[] = [];
			const first = runStateMachineGraphReport(request(), {
				onProgress: (event) => progress.push(event),
				repositoryRoot: root
			});
			expect(first.outcome).toBe('partial');
			expect(stateMachineGraphReportExitCode(first)).toBe(3);
			if (first.outcome !== 'partial') throw new Error(JSON.stringify(first));

			expect(first).toMatchObject({
				analysisAuthority: STATE_MACHINE_GRAPH_REPORT_AUTHORITY,
				authorityTransfer: STATE_MACHINE_GRAPH_REPORT_AUTHORITY_TRANSFER,
				gateEffect: STATE_MACHINE_GRAPH_REPORT_GATE_EFFECT,
				state: 'partial'
			});
			expect(first.result.capability).toEqual({
				architectureDiscovery: 'NOT_CLAIMED',
				changeImpact: 'NOT_CLAIMED',
				codeSlice: 'NOT_CLAIMED',
				fullJanCsaaCapability027StateMachineAnalysis: 'NOT_CLAIMED',
				id: 'JAN-CSAA-CAP-027',
				registryStatus: 'IMPLEMENTATION_LOCAL_UNREGISTERED',
				semanticComparison: 'NOT_CLAIMED',
				semanticQuery: 'NOT_CLAIMED',
				scope: 'GENERATED_RUNTIME_TOPOLOGY_ONLY',
				status: 'PARTIAL',
				verifierAuthority: 'RETAINED_DELEGATED'
			});
			expect(first.result.facadeNonclaims).toBe(STATE_MACHINE_GRAPH_REPORT_NONCLAIMS);
			expect(first.result.currentness).toMatchObject({
				scope: 'SELECTED_CAPTURED_SUBJECT_ONLY',
				state: 'CURRENT_FOR_CAPTURED_SUBJECT'
			});
			const topology = first.result.evidence.topologyObservation;
			const graph = first.result.evidence.stateMachineGraph;
			expect(topology.coverage).toMatchObject({ machines: 2, reconciles: true, states: 5 });
			expect(graph).toMatchObject({
				capability: 'JAN-CSAA-CAP-027',
				closure: 'OPEN',
				health: 'PARTIAL',
				scope: 'GENERATED_RUNTIME_TOPOLOGY_ONLY'
			});
			expect(first.result.coverage.edges).toBe(graph.edges.length);
			expect(first.result.coverage.nodes).toBe(graph.nodes.length);
			expect(first.result.topologyCoverage).toEqual(topology.coverage);
			expect(progress.map((event) => [event.phase, event.state])).toEqual([
				['REQUEST_BIND', 'STARTED'],
				['REQUEST_BIND', 'COMPLETED'],
				['PREDECESSOR_PIPELINE', 'STARTED'],
				['PREDECESSOR_PIPELINE', 'COMPLETED'],
				['TOPOLOGY_OBSERVATION', 'STARTED'],
				['TOPOLOGY_OBSERVATION', 'COMPLETED'],
				['STATE_MACHINE_GRAPH', 'STARTED'],
				['STATE_MACHINE_GRAPH', 'COMPLETED'],
				['CURRENTNESS', 'STARTED'],
				['CURRENTNESS', 'COMPLETED'],
				['RESULT', 'STARTED'],
				['RESULT', 'COMPLETED']
			]);
			expect(
				progress.every((event) => event.nonclaims === STATE_MACHINE_GRAPH_REPORT_PROGRESS_NONCLAIMS)
			).toBe(true);
			expect(runStateMachineGraphReport(request(), { repositoryRoot: root })).toEqual(first);
		}
	);

	it('rejects unselected, absent, and noncanonical source selectors before evidence production', () => {
		const root = fixture();
		const unselected = runStateMachineGraphReport(
			request({ source: { logicalPath: SOURCE_PATH, projectConfigPath: 'other/tsconfig.json' } }),
			{ repositoryRoot: root }
		);
		expect(unselected).toMatchObject({
			code: 'SOURCE_PROJECT_NOT_SELECTED',
			stage: 'REQUEST',
			state: 'incompatible'
		});
		const absent = runStateMachineGraphReport(
			request({
				source: { logicalPath: 'packages/domain/src/absent.ts', projectConfigPath: PROJECT_PATH }
			}),
			{ repositoryRoot: root }
		);
		expect(absent).toMatchObject({
			code: 'SOURCE_BINDING_UNAVAILABLE',
			stage: 'TOPOLOGY_OBSERVATION',
			state: 'incompatible'
		});
		write(root, SOURCE_PATH, 'export const authored = true;\n');
		const authored = runStateMachineGraphReport(request(), { repositoryRoot: root });
		expect(authored).toMatchObject({
			code: 'SOURCE_BINDING_UNAVAILABLE',
			stage: 'TOPOLOGY_OBSERVATION',
			state: 'incompatible'
		});
		const traversal = runStateMachineGraphReport(
			request({ source: { logicalPath: '../outside.ts', projectConfigPath: PROJECT_PATH } }),
			{ repositoryRoot: root }
		);
		expect(traversal).toMatchObject({ code: 'REQUEST_PATH_INVALID', stage: 'REQUEST' });
	});

	it(
		'admits exact graph populations and refuses every one-below population without truncation',
		{ timeout: 180_000 },
		() => {
			const root = fixture();
			const baseline = runStateMachineGraphReport(request(), { repositoryRoot: root });
			if (baseline.outcome !== 'partial') throw new Error(JSON.stringify(baseline));
			const exact = withGraphBudgets(request(), {
				maxEdges: baseline.result.coverage.edges,
				maxNodes: baseline.result.coverage.nodes
			});
			expect(runStateMachineGraphReport(exact, { repositoryRoot: root }).outcome).toBe('partial');
			for (const key of ['maxEdges', 'maxNodes'] as const) {
				const refused = runStateMachineGraphReport(
					withGraphBudgets(exact, {
						[key]: exact.budgets.stateMachineGraph[key] - 1
					}),
					{ repositoryRoot: root }
				);
				expect(refused, key).toMatchObject({
					code: 'STATE_MACHINE_GRAPH_UNAVAILABLE',
					stage: 'STATE_MACHINE_GRAPH',
					state: 'resource-refused'
				});
				if (refused.outcome !== 'unavailable') throw new Error(JSON.stringify(refused));
				expect(refused.diagnostics).toEqual(
					expect.arrayContaining([
						expect.objectContaining({
							code: 'BUDGET_EXHAUSTED',
							path: '$.budgets.stateMachineGraph'
						})
					])
				);
				expect('result' in refused).toBe(false);
			}
		}
	);

	it('refuses a one-below topology population before graph construction', () => {
		const root = fixture();
		const refused = runStateMachineGraphReport(
			withObservationBudgets(request(), { maxMachines: 1 }),
			{ repositoryRoot: root }
		);
		expect(refused).toMatchObject({
			code: 'TOPOLOGY_OBSERVATION_UNAVAILABLE',
			stage: 'TOPOLOGY_OBSERVATION',
			state: 'resource-refused'
		});
		if (refused.outcome !== 'unavailable') throw new Error(JSON.stringify(refused));
		expect(refused.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'BUDGET_EXHAUSTED',
					path: '$source.STATE_MACHINES[1]'
				})
			])
		);
		expect('result' in refused).toBe(false);
	});

	it(
		'enforces exact terminal UTF-8 bytes including LF and keeps a smaller refusal envelope',
		{ timeout: 180_000 },
		() => {
			const root = fixture();
			let maximum = request().budgets.maxResultBytes;
			let admitted: ReturnType<typeof runStateMachineGraphReport> | null = null;
			for (let attempt = 0; attempt < 8; attempt += 1) {
				const candidate = runStateMachineGraphReport(
					{ ...request(), budgets: { ...request().budgets, maxResultBytes: maximum } },
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
			const refused = runStateMachineGraphReport(
				{ ...request(), budgets: { ...request().budgets, maxResultBytes: maximum - 1 } },
				{ repositoryRoot: root }
			);
			expect(refused).toMatchObject({
				code: 'RESULT_BUDGET_EXCEEDED',
				state: 'resource-refused'
			});
			expect(Buffer.byteLength(`${canonicalSemanticJson(refused)}\n`, 'utf8')).toBeLessThan(
				maximum
			);
		}
	);

	it(
		'contains progress observer failures and reports final selected-subject mutation as stale',
		{ timeout: 120_000 },
		async () => {
			const root = fixture();
			const baseline = canonicalSemanticJson(
				runStateMachineGraphReport(request(), { repositoryRoot: root })
			);
			expect(
				canonicalSemanticJson(
					runStateMachineGraphReport(request(), {
						onProgress: () => {
							throw new Error('contained');
						},
						repositoryRoot: root
					})
				)
			).toBe(baseline);
			expect(
				canonicalSemanticJson(
					runStateMachineGraphReport(request(), {
						onProgress: () => Promise.reject(new Error('contained')),
						repositoryRoot: root
					})
				)
			).toBe(baseline);
			await new Promise<void>((resolve) => setImmediate(resolve));

			let changed = false;
			const stale = runStateMachineGraphReport(request(), {
				onProgress: (event) => {
					if (!changed && event.phase === 'CURRENTNESS' && event.state === 'STARTED') {
						changed = true;
						write(root, SOURCE_PATH, `${TRANSITIONS}\n// changed after capture\n`);
					}
				},
				repositoryRoot: root
			});
			if (stale.outcome !== 'partial') throw new Error(JSON.stringify(stale));
			expect(stale.result.currentness.state).toBe('STALE');
			expect(stale.result.currentness.changedPaths).toContain(SOURCE_PATH);
			expect(stale.result.evidence.stateMachineGraph.nodes.length).toBeGreaterThan(0);
		}
	);

	it(
		'retains capture-bound topology evidence when final subject currentness is unavailable',
		{ timeout: 120_000 },
		() => {
			const root = fixture();
			let removed = false;
			const outcome = runStateMachineGraphReport(request(), {
				onProgress: (event) => {
					if (!removed && event.phase === 'CURRENTNESS' && event.state === 'STARTED') {
						removed = true;
						rmSync(join(root, PROJECT_PATH));
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
			expect(outcome.result.evidence.topologyObservation.machines.length).toBeGreaterThan(0);
			expect(outcome.result.evidence.stateMachineGraph.nodes.length).toBeGreaterThan(0);
		}
	);

	it('applies the admitted predecessor path policy to both exact source selectors', () => {
		const root = fixture();
		const maxPathCharacters = 256;
		const bounded = withSemanticBudgets(request(), { maxPathCharacters });
		const atLimit = runStateMachineGraphReport(
			{
				...bounded,
				source: { ...bounded.source, logicalPath: 'a'.repeat(maxPathCharacters) }
			},
			{ repositoryRoot: root }
		);
		expect(atLimit).toMatchObject({
			code: 'SOURCE_BINDING_UNAVAILABLE',
			stage: 'TOPOLOGY_OBSERVATION',
			state: 'incompatible'
		});

		const oneOver = runStateMachineGraphReport(
			{
				...bounded,
				source: { ...bounded.source, logicalPath: 'a'.repeat(maxPathCharacters + 1) }
			},
			{ repositoryRoot: root }
		);
		expect(oneOver).toMatchObject({
			code: 'REQUEST_PATH_BUDGET_EXCEEDED',
			stage: 'REQUEST',
			state: 'resource-refused'
		});
		if (oneOver.outcome !== 'unavailable') throw new Error(JSON.stringify(oneOver));
		expect(oneOver.diagnostics).toContainEqual(
			expect.objectContaining({ path: '$.source.logicalPath' })
		);

		const hostileSelectors = [
			['logicalPath', 'bad\u0000.ts'],
			['logicalPath', 'bad*.ts'],
			['logicalPath', 'bad?.ts'],
			['logicalPath', 'bad[ts'],
			['projectConfigPath', 'bad]ts'],
			['projectConfigPath', 'bad{ts'],
			['projectConfigPath', 'bad}ts']
		] as const;
		for (const [field, value] of hostileSelectors) {
			const base = request();
			const rejected = runStateMachineGraphReport(
				{ ...base, source: { ...base.source, [field]: value } },
				{ repositoryRoot: root }
			);
			expect(rejected, `${field}:${JSON.stringify(value)}`).toMatchObject({
				code: 'REQUEST_PATH_INVALID',
				stage: 'REQUEST',
				state: 'incompatible'
			});
			if (rejected.outcome !== 'unavailable') throw new Error(JSON.stringify(rejected));
			expect(rejected.diagnostics).toContainEqual(
				expect.objectContaining({ path: `$.source.${field}` })
			);
		}
	});

	it('rejects hostile and over-ceiling requests with stable exit classes', () => {
		const root = fixture();
		const overCeiling = runStateMachineGraphReport(
			withGraphBudgets(request(), {
				maxEdges: STATE_MACHINE_GRAPH_REPORT_SAFETY_CEILINGS.stateMachineGraph.maxEdges + 1
			}),
			{ repositoryRoot: root }
		);
		expect(overCeiling).toMatchObject({ state: 'resource-refused' });
		expect(stateMachineGraphReportExitCode(overCeiling)).toBe(3);
		const hostile = new Proxy(request(), {
			ownKeys() {
				throw new Error('trap');
			}
		});
		const rejected = runStateMachineGraphReport(hostile, { repositoryRoot: root });
		expect(rejected).toMatchObject({ state: 'incompatible' });
		expect(stateMachineGraphReportExitCode(rejected)).toBe(2);
	});
});
