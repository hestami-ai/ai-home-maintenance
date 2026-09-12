import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, sep } from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
	LOGICAL_GRAPH_COMPOSITION_REPORT_AUTHORITY,
	LOGICAL_GRAPH_COMPOSITION_REPORT_AUTHORITY_TRANSFER,
	LOGICAL_GRAPH_COMPOSITION_REPORT_GATE_EFFECT,
	LOGICAL_GRAPH_COMPOSITION_REPORT_NONCLAIMS,
	LOGICAL_GRAPH_COMPOSITION_REPORT_OPERATION_VERSION,
	LOGICAL_GRAPH_COMPOSITION_REPORT_REQUEST_SCHEMA_VERSION,
	LOGICAL_GRAPH_COMPOSITION_REPORT_SAFETY_CEILINGS,
	type LogicalGraphCompositionReportRequest
} from '../contracts/logical-graph-composition-report.js';
import {
	CALL_GRAPH_OPERATION_VERSION,
	CALL_GRAPH_REQUEST_SCHEMA_VERSION,
	type CallGraphSnapshot
} from '../contracts/call-graph.js';
import {
	MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
	MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
	type ModuleDependencyGraphSnapshot
} from '../contracts/graph.js';
import {
	LOGICAL_GRAPH_COMPOSITION_OPERATION_VERSION,
	LOGICAL_GRAPH_COMPOSITION_REQUEST_SCHEMA_VERSION,
	LOGICAL_GRAPH_COMPOSITION_SELECTION,
	type LogicalGraphCompositionBuildInputs,
	type LogicalGraphCompositionSnapshot
} from '../contracts/logical-graph-composition.js';
import {
	PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS,
	type ProjectContextReportRequest
} from '../contracts/project-context-report.js';
import { buildBoundedCallGraph } from '../graph/build-call-graph.js';
import { buildLogicalGraphComposition } from '../graph/build-logical-graph-composition.js';
import { buildModuleDependencyGraph } from '../graph/build-module-dependency-graph.js';
import { canonicalSemanticJsonWitness } from '../semantic/canonical.js';
import { verifyFrozenSubject } from '../subject/freshness.js';
import {
	captureProjectContextReportPipeline,
	type CaptureProjectContextReportPipelineOptions,
	type ProjectContextReportPipelineCapture,
	type ProjectContextReportPipelineOutcome
} from './run-project-context-report.js';
import {
	LOGICAL_GRAPH_COMPOSITION_REPORT_PROGRESS_NONCLAIMS,
	admitLogicalGraphCompositionReportRequest,
	logicalGraphCompositionReportExitCode,
	runLogicalGraphCompositionReport,
	runLogicalGraphCompositionReportWithDependencies,
	type LogicalGraphCompositionReportProgressEvent,
	type LogicalGraphCompositionReportRuntimeDependencies
} from './run-logical-graph-composition-report.js';

let repositoryRoot = '';
let captured: ProjectContextReportPipelineCapture;

function write(root: string, path: string, contents: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, contents, 'utf8');
}

function json(root: string, path: string, value: unknown): void {
	write(root, path, `${JSON.stringify(value, null, 2)}\n`);
}

function createFixture(): string {
	const root = mkdtempSync(join(tmpdir(), 'csaa-logical-composition-report-'));
	json(root, 'package.json', {
		name: 'logical-composition-report-fixture',
		private: true,
		type: 'module',
		workspaces: ['projects/*']
	});
	json(root, 'projects/app/package.json', {
		name: '@fixture/logical-composition-report',
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

function budgets(): LogicalGraphCompositionReportRequest['budgets'] {
	return structuredClone(LOGICAL_GRAPH_COMPOSITION_REPORT_SAFETY_CEILINGS);
}

function request(
	overrides: Partial<LogicalGraphCompositionReportRequest> = {}
): LogicalGraphCompositionReportRequest {
	return {
		budgets: budgets(),
		operationVersion: LOGICAL_GRAPH_COMPOSITION_REPORT_OPERATION_VERSION,
		schemaVersion: LOGICAL_GRAPH_COMPOSITION_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: ['projects/app/tsconfig.json'],
		...overrides
	};
}

function predecessorRequest(
	reportRequest: LogicalGraphCompositionReportRequest
): ProjectContextReportRequest {
	return {
		budgets: {
			maxResultBytes: Math.min(
				reportRequest.budgets.maxResultBytes,
				PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS.maxResultBytes
			),
			projectContext: {
				...reportRequest.budgets.projectContext,
				maxInputRecords: Math.min(
					reportRequest.budgets.projectContext.maxInputRecords,
					PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS.projectContext.maxInputRecords
				)
			},
			semantic: reportRequest.budgets.semantic,
			subject: reportRequest.budgets.subject
		},
		operationVersion: 'jan-csaa-report-project-context/0.1.0',
		schemaVersion: 'jan-csaa-project-context-report-request/0.1.0',
		subjectProjectConfigPaths: reportRequest.subjectProjectConfigPaths
	};
}

function effectiveCaptureRequest(
	requestValue: unknown,
	options: CaptureProjectContextReportPipelineOptions
): ProjectContextReportRequest {
	const predecessor = requestValue as ProjectContextReportRequest;
	return {
		...predecessor,
		budgets: {
			...predecessor.budgets,
			projectContext: options.projectContextBudgets ?? predecessor.budgets.projectContext
		}
	};
}

function dependencies(
	overrides: Partial<LogicalGraphCompositionReportRuntimeDependencies> = {}
): LogicalGraphCompositionReportRuntimeDependencies {
	return {
		buildCallGraph: buildBoundedCallGraph,
		buildComposition: buildLogicalGraphComposition,
		buildModuleGraph: buildModuleDependencyGraph,
		captureProjectContext: (requestValue, options) => ({
			...captured,
			request: effectiveCaptureRequest(requestValue, options)
		}),
		verifySubject: verifyFrozenSubject,
		...overrides
	};
}

beforeAll(() => {
	repositoryRoot = createFixture();
	const outcome = captureProjectContextReportPipeline(predecessorRequest(request()), {
		includeTypeCapability: true,
		projectContextBudgets: request().budgets.projectContext,
		repositoryRoot
	});
	if (outcome.outcome !== 'captured') throw new Error(JSON.stringify(outcome));
	captured = outcome;
}, 120_000);

afterAll(() => {
	if (repositoryRoot !== '') rmSync(repositoryRoot, { force: true, recursive: true });
});

describe('runLogicalGraphCompositionReport', () => {
	it('admits one exact request and rejects hostile exact-shape and version variants', () => {
		const exact = request();
		expect(admitLogicalGraphCompositionReportRequest(exact)).toEqual({
			outcome: 'admitted',
			request: exact
		});

		const customPrototype = Object.assign(Object.create({ inherited: true }) as object, request());
		const invalidBudget = request();
		const invalidZeroBudget = request();
		(
			invalidZeroBudget.budgets.logicalGraphComposition as unknown as {
				maxConflictRecords: number;
			}
		).maxConflictRecords = -0;
		const candidates: readonly (readonly [unknown, string, string])[] = [
			[customPrototype, 'REQUEST_SHAPE_INVALID', '$'],
			[{ ...request(), extra: true }, 'REQUEST_SHAPE_INVALID', '$'],
			[
				{
					...request(),
					operationVersion: 'jan-csaa-report-logical-graph-composition/unsupported'
				},
				'REQUEST_OPERATION_INCOMPATIBLE',
				'$.operationVersion'
			],
			[
				{
					...request(),
					schemaVersion: 'jan-csaa-logical-graph-composition-report-request/unsupported'
				},
				'REQUEST_SCHEMA_INCOMPATIBLE',
				'$.schemaVersion'
			],
			[
				{
					...invalidBudget,
					budgets: { ...invalidBudget.budgets, maxResultBytes: 0 }
				},
				'REQUEST_BUDGET_INVALID',
				'$.budgets.maxResultBytes'
			],
			[
				invalidZeroBudget,
				'REQUEST_BUDGET_INVALID',
				'$.budgets.logicalGraphComposition.maxConflictRecords'
			]
		];
		for (const [candidate, code, path] of candidates)
			expect(admitLogicalGraphCompositionReportRequest(candidate)).toMatchObject({
				code,
				outcome: 'rejected',
				path,
				state: 'incompatible'
			});
	});

	it('returns one exact same-subject PARTIAL/OPEN composition with paired deferred progress', async () => {
		const progress: LogicalGraphCompositionReportProgressEvent[] = [];
		const capture = vi.fn(dependencies().captureProjectContext);
		const outcome = await runLogicalGraphCompositionReportWithDependencies(
			request(),
			{ onProgress: (event) => progress.push(event), repositoryRoot },
			dependencies({ captureProjectContext: capture })
		);
		expect(outcome.outcome, JSON.stringify(outcome)).toBe('partial');
		expect(logicalGraphCompositionReportExitCode(outcome)).toBe(3);
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));

		expect(outcome).toMatchObject({
			analysisAuthority: LOGICAL_GRAPH_COMPOSITION_REPORT_AUTHORITY,
			authorityTransfer: LOGICAL_GRAPH_COMPOSITION_REPORT_AUTHORITY_TRANSFER,
			gateEffect: LOGICAL_GRAPH_COMPOSITION_REPORT_GATE_EFFECT,
			state: 'partial'
		});
		expect(outcome.result.capability).toMatchObject({
			architectureDiscovery: 'NOT_CLAIMED',
			changeImpact: 'NOT_CLAIMED',
			codeSlice: 'NOT_CLAIMED',
			fullJanCsaaCapability009GraphComposition: 'NOT_CLAIMED',
			graphAuthority: 'NONE',
			id: 'JAN-CSAA-CAP-009',
			semanticComparison: 'NOT_CLAIMED',
			semanticQuery: 'NOT_CLAIMED',
			status: 'PARTIAL'
		});
		expect(outcome.result.facadeNonclaims).toBe(LOGICAL_GRAPH_COMPOSITION_REPORT_NONCLAIMS);
		expect(outcome.result.coverage).toMatchObject({
			closure: 'OPEN',
			conflicts: 0,
			health: 'PARTIAL',
			layers: 2,
			unmatchedSources: 0
		});
		expect(outcome.result.currentness.state).toBe('CURRENT_FOR_CAPTURED_SUBJECT');
		expect(outcome.result.evidence.composition.subjectId).toBe(outcome.subject.subjectId);
		expect(outcome.result.evidence.callGraph.semanticSnapshotId).toBe(
			outcome.result.semanticSnapshotSummary.id
		);
		expect(outcome.result.evidence.moduleDependencyGraph.semanticSnapshotId).toBe(
			outcome.result.semanticSnapshotSummary.id
		);
		expect(outcome.result.evidence.composition.crossLinks).toHaveLength(
			outcome.result.semanticSnapshotSummary.sources
		);
		expect(Object.isFrozen(outcome.result.evidence)).toBe(true);
		expect(Object.isFrozen(outcome.result.evidence.composition.crossLinks)).toBe(true);
		expect(capture).toHaveBeenCalledTimes(1);
		expect(capture.mock.calls[0]?.[0]).toEqual(predecessorRequest(request()));
		expect(capture.mock.calls[0]?.[1]).toEqual({
			includeTypeCapability: true,
			projectContextBudgets: request().budgets.projectContext,
			repositoryRoot
		});
		expect(progress.map((event) => [event.phase, event.state])).toEqual([
			['REQUEST_BIND', 'STARTED'],
			['REQUEST_BIND', 'COMPLETED'],
			['PREDECESSOR_PIPELINE', 'STARTED'],
			['PREDECESSOR_PIPELINE', 'COMPLETED'],
			['MODULE_DEPENDENCY_GRAPH', 'STARTED'],
			['MODULE_DEPENDENCY_GRAPH', 'COMPLETED'],
			['CALL_GRAPH', 'STARTED'],
			['CALL_GRAPH', 'COMPLETED'],
			['LOGICAL_GRAPH_COMPOSITION', 'STARTED'],
			['LOGICAL_GRAPH_COMPOSITION', 'COMPLETED'],
			['CURRENTNESS', 'STARTED'],
			['CURRENTNESS', 'COMPLETED'],
			['RESULT', 'STARTED'],
			['RESULT', 'COMPLETED']
		]);
		expect(
			progress.every(
				(event) =>
					event.deliverySemantics === 'DEFERRED_UNTIL_TERMINAL_EVIDENCE' &&
					event.nonclaims === LOGICAL_GRAPH_COMPOSITION_REPORT_PROGRESS_NONCLAIMS
			)
		).toBe(true);
		const resultObservation = progress
			.flatMap((event) => event.observations)
			.find((entry) => entry.metric === 'RESULT_BYTES');
		expect(resultObservation?.value).toBe(canonicalSemanticJsonWitness(outcome).bytes + 1);
	});

	it('runs the public default-dependency path on one bounded explicit-project subject', async () => {
		const outcome = await runLogicalGraphCompositionReport(request(), {
			repositoryRoot: `${repositoryRoot}${sep}.`
		});
		expect(outcome).toMatchObject({
			analysisAuthority: 'NONE',
			gateEffect: 'NONE',
			outcome: 'partial',
			result: {
				coverage: { closure: 'OPEN', health: 'PARTIAL', layers: 2 },
				currentness: { state: 'CURRENT_FOR_CAPTURED_SUBJECT' }
			}
		});
	});

	it('classifies missing and non-directory trusted repository roots as unavailable', async () => {
		for (const unavailableRoot of [
			`${repositoryRoot}${sep}missing-repository-root`,
			join(repositoryRoot, 'package.json')
		]) {
			const outcome = await runLogicalGraphCompositionReport(request(), {
				repositoryRoot: unavailableRoot
			});
			expect(outcome).toMatchObject({
				code: 'REPOSITORY_ROOT_UNAVAILABLE',
				outcome: 'unavailable',
				request: request(),
				stage: 'REQUEST',
				state: 'failed'
			});
		}
	});

	it('rejects null, relative, and accessor repository-root options without invoking accessors', async () => {
		let touched = false;
		const accessorOptions = Object.defineProperty({}, 'repositoryRoot', {
			enumerable: true,
			get() {
				touched = true;
				throw new Error('must not run');
			}
		});
		for (const options of [null, { repositoryRoot: 'relative/path' }, accessorOptions]) {
			const outcome = await runLogicalGraphCompositionReportWithDependencies(
				request(),
				options as unknown as Parameters<
					typeof runLogicalGraphCompositionReportWithDependencies
				>[1],
				dependencies()
			);
			expect(outcome).toMatchObject({
				code: 'REQUEST_INVALID',
				outcome: 'unavailable',
				stage: 'REQUEST',
				state: 'incompatible'
			});
			expect(logicalGraphCompositionReportExitCode(outcome)).toBe(2);
		}
		expect(touched).toBe(false);
	});

	it('projects a trusted unavailable predecessor and rejects a non-canonical injected envelope', async () => {
		const missingRequest = request({
			subjectProjectConfigPaths: ['projects/missing/tsconfig.json']
		});
		const trusted = await runLogicalGraphCompositionReport(missingRequest, { repositoryRoot });
		expect(trusted).toMatchObject({
			outcome: 'unavailable',
			stage: 'PREDECESSOR_PIPELINE'
		});
		expect(trusted.diagnostics.length).toBeGreaterThan(0);

		const injected = await runLogicalGraphCompositionReportWithDependencies(
			missingRequest,
			{ repositoryRoot },
			dependencies({
				captureProjectContext: ((requestValue, options) => {
					const outcome = captureProjectContextReportPipeline(requestValue, options);
					if (outcome.outcome === 'captured') throw new Error('expected unavailable predecessor');
					return {
						...outcome,
						forgedEnvelopeValue: 1n
					} as unknown as ProjectContextReportPipelineOutcome;
				}) as LogicalGraphCompositionReportRuntimeDependencies['captureProjectContext']
			})
		);
		expect(injected).toMatchObject({
			code: 'PREDECESSOR_VALIDATION_FAILED',
			outcome: 'unavailable',
			stage: 'PREDECESSOR_PIPELINE',
			state: 'failed'
		});
		expect(JSON.stringify(injected)).not.toContain('forgedEnvelopeValue');
	});

	it('refuses a lower-than-observed call-edge budget at the call producer', async () => {
		const baseline = await runLogicalGraphCompositionReportWithDependencies(
			request(),
			{ repositoryRoot },
			dependencies()
		);
		if (baseline.outcome !== 'partial') throw new Error(JSON.stringify(baseline));
		const maxEdges = baseline.result.evidence.callGraph.edges.length - 1;
		expect(maxEdges).toBeGreaterThan(0);
		const admitted = request();
		const outcome = await runLogicalGraphCompositionReportWithDependencies(
			request({
				budgets: {
					...admitted.budgets,
					callGraph: { ...admitted.budgets.callGraph, maxEdges }
				}
			}),
			{ repositoryRoot },
			dependencies()
		);
		expect(outcome).toMatchObject({
			code: 'CALL_GRAPH_VALIDATION_FAILED',
			outcome: 'unavailable',
			stage: 'CALL_GRAPH',
			state: 'resource-refused'
		});
	});

	it.each([
		['module population', 'module', 'MODULE_DEPENDENCY_GRAPH_BUDGET_EXCEEDED'],
		['composition links', 'composition', 'LOGICAL_GRAPH_COMPOSITION_VALIDATION_FAILED']
	] as const)('refuses an admitted lower-than-observed %s budget', async (_label, kind, code) => {
		const candidate = request();
		if (kind === 'module')
			(candidate.budgets.moduleDependencyGraph as { maxNodes: number }).maxNodes = 1;
		else (candidate.budgets.logicalGraphComposition as { maxLinks: number }).maxLinks = 1;
		const outcome = await runLogicalGraphCompositionReportWithDependencies(
			candidate,
			{ repositoryRoot },
			dependencies()
		);
		expect(outcome).toMatchObject({
			code,
			outcome: 'unavailable',
			stage: kind === 'module' ? 'MODULE_DEPENDENCY_GRAPH' : 'LOGICAL_GRAPH_COMPOSITION',
			state: 'resource-refused'
		});
	});

	it('refuses every safety ceiling one above before capture, including the exact-zero fields', async () => {
		const visit = (
			value: unknown,
			path: readonly string[] = [],
			result: Array<{ readonly path: readonly string[]; readonly value: number }> = []
		) => {
			if (typeof value === 'number') result.push({ path, value });
			else if (value !== null && typeof value === 'object')
				for (const [key, child] of Object.entries(value)) visit(child, [...path, key], result);
			return result;
		};
		for (const leaf of visit(LOGICAL_GRAPH_COMPOSITION_REPORT_SAFETY_CEILINGS)) {
			const candidate = request();
			let cursor = candidate.budgets as unknown as Record<string, unknown>;
			for (const key of leaf.path.slice(0, -1)) cursor = cursor[key] as Record<string, unknown>;
			cursor[leaf.path.at(-1)!] = leaf.value + 1;
			const capture = vi.fn(() => {
				throw new Error('capture must not run');
			});
			const outcome = await runLogicalGraphCompositionReportWithDependencies(
				candidate,
				{ repositoryRoot },
				dependencies({
					captureProjectContext:
						capture as unknown as LogicalGraphCompositionReportRuntimeDependencies['captureProjectContext']
				})
			);
			expect(outcome, leaf.path.join('.')).toMatchObject({
				code: 'REQUEST_BUDGET_EXCEEDS_SAFETY_CEILING',
				outcome: 'unavailable',
				stage: 'REQUEST',
				state: 'resource-refused'
			});
			expect(capture, leaf.path.join('.')).not.toHaveBeenCalled();
		}
	});

	it('rejects hostile proxy and accessor requests without invoking accessors', async () => {
		const proxied = await runLogicalGraphCompositionReportWithDependencies(
			new Proxy(request(), {}),
			{ repositoryRoot },
			dependencies()
		);
		expect(proxied).toMatchObject({
			code: 'REQUEST_SHAPE_INVALID',
			outcome: 'unavailable',
			stage: 'REQUEST',
			state: 'incompatible'
		});

		let touched = false;
		const accessor = { ...request() } as Record<string, unknown>;
		Object.defineProperty(accessor, 'budgets', {
			enumerable: true,
			get() {
				touched = true;
				throw new Error('must not run');
			}
		});
		const rejected = await runLogicalGraphCompositionReportWithDependencies(
			accessor,
			{ repositoryRoot },
			dependencies()
		);
		expect(touched).toBe(false);
		expect(rejected).toMatchObject({
			code: 'REQUEST_SHAPE_INVALID',
			outcome: 'unavailable',
			stage: 'REQUEST',
			state: 'incompatible'
		});
	});

	it('rejects a cloned predecessor that lost its subject and semantic capabilities', async () => {
		const forged = structuredClone(captured);
		(forged.frozenSubject.descriptor as unknown as Record<string, unknown>).forgedSecret =
			'forged subject descriptor secret';
		const outcome = await runLogicalGraphCompositionReportWithDependencies(
			request(),
			{ repositoryRoot },
			dependencies({ captureProjectContext: () => forged })
		);
		expect(outcome).toMatchObject({
			code: 'PREDECESSOR_VALIDATION_FAILED',
			outcome: 'unavailable',
			stage: 'PREDECESSOR_PIPELINE',
			state: 'failed'
		});
		expect(outcome).not.toHaveProperty('subject');
		expect(JSON.stringify(outcome)).not.toContain('forged subject descriptor secret');
	});

	it('rejects and does not disclose a forged injected predecessor failure envelope', async () => {
		const forgedMessage = `forged predecessor leak: ${repositoryRoot}`;
		const forged = {
			code: 'FORGED_PREDECESSOR_UNAVAILABLE',
			diagnostics: [
				{
					code: 'FORGED_PREDECESSOR_UNAVAILABLE',
					message: forgedMessage,
					path: repositoryRoot,
					phase: 'FORGED',
					severity: 'ERROR',
					source: 'SUBJECT'
				}
			],
			outcome: 'unavailable',
			stage: 'RESULT',
			state: 'failed'
		} as unknown as ProjectContextReportPipelineOutcome;
		const outcome = await runLogicalGraphCompositionReportWithDependencies(
			request(),
			{ repositoryRoot },
			dependencies({ captureProjectContext: () => forged })
		);
		expect(outcome).toMatchObject({
			code: 'PREDECESSOR_VALIDATION_FAILED',
			outcome: 'unavailable',
			stage: 'PREDECESSOR_PIPELINE',
			state: 'failed'
		});
		expect(JSON.stringify(outcome)).not.toContain('FORGED_PREDECESSOR_UNAVAILABLE');
		expect(JSON.stringify(outcome)).not.toContain(repositoryRoot);
	});

	it.each(['diagnostics', 'stage-outcomes'] as const)(
		'rejects a branded predecessor with forged %s through trusted metadata replay',
		async (kind) => {
			const forgedDiagnosticMessage = `forged predecessor diagnostic: ${repositoryRoot}`;
			const outcome = await runLogicalGraphCompositionReportWithDependencies(
				request(),
				{ repositoryRoot },
				dependencies({
					captureProjectContext: (requestValue, options) => ({
						...captured,
						repositoryRoot:
							kind === 'diagnostics' ? join(repositoryRoot, 'attacker-root') : repositoryRoot,
						...(kind === 'diagnostics'
							? {
									diagnostics: [
										...captured.diagnostics,
										{
											code: 'FORGED_PREDECESSOR_DIAGNOSTIC',
											message: forgedDiagnosticMessage,
											path: repositoryRoot,
											phase: 'VALIDATE',
											severity: 'WARNING' as const,
											source: 'PROJECT_CONTEXT' as const
										}
									]
								}
							: {
									predecessorStageOutcomes: {
										...captured.predecessorStageOutcomes,
										projectContext: {
											...captured.predecessorStageOutcomes.projectContext,
											diagnosticCodes: [
												...captured.predecessorStageOutcomes.projectContext.diagnosticCodes,
												'FORGED_PREDECESSOR_DIAGNOSTIC'
											]
										}
									}
								}),
						request: effectiveCaptureRequest(requestValue, options)
					})
				})
			);
			expect(outcome).toMatchObject({
				code: 'PREDECESSOR_VALIDATION_FAILED',
				outcome: 'unavailable',
				stage: 'PREDECESSOR_PIPELINE',
				state: 'failed'
			});
			expect(outcome).not.toHaveProperty('subject');
			expect(JSON.stringify(outcome)).not.toContain('FORGED_PREDECESSOR_DIAGNOSTIC');
			expect(JSON.stringify(outcome)).not.toContain('forged predecessor diagnostic');
			expect(JSON.stringify(outcome)).not.toContain(repositoryRoot);
		}
	);

	it('contains a non-canonical injected predecessor metadata value during trusted replay', async () => {
		const outcome = await runLogicalGraphCompositionReportWithDependencies(
			request(),
			{ repositoryRoot },
			dependencies({
				captureProjectContext: (requestValue, options) => ({
					...captured,
					diagnostics: [
						...captured.diagnostics,
						{
							code: 'FORGED_NON_CANONICAL_DIAGNOSTIC',
							message: 1n,
							path: null,
							phase: 'VALIDATE',
							severity: 'ERROR',
							source: 'PROJECT_CONTEXT'
						}
					] as unknown as ProjectContextReportPipelineCapture['diagnostics'],
					request: effectiveCaptureRequest(requestValue, options)
				})
			})
		);
		expect(outcome).toMatchObject({
			code: 'PREDECESSOR_VALIDATION_FAILED',
			outcome: 'unavailable',
			stage: 'PREDECESSOR_PIPELINE',
			state: 'failed'
		});
		expect(JSON.stringify(outcome)).not.toContain('FORGED_NON_CANONICAL_DIAGNOSTIC');
	});

	it.each(['module', 'call', 'composition'] as const)(
		'rejects structurally invalid forged %s producer output',
		async (kind) => {
			let overrides: Partial<LogicalGraphCompositionReportRuntimeDependencies>;
			if (kind === 'module') {
				overrides = {
					buildModuleGraph: ((...args: Parameters<typeof buildModuleDependencyGraph>) => {
						const outcome = buildModuleDependencyGraph(...args);
						if (outcome.outcome === 'unavailable') return outcome;
						const graph = structuredClone(outcome.graph);
						(graph as { subjectId: string }).subjectId = 'f'.repeat(64);
						return { ...outcome, graph };
					}) as typeof buildModuleDependencyGraph
				};
			} else if (kind === 'call') {
				overrides = {
					buildCallGraph: ((...args: Parameters<typeof buildBoundedCallGraph>) => {
						const outcome = buildBoundedCallGraph(...args);
						if (outcome.outcome === 'unavailable') return outcome;
						const graph = structuredClone(outcome.graph);
						(graph as { subjectId: string }).subjectId = 'e'.repeat(64);
						return { ...outcome, graph };
					}) as typeof buildBoundedCallGraph
				};
			} else {
				overrides = {
					buildComposition: ((...args: Parameters<typeof buildLogicalGraphComposition>) => {
						const outcome = buildLogicalGraphComposition(...args);
						if (outcome.outcome === 'unavailable') return outcome;
						const composition = structuredClone(outcome.composition);
						(composition as { subjectId: string }).subjectId = 'd'.repeat(64);
						return { ...outcome, composition };
					}) as typeof buildLogicalGraphComposition
				};
			}
			const outcome = await runLogicalGraphCompositionReportWithDependencies(
				request(),
				{ repositoryRoot },
				dependencies(overrides)
			);
			expect(outcome).toMatchObject({
				code:
					kind === 'module'
						? 'MODULE_DEPENDENCY_GRAPH_VALIDATION_FAILED'
						: kind === 'call'
							? 'CALL_GRAPH_VALIDATION_FAILED'
							: 'LOGICAL_GRAPH_COMPOSITION_VALIDATION_FAILED',
				outcome: 'unavailable',
				stage:
					kind === 'module'
						? 'MODULE_DEPENDENCY_GRAPH'
						: kind === 'call'
							? 'CALL_GRAPH'
							: 'LOGICAL_GRAPH_COMPOSITION',
				state: 'failed'
			});
		}
	);

	it('rejects an injected unavailable module producer envelope before graph inspection', async () => {
		const outcome = await runLogicalGraphCompositionReportWithDependencies(
			request(),
			{ repositoryRoot },
			dependencies({
				buildModuleGraph: (() => ({
					diagnostics: [
						{
							code: 'REQUEST_INVALID',
							message: 'forged unavailable module producer envelope',
							path: null,
							phase: 'REQUEST'
						}
					],
					outcome: 'unavailable'
				})) as typeof buildModuleDependencyGraph
			})
		);
		expect(outcome).toMatchObject({
			code: 'MODULE_DEPENDENCY_GRAPH_VALIDATION_FAILED',
			outcome: 'unavailable',
			stage: 'MODULE_DEPENDENCY_GRAPH',
			state: 'failed'
		});
		expect(JSON.stringify(outcome)).not.toContain('forged unavailable module producer envelope');
	});

	it('rejects direct composition closure invariant drift before trusted replay', async () => {
		const outcome = await runLogicalGraphCompositionReportWithDependencies(
			request(),
			{ repositoryRoot },
			dependencies({
				buildComposition: ((...args: Parameters<typeof buildLogicalGraphComposition>) => {
					const built = buildLogicalGraphComposition(...args);
					if (built.outcome === 'unavailable') return built;
					return {
						...built,
						composition: { ...built.composition, health: 'COMPLETE' }
					} as unknown as ReturnType<typeof buildLogicalGraphComposition>;
				}) as typeof buildLogicalGraphComposition
			})
		);
		expect(outcome).toMatchObject({
			code: 'LOGICAL_GRAPH_COMPOSITION_VALIDATION_FAILED',
			outcome: 'unavailable',
			stage: 'LOGICAL_GRAPH_COMPOSITION',
			state: 'failed'
		});
	});

	it.each(['module', 'call', 'composition'] as const)(
		'rejects validation-passing forged %s producer diagnostics through trusted replay',
		async (kind) => {
			const forgedDiagnosticMessage = `forged replay-only diagnostic: ${repositoryRoot}`;
			let overrides: Partial<LogicalGraphCompositionReportRuntimeDependencies>;
			if (kind === 'module') {
				overrides = {
					buildModuleGraph: ((...args: Parameters<typeof buildModuleDependencyGraph>) => {
						const outcome = buildModuleDependencyGraph(...args);
						if (outcome.outcome === 'unavailable') return outcome;
						return {
							...outcome,
							diagnostics: [
								...outcome.diagnostics,
								{
									code: 'GRAPH_PARTIAL' as const,
									message: forgedDiagnosticMessage,
									path: repositoryRoot,
									phase: 'VALIDATE' as const
								}
							]
						};
					}) as typeof buildModuleDependencyGraph
				};
			} else if (kind === 'call') {
				overrides = {
					buildCallGraph: ((...args: Parameters<typeof buildBoundedCallGraph>) => {
						const outcome = buildBoundedCallGraph(...args);
						if (outcome.outcome === 'unavailable') return outcome;
						return {
							...outcome,
							diagnostics: [
								...outcome.diagnostics,
								{
									code: 'BUDGET_EXCEEDED' as const,
									message: forgedDiagnosticMessage,
									path: repositoryRoot,
									phase: 'VALIDATE' as const
								}
							]
						};
					}) as typeof buildBoundedCallGraph
				};
			} else {
				overrides = {
					buildComposition: ((...args: Parameters<typeof buildLogicalGraphComposition>) => {
						const outcome = buildLogicalGraphComposition(...args);
						if (outcome.outcome === 'unavailable') return outcome;
						return {
							...outcome,
							diagnostics: [
								...outcome.diagnostics,
								{
									code: 'REQUEST_INVALID' as const,
									message: forgedDiagnosticMessage,
									path: repositoryRoot,
									phase: 'VALIDATE' as const
								}
							]
						};
					}) as typeof buildLogicalGraphComposition
				};
			}
			const outcome = await runLogicalGraphCompositionReportWithDependencies(
				request(),
				{ repositoryRoot },
				dependencies(overrides)
			);
			expect(outcome).toMatchObject({
				code:
					kind === 'module'
						? 'MODULE_DEPENDENCY_GRAPH_VALIDATION_FAILED'
						: kind === 'call'
							? 'CALL_GRAPH_VALIDATION_FAILED'
							: 'LOGICAL_GRAPH_COMPOSITION_VALIDATION_FAILED',
				outcome: 'unavailable',
				state: 'failed'
			});
			expect(JSON.stringify(outcome)).not.toContain('forged replay-only diagnostic');
			expect(JSON.stringify(outcome)).not.toContain(repositoryRoot);
		}
	);

	it.each(['module', 'call', 'composition'] as const)(
		'contains non-canonical forged %s producer envelopes during trusted replay',
		async (kind) => {
			let overrides: Partial<LogicalGraphCompositionReportRuntimeDependencies>;
			if (kind === 'module') {
				overrides = {
					buildModuleGraph: ((...args: Parameters<typeof buildModuleDependencyGraph>) => ({
						...buildModuleDependencyGraph(...args),
						forgedEnvelopeValue: 1n
					})) as typeof buildModuleDependencyGraph
				};
			} else if (kind === 'call') {
				overrides = {
					buildCallGraph: ((...args: Parameters<typeof buildBoundedCallGraph>) => ({
						...buildBoundedCallGraph(...args),
						forgedEnvelopeValue: 1n
					})) as typeof buildBoundedCallGraph
				};
			} else {
				overrides = {
					buildComposition: ((...args: Parameters<typeof buildLogicalGraphComposition>) => ({
						...buildLogicalGraphComposition(...args),
						forgedEnvelopeValue: 1n
					})) as typeof buildLogicalGraphComposition
				};
			}
			const outcome = await runLogicalGraphCompositionReportWithDependencies(
				request(),
				{ repositoryRoot },
				dependencies(overrides)
			);
			expect(outcome).toMatchObject({
				code:
					kind === 'module'
						? 'MODULE_DEPENDENCY_GRAPH_VALIDATION_FAILED'
						: kind === 'call'
							? 'CALL_GRAPH_VALIDATION_FAILED'
							: 'LOGICAL_GRAPH_COMPOSITION_VALIDATION_FAILED',
				outcome: 'unavailable',
				state: 'failed'
			});
			expect(JSON.stringify(outcome)).not.toContain('forgedEnvelopeValue');
		}
	);

	it('trusted-replays injected producer wrappers and remains deterministic', async () => {
		const moduleProducer = vi.fn((...args: Parameters<typeof buildModuleDependencyGraph>) =>
			buildModuleDependencyGraph(...args)
		);
		const callProducer = vi.fn((...args: Parameters<typeof buildBoundedCallGraph>) =>
			buildBoundedCallGraph(...args)
		);
		const compositionProducer = vi.fn((...args: Parameters<typeof buildLogicalGraphComposition>) =>
			buildLogicalGraphComposition(...args)
		);
		const wrapped = dependencies({
			buildCallGraph: callProducer as typeof buildBoundedCallGraph,
			buildComposition: compositionProducer as typeof buildLogicalGraphComposition,
			buildModuleGraph: moduleProducer as typeof buildModuleDependencyGraph
		});
		const first = await runLogicalGraphCompositionReportWithDependencies(
			request(),
			{ repositoryRoot },
			wrapped
		);
		const second = await runLogicalGraphCompositionReportWithDependencies(
			request(),
			{ repositoryRoot },
			wrapped
		);
		expect(first.outcome).toBe('partial');
		expect(second).toEqual(first);
		expect(moduleProducer).toHaveBeenCalledTimes(2);
		expect(moduleProducer.mock.calls[0]?.[0]).toEqual({
			operationVersion: MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
			schemaVersion: MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
			semanticSnapshotId: captured.semanticSnapshot.id,
			subjectId: captured.frozenSubject.descriptor.subjectId
		});
		expect(callProducer).toHaveBeenCalledTimes(2);
		expect(callProducer.mock.calls[0]?.[0]).toEqual({
			operationVersion: CALL_GRAPH_OPERATION_VERSION,
			schemaVersion: CALL_GRAPH_REQUEST_SCHEMA_VERSION,
			semanticSnapshotId: captured.semanticSnapshot.id,
			subjectId: captured.frozenSubject.descriptor.subjectId
		});
		expect(callProducer.mock.calls[0]?.[2]).toEqual({ budgets: request().budgets.callGraph });
		expect(compositionProducer).toHaveBeenCalledTimes(2);
		const compositionInputs = compositionProducer.mock.calls[0]?.[0] as
			LogicalGraphCompositionBuildInputs | undefined;
		expect(compositionInputs?.request).toMatchObject({
			budgets: request().budgets.logicalGraphComposition,
			operationVersion: LOGICAL_GRAPH_COMPOSITION_OPERATION_VERSION,
			schemaVersion: LOGICAL_GRAPH_COMPOSITION_REQUEST_SCHEMA_VERSION,
			selection: LOGICAL_GRAPH_COMPOSITION_SELECTION,
			semanticSnapshotId: captured.semanticSnapshot.id,
			subjectId: captured.frozenSubject.descriptor.subjectId
		});
		expect(
			compositionInputs?.request.sourceLayers.map(({ ordinal, role }) => [ordinal, role])
		).toEqual([
			[0, 'MODULE_DEPENDENCY'],
			[1, 'CALL']
		]);
		expect(compositionInputs?.moduleDependencyGraph.subjectId).toBe(
			captured.frozenSubject.descriptor.subjectId
		);
		expect(compositionInputs?.callGraph.subjectId).toBe(
			captured.frozenSubject.descriptor.subjectId
		);
	});

	it('detaches and freezes producer evidence before currentness and deferred callbacks', async () => {
		let moduleCandidate: ModuleDependencyGraphSnapshot | undefined;
		let callCandidate: CallGraphSnapshot | undefined;
		let compositionCandidate: LogicalGraphCompositionSnapshot | undefined;
		const trace: string[] = [];
		const injected = dependencies({
			buildModuleGraph: ((...args: Parameters<typeof buildModuleDependencyGraph>) => {
				trace.push('module');
				const outcome = structuredClone(buildModuleDependencyGraph(...args));
				if (outcome.outcome !== 'unavailable') moduleCandidate = outcome.graph;
				return outcome;
			}) as typeof buildModuleDependencyGraph,
			buildCallGraph: ((...args: Parameters<typeof buildBoundedCallGraph>) => {
				trace.push('call');
				const outcome = structuredClone(buildBoundedCallGraph(...args));
				if (outcome.outcome !== 'unavailable') callCandidate = outcome.graph;
				return outcome;
			}) as typeof buildBoundedCallGraph,
			buildComposition: ((...args: Parameters<typeof buildLogicalGraphComposition>) => {
				trace.push('composition');
				const outcome = structuredClone(buildLogicalGraphComposition(...args));
				if (outcome.outcome !== 'unavailable') compositionCandidate = outcome.composition;
				return outcome;
			}) as typeof buildLogicalGraphComposition,
			verifySubject: (() => {
				trace.push('currentness');
				if (moduleCandidate !== undefined)
					(moduleCandidate.nodes as unknown as unknown[]).length = 0;
				if (callCandidate !== undefined) (callCandidate.nodes as unknown as unknown[]).length = 0;
				if (compositionCandidate !== undefined)
					(compositionCandidate.crossLinks as unknown as unknown[]).length = 0;
				return { changedPaths: [], diagnostics: [], state: 'CURRENT' as const };
			}) as typeof verifyFrozenSubject
		});
		const outcome = await runLogicalGraphCompositionReportWithDependencies(
			request(),
			{
				onProgress: () => {
					trace.push('progress');
					if (moduleCandidate !== undefined)
						(moduleCandidate.edges as unknown as unknown[]).length = 0;
					if (callCandidate !== undefined) (callCandidate.edges as unknown as unknown[]).length = 0;
				},
				repositoryRoot
			},
			injected
		);
		expect(outcome.outcome).toBe('partial');
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		expect(outcome.result.evidence.moduleDependencyGraph.nodes.length).toBeGreaterThan(0);
		expect(outcome.result.evidence.callGraph.nodes.length).toBeGreaterThan(0);
		expect(outcome.result.evidence.composition.crossLinks.length).toBeGreaterThan(0);
		expect(trace.slice(0, 4)).toEqual(['module', 'call', 'composition', 'currentness']);
		expect(trace[4]).toBe('progress');
		expect(Object.isFrozen(outcome.result.evidence.callGraph.nodes)).toBe(true);
	});

	it('reports stale final currentness without changing graph evidence or authority', async () => {
		const changedPath = join(repositoryRoot, 'projects/app/src/agent.ts');
		const original = readFileSync(changedPath, 'utf8');
		try {
			const outcome = await runLogicalGraphCompositionReportWithDependencies(
				request(),
				{ repositoryRoot },
				dependencies({
					buildComposition: ((...args: Parameters<typeof buildLogicalGraphComposition>) => {
						const result = buildLogicalGraphComposition(...args);
						writeFileSync(changedPath, `${original}// changed after capture\n`, 'utf8');
						return result;
					}) as typeof buildLogicalGraphComposition
				})
			);
			expect(outcome).toMatchObject({
				analysisAuthority: 'NONE',
				gateEffect: 'NONE',
				outcome: 'partial',
				result: {
					currentness: {
						changedPaths: ['projects/app/src/agent.ts'],
						state: 'STALE'
					}
				}
			});
		} finally {
			writeFileSync(changedPath, original, 'utf8');
		}
	});

	it('fails forged injected currentness closed without disclosing hostile changed paths', async () => {
		const outcome = await runLogicalGraphCompositionReportWithDependencies(
			request(),
			{ repositoryRoot },
			dependencies({
				verifySubject: (() => ({
					changedPaths: [repositoryRoot],
					diagnostics: [],
					state: 'CURRENT' as const
				})) as typeof verifyFrozenSubject
			})
		);
		expect(outcome).toMatchObject({
			analysisAuthority: 'NONE',
			gateEffect: 'NONE',
			outcome: 'partial',
			result: {
				currentness: {
					changedPaths: [],
					diagnosticCodes: ['SUBJECT_CHANGED_DURING_RESOLUTION'],
					state: 'UNAVAILABLE'
				}
			}
		});
		expect(JSON.stringify(outcome)).not.toContain(repositoryRoot);
	});

	it('contains a throwing final currentness verifier and completes the currentness stage', async () => {
		const progress: LogicalGraphCompositionReportProgressEvent[] = [];
		const outcome = await runLogicalGraphCompositionReportWithDependencies(
			request(),
			{ onProgress: (event) => progress.push(event), repositoryRoot },
			dependencies({
				verifySubject: (() => {
					throw new Error(`currentness failure: ${repositoryRoot}`);
				}) as typeof verifyFrozenSubject
			})
		);
		expect(outcome).toMatchObject({
			outcome: 'partial',
			result: {
				currentness: {
					changedPaths: [],
					diagnosticCodes: ['SUBJECT_CHANGED_DURING_RESOLUTION'],
					state: 'UNAVAILABLE'
				}
			}
		});
		expect(progress.filter((event) => event.phase === 'CURRENTNESS')).toMatchObject([
			{ state: 'STARTED' },
			{ detailCode: 'UNAVAILABLE', state: 'COMPLETED' }
		]);
		expect(JSON.stringify(outcome)).not.toContain('currentness failure');
		expect(JSON.stringify(outcome)).not.toContain(repositoryRoot);
	});

	it('counts the terminal LF exactly and refuses one byte below the complete report', async () => {
		const withMax = (maxResultBytes: number) => {
			const base = request();
			return runLogicalGraphCompositionReportWithDependencies(
				{ ...base, budgets: { ...base.budgets, maxResultBytes } },
				{ repositoryRoot },
				dependencies()
			);
		};
		let exact = LOGICAL_GRAPH_COMPOSITION_REPORT_SAFETY_CEILINGS.maxResultBytes;
		for (let attempt = 0; attempt < 8; attempt += 1) {
			const candidate = await withMax(exact);
			expect(candidate.outcome).toBe('partial');
			const measured = canonicalSemanticJsonWitness(candidate).bytes + 1;
			if (measured === exact) break;
			exact = measured;
		}
		const exactOutcome = await withMax(exact);
		expect(exactOutcome.outcome).toBe('partial');
		expect(canonicalSemanticJsonWitness(exactOutcome).bytes + 1).toBe(exact);
		const refused = await withMax(exact - 1);
		expect(refused).toMatchObject({
			code: 'RESULT_BUDGET_EXCEEDED',
			outcome: 'unavailable',
			stage: 'RESULT',
			state: 'resource-refused'
		});
	});

	it('contains throwing and rejecting progress sinks without changing deterministic evidence', async () => {
		const baseline = await runLogicalGraphCompositionReportWithDependencies(
			request(),
			{ repositoryRoot },
			dependencies()
		);
		const throwing = await runLogicalGraphCompositionReportWithDependencies(
			request(),
			{
				onProgress() {
					throw new Error('sink failure');
				},
				repositoryRoot
			},
			dependencies()
		);
		const rejecting = await runLogicalGraphCompositionReportWithDependencies(
			request(),
			{ onProgress: () => Promise.reject(new Error('sink rejection')), repositoryRoot },
			dependencies()
		);
		expect(throwing).toEqual(baseline);
		expect(rejecting).toEqual(baseline);
	});

	it('fails a throwing predecessor closed while pairing the active deferred progress stage', async () => {
		const progress: LogicalGraphCompositionReportProgressEvent[] = [];
		const outcome = await runLogicalGraphCompositionReportWithDependencies(
			request(),
			{ onProgress: (event) => progress.push(event), repositoryRoot },
			dependencies({
				captureProjectContext: () => {
					throw new Error(`predecessor failure: ${repositoryRoot}`);
				}
			})
		);
		expect(outcome).toMatchObject({
			code: 'INTERNAL_FAILURE',
			outcome: 'unavailable',
			stage: 'RESULT',
			state: 'failed'
		});
		expect(logicalGraphCompositionReportExitCode(outcome)).toBe(4);
		expect(progress.map((event) => [event.phase, event.state, event.detailCode])).toEqual([
			['REQUEST_BIND', 'STARTED', null],
			['REQUEST_BIND', 'COMPLETED', 'REQUEST_ADMITTED'],
			['PREDECESSOR_PIPELINE', 'STARTED', null],
			['PREDECESSOR_PIPELINE', 'FAILED', 'INTERNAL_FAILURE']
		]);
		expect(JSON.stringify(outcome)).not.toContain('predecessor failure');
		expect(JSON.stringify(outcome)).not.toContain(repositoryRoot);
	});
});
