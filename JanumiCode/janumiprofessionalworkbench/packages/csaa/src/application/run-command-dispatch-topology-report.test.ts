import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
	COMMAND_DISPATCH_TOPOLOGY_REPORT_EXECUTION_SELECTION,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_NONCLAIMS,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_OPERATION_VERSION,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_PROJECT_CONFIG_PATHS,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_REQUEST_SCHEMA_VERSION,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_SAFETY_CEILINGS,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_SCOPE,
	type CommandDispatchTopologyReportRequest
} from '../contracts/command-dispatch-topology-report.js';
import {
	COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_EXECUTION,
	COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_INTEGRATION,
	COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_PATH,
	COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_VERIFIER_AUTHORITY,
	type CommandDispatchTopologyEdge,
	type CommandDispatchTopologyIndexEntry,
	type CommandDispatchTopologySnapshot
} from '../contracts/command-dispatch-topology.js';
import type { CommandHandlerGraphReportRequest } from '../contracts/command-handler-graph-report.js';
import { buildCommandDispatchTopology } from '../graph/build-command-dispatch-topology.js';
import {
	commandDispatchTopologyContentDigest,
	commandDispatchTopologyEdgeId
} from '../graph/command-dispatch-topology-canonical.js';
import { createCommandDispatchTopologyReportFixture } from '../graph/command-dispatch-topology-fixture.test-support.js';
import { selectJpwbCommandDispatchTopology } from '../graph/build-command-dispatch-topology.js';
import { validateCommandDispatchTopology } from '../graph/validate-command-dispatch-topology.js';
import { validateCommandHandlerGraph } from '../graph/validate-command-handler-graph.js';
import { validateArrowCommandCensusObservation } from '../providers/jpwb-arrow-command-census/validate-arrow-command-census.js';
import { verifyFrozenSubject } from '../subject/freshness.js';
import type {
	CommandHandlerGraphReportPipelineCapture,
	CommandHandlerGraphReportProgressEvent
} from './run-command-handler-graph-report.js';
import {
	admitCommandDispatchTopologyReportRequest,
	commandDispatchTopologyReportExitCode,
	runCommandDispatchTopologyReport,
	runCommandDispatchTopologyReportWithDependencies,
	type CommandDispatchTopologyReportProgressEvent,
	type CommandDispatchTopologyReportRuntimeDependencies
} from './run-command-dispatch-topology-report.js';

const cleanups: Array<() => void> = [];

function canonicalEdgeId(edge: CommandDispatchTopologyEdge) {
	return commandDispatchTopologyEdgeId({
		graphId: edge.graphId,
		inferenceBasis: edge.inferenceBasis,
		registeredCommandNames: edge.registeredCommandNames,
		relationCode: edge.relationCode,
		relationKind: edge.relationKind,
		source: edge.source,
		target: edge.target
	});
}

const topologyInternalForges = [
	{
		forge(graph: CommandDispatchTopologySnapshot) {
			Object.assign(graph.nodes[0]!, { attribution: 'FORGED_RUNTIME_FACT' });
		},
		name: 'node attribution'
	},
	{
		forge(graph: CommandDispatchTopologySnapshot) {
			Object.assign(graph.layers[0]!, { method: 'FORGED_METHOD' });
		},
		name: 'layer method'
	},
	{
		forge(graph: CommandDispatchTopologySnapshot) {
			const edge = graph.edges[0]!;
			Object.assign(edge.source, { nodeId: 'graph-node:forged' });
			Object.assign(edge, { id: canonicalEdgeId(edge) });
			Object.assign(graph.layers[1]!, { edgeIds: [edge.id] });
			Object.assign(graph.forwardIndex[0]!, { edgeIds: [edge.id] });
			Object.assign(graph.reverseIndex[0]!, { edgeIds: [edge.id] });
		},
		name: 'edge source with canonical identity and indexes'
	},
	{
		forge(graph: CommandDispatchTopologySnapshot) {
			const edge = structuredClone(graph.edges[0]!);
			Object.assign(edge.inferenceBasis, {
				rationale: `${edge.inferenceBasis.rationale} FORGED_DUPLICATE`
			});
			Object.assign(edge, { id: canonicalEdgeId(edge) });
			const edges = graph.edges as unknown as CommandDispatchTopologyEdge[];
			edges.push(edge);
			Object.assign(graph.layers[1]!, { edgeIds: edges.map((item) => item.id) });
			Object.assign(graph.forwardIndex[0]!, { edgeIds: edges.map((item) => item.id) });
			(graph.reverseIndex as unknown as CommandDispatchTopologyIndexEntry[]).push({
				...structuredClone(graph.reverseIndex[0]!),
				edgeIds: [edge.id]
			});
			const coverage = {
				...graph.coverage,
				candidateHandlerTargetEdges: edges.length,
				referencedHandlerTargets: edges.length
			};
			Object.assign(graph, { coverage });
			for (const layer of graph.layers)
				Object.assign(layer, { coverage: structuredClone(coverage) });
		},
		name: 'duplicate handler target and reverse index entry'
	}
] satisfies readonly {
	readonly forge: (graph: CommandDispatchTopologySnapshot) => void;
	readonly name: string;
}[];

function request(
	overrides: Partial<CommandDispatchTopologyReportRequest> = {}
): CommandDispatchTopologyReportRequest {
	return {
		budgets: structuredClone(COMMAND_DISPATCH_TOPOLOGY_REPORT_SAFETY_CEILINGS),
		executionSelection: COMMAND_DISPATCH_TOPOLOGY_REPORT_EXECUTION_SELECTION,
		operationVersion: COMMAND_DISPATCH_TOPOLOGY_REPORT_OPERATION_VERSION,
		schemaVersion: COMMAND_DISPATCH_TOPOLOGY_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: [...COMMAND_DISPATCH_TOPOLOGY_REPORT_PROJECT_CONFIG_PATHS],
		...overrides
	};
}

function fixtureRequest(
	fixture: ReturnType<typeof createCommandDispatchTopologyReportFixture>,
	overrides: Partial<CommandDispatchTopologyReportRequest> = {}
): CommandDispatchTopologyReportRequest {
	const baseline = request();
	return request({
		budgets: {
			...baseline.budgets,
			commandHandlerGraph: fixture.commandHandlerGraph.budgets,
			observation: fixture.observation.budgets,
			semantic: fixture.snapshot.budgets,
			subject: fixture.subject.request.budgets
		},
		...overrides
	});
}

function handlerProgress(): CommandHandlerGraphReportProgressEvent {
	return {
		adapterProgress: null,
		deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK',
		detailCode: 'SYNTHETIC_PREDECESSOR',
		elapsedMs: 0,
		kind: 'REPORT_STAGE',
		nonclaims: {
			dwp004Dwp005OrDwp006Completion: 'NOT_CLAIMED',
			facadeNonclaims: []
		} as unknown as CommandHandlerGraphReportProgressEvent['nonclaims'],
		observations: [],
		operationVersion: 'jan-csaa-report-command-handler-graph/0.1.0',
		phase: 'COMMAND_HANDLER_GRAPH',
		protocolRole: 'PRELIMINARY_TYPESCRIPT_COMMAND_HANDLER_GRAPH_REPORT_TELEMETRY',
		reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY',
		schemaVersion: 'jan-csaa-command-handler-graph-report-progress/0.1.0',
		sequence: 1,
		stage: 'COMMAND_HANDLER_GRAPH',
		state: 'COMPLETED',
		wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET'
	};
}

function syntheticDependencies() {
	const fixture = createCommandDispatchTopologyReportFixture();
	cleanups.push(fixture.cleanup);
	const calls: string[] = [];
	const observations: {
		additionalArtifacts?: readonly string[];
		predecessorRequest?: unknown;
		topologyRequest?: unknown;
	} = {};
	const predecessorStageOutcomes: CommandHandlerGraphReportPipelineCapture['predecessorStageOutcomes'] =
		{
			artifactSet: { diagnosticCodes: [], outcome: 'complete' },
			commandHandlerGraph: { diagnosticCodes: ['GRAPH_PARTIAL'], outcome: 'partial' },
			predecessorPipeline: {
				semanticSnapshot: { diagnosticCodes: [], outcome: 'complete' },
				subject: { completeness: 'COMPLETE', diagnosticCodes: [], outcome: 'resolved' }
			},
			retainedCensus: { diagnosticCodes: [], outcome: 'complete' }
		};
	const dependencies: CommandDispatchTopologyReportRuntimeDependencies = {
		buildTopology(topologyRequest, snapshot, handlerGraph, observation, subject) {
			calls.push('buildTopology');
			observations.topologyRequest = topologyRequest;
			return buildCommandDispatchTopology(
				topologyRequest,
				snapshot,
				handlerGraph,
				observation,
				subject
			);
		},
		async captureHandler(predecessorRequest, options) {
			calls.push('captureHandler');
			observations.additionalArtifacts = options.additionalArtifacts;
			observations.predecessorRequest = predecessorRequest;
			options.onProgress?.(handlerProgress());
			return {
				artifactSet: fixture.arrowArtifactSet,
				commandHandlerGraph: fixture.commandHandlerGraph,
				diagnostics: [],
				frozenSubject: fixture.subject,
				observation: fixture.observation,
				outcome: 'captured',
				predecessorStageOutcomes,
				repositoryRoot: fixture.root,
				request: predecessorRequest as CommandHandlerGraphReportRequest,
				semanticSnapshot: fixture.snapshot
			};
		},
		selectCommandBus(snapshot) {
			calls.push('selectCommandBus');
			return selectJpwbCommandDispatchTopology(snapshot);
		},
		validateHandlerGraph: validateCommandHandlerGraph,
		validateObservation: validateArrowCommandCensusObservation,
		validateTopology: validateCommandDispatchTopology,
		verifySubject(subject, options) {
			calls.push('verifySubject');
			return verifyFrozenSubject(subject, options);
		}
	};
	return { calls, dependencies, fixture, observations };
}

afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
});

describe('runCommandDispatchTopologyReport', { timeout: 60_000 }, () => {
	it('admits only the exact acknowledged fixed closure and bounded data request', () => {
		expect(admitCommandDispatchTopologyReportRequest(request())).toMatchObject({
			outcome: 'admitted'
		});
		expect(
			admitCommandDispatchTopologyReportRequest({ ...request(), unexpected: true })
		).toMatchObject({ code: 'REQUEST_SHAPE_INVALID', outcome: 'rejected' });
		expect(
			admitCommandDispatchTopologyReportRequest({
				...request(),
				executionSelection: 'RUN_RETAINED_VERIFIER'
			})
		).toMatchObject({ code: 'RETAINED_EXECUTION_NOT_ACKNOWLEDGED', outcome: 'rejected' });
		expect(
			admitCommandDispatchTopologyReportRequest({
				...request(),
				subjectProjectConfigPaths: COMMAND_DISPATCH_TOPOLOGY_REPORT_PROJECT_CONFIG_PATHS.slice(
					0,
					-1
				)
			})
		).toMatchObject({ code: 'REQUIRED_PROJECT_CLOSURE_MISMATCH', outcome: 'rejected' });

		const excessive = request();
		expect(
			admitCommandDispatchTopologyReportRequest({
				...excessive,
				budgets: {
					...excessive.budgets,
					commandDispatchTopology: {
						...excessive.budgets.commandDispatchTopology,
						maxEdges:
							COMMAND_DISPATCH_TOPOLOGY_REPORT_SAFETY_CEILINGS.commandDispatchTopology.maxEdges + 1
					}
				}
			})
		).toMatchObject({
			code: 'REQUEST_BUDGET_EXCEEDS_SAFETY_CEILING',
			outcome: 'rejected',
			state: 'resource-refused'
		});
		expect(admitCommandDispatchTopologyReportRequest(new Proxy(request(), {}))).toMatchObject({
			code: 'REQUEST_SHAPE_INVALID',
			outcome: 'rejected'
		});
		const accessor = request() as unknown as Record<string, unknown>;
		Object.defineProperty(accessor, 'schemaVersion', {
			enumerable: true,
			get: () => COMMAND_DISPATCH_TOPOLOGY_REPORT_REQUEST_SCHEMA_VERSION
		});
		expect(admitCommandDispatchTopologyReportRequest(accessor)).toMatchObject({
			code: 'REQUEST_SHAPE_INVALID',
			outcome: 'rejected'
		});
	});

	it('rejects non-data request records and invalid scalar versions through the public facade', async () => {
		const nonEnumerable = { ...request() };
		Object.defineProperty(nonEnumerable, 'schemaVersion', {
			enumerable: false,
			value: COMMAND_DISPATCH_TOPOLOGY_REPORT_REQUEST_SCHEMA_VERSION
		});
		for (const malformed of [new Date(), nonEnumerable]) {
			expect(admitCommandDispatchTopologyReportRequest(malformed)).toMatchObject({
				code: 'REQUEST_SHAPE_INVALID',
				outcome: 'rejected'
			});
		}
		expect(
			admitCommandDispatchTopologyReportRequest({
				...request(),
				operationVersion: 'unsupported'
			})
		).toMatchObject({ code: 'REQUEST_OPERATION_INCOMPATIBLE', outcome: 'rejected' });
		expect(
			admitCommandDispatchTopologyReportRequest({
				...request(),
				schemaVersion: 'unsupported'
			})
		).toMatchObject({ code: 'REQUEST_SCHEMA_INCOMPATIBLE', outcome: 'rejected' });
		const base = request();
		expect(
			admitCommandDispatchTopologyReportRequest({
				...base,
				budgets: { ...base.budgets, maxResultBytes: 0 }
			})
		).toMatchObject({ code: 'REQUEST_BUDGET_INVALID', outcome: 'rejected' });

		const publicOutcome = await runCommandDispatchTopologyReport(null, {
			repositoryRoot: 'unused-for-rejected-request'
		});
		expect(publicOutcome).toMatchObject({
			code: 'REQUEST_SHAPE_INVALID',
			outcome: 'unavailable',
			stage: 'REQUEST'
		});
		expect(commandDispatchTopologyReportExitCode(publicOutcome)).toBe(2);
	});

	it('emits full same-subject dispatch evidence and complete progress framing', async () => {
		const { calls, dependencies, fixture, observations } = syntheticDependencies();
		const progress: CommandDispatchTopologyReportProgressEvent[] = [];
		const outcome = await runCommandDispatchTopologyReportWithDependencies(
			fixtureRequest(fixture),
			{ onProgress: (event) => progress.push(event), repositoryRoot: fixture.root },
			dependencies
		);
		expect(outcome.outcome, JSON.stringify(outcome)).toBe('partial');
		if (outcome.outcome !== 'partial') return;
		expect(observations.additionalArtifacts).toEqual([
			COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_PATH
		]);
		expect(observations.predecessorRequest).toMatchObject({
			operationVersion: 'jan-csaa-report-command-handler-graph/0.1.0',
			schemaVersion: 'jan-csaa-command-handler-graph-report-request/0.1.0'
		});
		expect(observations.topologyRequest).toMatchObject({
			commandHandlerGraphId: fixture.commandHandlerGraph.id,
			semanticSnapshotId: fixture.snapshot.id,
			subjectId: fixture.subject.descriptor.subjectId
		});
		expect(outcome.result.capability).toMatchObject({
			facadeScope: COMMAND_DISPATCH_TOPOLOGY_REPORT_SCOPE,
			graphAuthority: 'NONE',
			retainedDispatchCensusExecution: COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_EXECUTION,
			retainedDispatchCensusIntegration: COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_INTEGRATION,
			retainedDispatchCensusVerifierAuthority:
				COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_VERIFIER_AUTHORITY
		});
		expect(outcome.result.coverage).toMatchObject({
			candidateHandlerTargetEdges: 1,
			health: 'PARTIAL',
			pipelineNodes: 1,
			representedPipelineFacts: 5
		});
		expect(outcome.result.evidence.commandHandlerGraph.id).toBe(fixture.commandHandlerGraph.id);
		expect(outcome.result.evidence.observation.id).toBe(fixture.observation.id);
		expect(outcome.result.evidence.commandDispatchTopology.edges).toHaveLength(1);
		expect(outcome.result.facadeNonclaims).toBe(COMMAND_DISPATCH_TOPOLOGY_REPORT_NONCLAIMS);
		expect(
			outcome.result.predecessorNonclaims.commandHandlerGraphReportPredecessors
		).toHaveProperty('retainedArrowCommandCensusReport');
		expect(outcome.result.currentness.state).toBe('CURRENT_FOR_CAPTURED_SUBJECT');
		expect(calls.indexOf('verifySubject')).toBeGreaterThan(calls.indexOf('buildTopology'));
		expect(progress.some((event) => event.kind === 'PREDECESSOR_REPORT')).toBe(true);
		for (const phase of [
			'REQUEST_BIND',
			'PREDECESSOR_PIPELINE',
			'COMMAND_DISPATCH_TOPOLOGY',
			'CURRENTNESS',
			'RESULT'
		] as const)
			expect(
				progress
					.filter((event) => event.kind === 'REPORT_STAGE' && event.phase === phase)
					.map((event) => event.state)
			).toEqual(['STARTED', 'COMPLETED']);
		expect(commandDispatchTopologyReportExitCode(outcome)).toBe(3);
	});

	it('classifies injected predecessor, selection, build, validation, and freshness failures', async () => {
		const { dependencies, fixture } = syntheticDependencies();
		const diagnostic = (code: string) => ({
			code,
			message: `Synthetic ${code}.`,
			path: null,
			phase: 'REQUEST'
		});
		const validation = (state: 'BUDGET_EXHAUSTED' | 'INVALID') => ({
			issues: [
				{
					code: 'SYNTHETIC_VALIDATION_FAILURE',
					message: `Synthetic ${state}.`,
					path: '$.synthetic'
				}
			],
			state
		});
		const run = (overrides: Partial<CommandDispatchTopologyReportRuntimeDependencies>) =>
			runCommandDispatchTopologyReportWithDependencies(
				fixtureRequest(fixture),
				{ repositoryRoot: fixture.root },
				{ ...dependencies, ...overrides }
			);

		const predecessorUnavailable = await run({
			captureHandler: (async () => ({
				code: 'SYNTHETIC_PREDECESSOR_UNAVAILABLE',
				diagnostics: [
					{
						code: 'SYNTHETIC_PREDECESSOR_DIAGNOSTIC',
						message: 'Synthetic predecessor diagnostic.',
						path: null,
						phase: 'SYNTHETIC',
						predecessorSource: null,
						severity: 'ERROR',
						source: 'REPORT'
					}
				],
				outcome: 'unavailable',
				stage: 'SUBJECT',
				state: 'failed'
			})) as unknown as CommandDispatchTopologyReportRuntimeDependencies['captureHandler']
		});
		expect(predecessorUnavailable).toMatchObject({
			code: 'SYNTHETIC_PREDECESSOR_UNAVAILABLE',
			outcome: 'unavailable',
			stage: 'PREDECESSOR_PIPELINE',
			state: 'failed'
		});

		for (const [validator, validationState, state] of [
			['validateObservation', 'INVALID', 'failed'],
			['validateObservation', 'BUDGET_EXHAUSTED', 'resource-refused'],
			['validateHandlerGraph', 'INVALID', 'failed'],
			['validateHandlerGraph', 'BUDGET_EXHAUSTED', 'resource-refused']
		] as const) {
			const outcome = await run({
				[validator]: (() => validation(validationState)) as never
			});
			expect(outcome).toMatchObject({
				code: 'PREDECESSOR_VALIDATION_FAILED',
				outcome: 'unavailable',
				stage: 'PREDECESSOR_PIPELINE',
				state
			});
		}

		const selectionUnavailable = await run({
			selectCommandBus: (() => {
				throw new Error('synthetic selector failure');
			}) as CommandDispatchTopologyReportRuntimeDependencies['selectCommandBus']
		});
		expect(selectionUnavailable).toMatchObject({
			code: 'COMMAND_BUS_SELECTION_UNAVAILABLE',
			outcome: 'unavailable',
			stage: 'COMMAND_DISPATCH_TOPOLOGY',
			state: 'incompatible'
		});

		for (const [code, state] of [
			['BUDGET_EXCEEDED', 'resource-refused'],
			['REQUEST_INVALID', 'incompatible'],
			['GRAPH_VALIDATION_FAILED', 'failed']
		] as const) {
			const outcome = await run({
				buildTopology: (() => ({
					diagnostics: [diagnostic(code)],
					outcome: 'unavailable'
				})) as CommandDispatchTopologyReportRuntimeDependencies['buildTopology']
			});
			expect(outcome).toMatchObject({
				code: 'COMMAND_DISPATCH_TOPOLOGY_UNAVAILABLE',
				outcome: 'unavailable',
				stage: 'COMMAND_DISPATCH_TOPOLOGY',
				state
			});
		}

		for (const [validationState, state] of [
			['INVALID', 'failed'],
			['BUDGET_EXHAUSTED', 'resource-refused']
		] as const) {
			const outcome = await run({
				validateTopology: (() =>
					validation(
						validationState
					)) as CommandDispatchTopologyReportRuntimeDependencies['validateTopology']
			});
			expect(outcome).toMatchObject({
				code: 'TOPOLOGY_VALIDATION_FAILED',
				outcome: 'unavailable',
				stage: 'COMMAND_DISPATCH_TOPOLOGY',
				state
			});
		}

		const freshnessUnavailable = await run({
			verifySubject: (() => {
				throw new Error('synthetic freshness failure');
			}) as CommandDispatchTopologyReportRuntimeDependencies['verifySubject']
		});
		expect(freshnessUnavailable).toMatchObject({
			outcome: 'partial',
			result: { currentness: { state: 'UNAVAILABLE' } }
		});
	});

	it('contains malformed predecessor telemetry and fails closed at diagnostic, serialization, and internal boundaries', async () => {
		const nullOptions = await runCommandDispatchTopologyReport(null, null as never);
		expect(nullOptions).toMatchObject({ code: 'REQUEST_SHAPE_INVALID', stage: 'REQUEST' });

		const { dependencies, fixture } = syntheticDependencies();
		const progress: CommandDispatchTopologyReportProgressEvent[] = [];
		const telemetry = await runCommandDispatchTopologyReportWithDependencies(
			fixtureRequest(fixture),
			{
				onProgress(event) {
					progress.push(event);
					return Promise.reject(new Error('contained progress rejection'));
				},
				repositoryRoot: fixture.root
			},
			{
				...dependencies,
				async captureHandler(predecessorRequest, options) {
					options.onProgress?.(1n as never);
					const captured = await dependencies.captureHandler(predecessorRequest, options);
					if (captured.outcome !== 'captured') return captured;
					return {
						...captured,
						diagnostics: [
							{
								code: 'SYNTHETIC_PREDECESSOR_WARNING',
								message: `${fixture.root} synthetic warning.`,
								path: null,
								phase: 'SYNTHETIC',
								predecessorSource: null,
								severity: 'WARNING',
								source: 'REPORT'
							}
						]
					};
				}
			}
		);
		expect(telemetry.outcome).toBe('partial');
		expect(progress.some((event) => event.kind === 'PREDECESSOR_REPORT')).toBe(true);

		const diagnosticFailure = await runCommandDispatchTopologyReportWithDependencies(
			fixtureRequest(fixture),
			{ repositoryRoot: fixture.root },
			{
				...dependencies,
				buildTopology: (() => ({
					diagnostics: [
						'$.budgets',
						'$request.budgets.maxEdges',
						'$request.unsupported',
						join(fixture.root, 'synthetic.ts'),
						'../escape',
						'x'.repeat(10_000)
					].map((path) => ({
						code: 'GRAPH_VALIDATION_FAILED' as const,
						message: `${fixture.root} synthetic diagnostic.`,
						path,
						phase: 'VALIDATE' as const
					})),
					outcome: 'unavailable'
				})) as CommandDispatchTopologyReportRuntimeDependencies['buildTopology']
			}
		);
		expect(diagnosticFailure).toMatchObject({
			code: 'COMMAND_DISPATCH_TOPOLOGY_UNAVAILABLE',
			diagnostics: expect.arrayContaining([
				expect.objectContaining({ path: '$.budgets.commandDispatchTopology' }),
				expect.objectContaining({ path: '$.budgets.commandDispatchTopology.maxEdges' }),
				expect.objectContaining({ path: null })
			]),
			state: 'failed'
		});

		const serializationFailure = await runCommandDispatchTopologyReportWithDependencies(
			fixtureRequest(fixture),
			{ repositoryRoot: fixture.root },
			{
				...dependencies,
				verifySubject: (() => ({
					changedPaths: [1n] as never,
					diagnostics: [],
					state: 'STALE'
				})) as typeof verifyFrozenSubject
			}
		);
		expect(serializationFailure).toMatchObject({
			code: 'RESULT_SERIALIZATION_FAILED',
			stage: 'RESULT',
			state: 'failed'
		});

		const internalFailure = await runCommandDispatchTopologyReportWithDependencies(
			fixtureRequest(fixture),
			{ repositoryRoot: fixture.root },
			{
				...dependencies,
				captureHandler: async () => {
					throw new Error('synthetic predecessor failure');
				}
			}
		);
		expect(internalFailure).toMatchObject({
			code: 'INTERNAL_FAILURE',
			stage: 'RESULT',
			state: 'failed'
		});
		expect(commandDispatchTopologyReportExitCode(internalFailure)).toBe(4);
	});

	it('rejects forged retained dispatch identity even if an injected validator says valid', async () => {
		const { dependencies, fixture } = syntheticDependencies();
		const originalBuild = dependencies.buildTopology;
		const forgedDependencies: CommandDispatchTopologyReportRuntimeDependencies = {
			...dependencies,
			buildTopology(...args) {
				const outcome = originalBuild(...args);
				if (outcome.outcome !== 'partial') return outcome;
				const forged = structuredClone(outcome);
				Object.assign(forged.graph.retainedCommandDispatchCensus, {
					artifactContentSha256: 'f'.repeat(64)
				});
				return forged;
			},
			validateTopology: () => ({ issues: [], state: 'VALID' })
		};
		const outcome = await runCommandDispatchTopologyReportWithDependencies(
			fixtureRequest(fixture),
			{ repositoryRoot: fixture.root },
			forgedDependencies
		);
		expect(outcome).toMatchObject({
			code: 'EVIDENCE_IDENTITY_MISMATCH',
			outcome: 'unavailable',
			stage: 'RESULT',
			state: 'failed'
		});
	});

	it.each(topologyInternalForges)(
		'rejects forged $name even if its digest and injected validation reconcile',
		async ({ forge }) => {
			const { dependencies, fixture } = syntheticDependencies();
			const originalBuild = dependencies.buildTopology;
			const forgedDependencies: CommandDispatchTopologyReportRuntimeDependencies = {
				...dependencies,
				buildTopology(...args) {
					const outcome = originalBuild(...args);
					if (outcome.outcome !== 'partial') return outcome;
					const forged = structuredClone(outcome);
					forge(forged.graph);
					Object.assign(forged.graph, {
						contentDigest: commandDispatchTopologyContentDigest(forged.graph)
					});
					return forged;
				},
				validateTopology: () => ({ issues: [], state: 'VALID' })
			};
			const outcome = await runCommandDispatchTopologyReportWithDependencies(
				fixtureRequest(fixture),
				{ repositoryRoot: fixture.root },
				forgedDependencies
			);
			expect(outcome).toMatchObject({
				code: 'EVIDENCE_IDENTITY_MISMATCH',
				outcome: 'unavailable',
				stage: 'RESULT',
				state: 'failed'
			});
		}
	);

	it('requires the exact partial builder diagnostic envelope', async () => {
		const { dependencies, fixture } = syntheticDependencies();
		const originalBuild = dependencies.buildTopology;
		const outcome = await runCommandDispatchTopologyReportWithDependencies(
			fixtureRequest(fixture),
			{ repositoryRoot: fixture.root },
			{
				...dependencies,
				buildTopology(...args) {
					const built = originalBuild(...args);
					if (built.outcome !== 'partial') return built;
					return { ...built, diagnostics: [...built.diagnostics, built.diagnostics[0]!] };
				}
			}
		);
		expect(outcome).toMatchObject({
			code: 'TOPOLOGY_OUTCOME_MISMATCH',
			outcome: 'unavailable',
			stage: 'COMMAND_DISPATCH_TOPOLOGY',
			state: 'failed'
		});
	});

	it('binds captured predecessor budgets to the admitted request', async () => {
		const { dependencies, fixture } = syntheticDependencies();
		const admitted = fixtureRequest(fixture);
		const outcome = await runCommandDispatchTopologyReportWithDependencies(
			fixtureRequest(fixture, {
				budgets: {
					...admitted.budgets,
					subject: {
						...admitted.budgets.subject,
						maxFiles: admitted.budgets.subject.maxFiles - 1
					}
				}
			}),
			{ repositoryRoot: fixture.root },
			dependencies
		);
		expect(outcome).toMatchObject({
			code: 'EVIDENCE_IDENTITY_MISMATCH',
			outcome: 'unavailable',
			stage: 'RESULT',
			state: 'failed'
		});
	});

	it('refuses a full successful result that exceeds the admitted byte budget', async () => {
		const { dependencies, fixture } = syntheticDependencies();
		const outcome = await runCommandDispatchTopologyReportWithDependencies(
			fixtureRequest(fixture, {
				budgets: {
					...fixtureRequest(fixture).budgets,
					maxResultBytes: 1
				}
			}),
			{ repositoryRoot: fixture.root },
			dependencies
		);
		expect(outcome).toMatchObject({
			code: 'RESULT_BUDGET_EXCEEDED',
			outcome: 'unavailable',
			stage: 'RESULT',
			state: 'resource-refused'
		});
		expect(commandDispatchTopologyReportExitCode(outcome)).toBe(3);
	});

	it('contains hostile progress callbacks without changing evidence', async () => {
		const { dependencies, fixture } = syntheticDependencies();
		const outcome = await runCommandDispatchTopologyReportWithDependencies(
			fixtureRequest(fixture),
			{
				onProgress: () => {
					throw new Error('untrusted callback failure');
				},
				repositoryRoot: fixture.root
			},
			dependencies
		);
		expect(outcome.outcome).toBe('partial');
	});
});
