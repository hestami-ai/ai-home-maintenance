import { afterEach, describe, expect, it } from 'vitest';
import {
	COMMAND_HANDLER_GRAPH_REPORT_EXECUTION_SELECTION,
	COMMAND_HANDLER_GRAPH_REPORT_OPERATION_VERSION,
	COMMAND_HANDLER_GRAPH_REPORT_PROJECT_CONFIG_PATHS,
	COMMAND_HANDLER_GRAPH_REPORT_REQUEST_SCHEMA_VERSION,
	COMMAND_HANDLER_GRAPH_REPORT_SAFETY_CEILINGS,
	COMMAND_HANDLER_GRAPH_REPORT_SCOPE,
	type CommandHandlerGraphReportRequest
} from '../contracts/command-handler-graph-report.js';
import type { ProjectContextReportRequest } from '../contracts/project-context-report.js';
import { COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_PATH } from '../contracts/command-dispatch-topology.js';
import { buildCommandHandlerGraph } from '../graph/build-command-handler-graph.js';
import { createCommandHandlerGraphFixture } from '../graph/command-handler-graph-fixture.test-support.js';
import { validateArrowCommandCensusArtifactSet } from '../providers/jpwb-arrow-command-census/artifact-set.js';
import { verifyFrozenSubject } from '../subject/freshness.js';
import {
	admitCommandHandlerGraphReportRequest,
	captureCommandHandlerGraphReportPipeline,
	runCommandHandlerGraphReportWithDependencies,
	type CommandHandlerGraphReportProgressEvent,
	type CommandHandlerGraphReportRuntimeDependencies
} from './run-command-handler-graph-report.js';

const cleanups: Array<() => void> = [];

function request(
	overrides: Partial<CommandHandlerGraphReportRequest> = {}
): CommandHandlerGraphReportRequest {
	return {
		budgets: structuredClone(COMMAND_HANDLER_GRAPH_REPORT_SAFETY_CEILINGS),
		executionSelection: COMMAND_HANDLER_GRAPH_REPORT_EXECUTION_SELECTION,
		operationVersion: COMMAND_HANDLER_GRAPH_REPORT_OPERATION_VERSION,
		schemaVersion: COMMAND_HANDLER_GRAPH_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: [...COMMAND_HANDLER_GRAPH_REPORT_PROJECT_CONFIG_PATHS],
		...overrides
	};
}

function fixtureRequest(
	fixture: ReturnType<typeof createCommandHandlerGraphFixture>,
	overrides: Partial<CommandHandlerGraphReportRequest> = {}
): CommandHandlerGraphReportRequest {
	const baseline = request();
	return request({
		budgets: {
			...baseline.budgets,
			commandHandlerGraph: fixture.graphRequest.budgets
		},
		...overrides
	});
}

function syntheticDependencies(): {
	readonly dependencies: CommandHandlerGraphReportRuntimeDependencies;
	readonly evidenceObservation: ReturnType<typeof createCommandHandlerGraphFixture>['observation'];
	readonly fixture: ReturnType<typeof createCommandHandlerGraphFixture>;
	readonly observations: {
		artifactSubject?: unknown;
		captureAdditionalArtifacts?: readonly string[];
		graphObservation?: unknown;
		graphSnapshot?: unknown;
		graphSubject?: unknown;
		observedArtifactSet?: unknown;
		observedSubject?: unknown;
		verifiedSubject?: unknown;
	};
} {
	const fixture = createCommandHandlerGraphFixture();
	cleanups.push(fixture.cleanup);
	const observations: {
		artifactSubject?: unknown;
		captureAdditionalArtifacts?: readonly string[];
		graphObservation?: unknown;
		graphSnapshot?: unknown;
		graphSubject?: unknown;
		observedArtifactSet?: unknown;
		observedSubject?: unknown;
		verifiedSubject?: unknown;
	} = {};
	const evidenceObservation = structuredClone(fixture.observation);
	Object.assign(evidenceObservation, { budgets: request().budgets.observation });
	const graphOutcome = buildCommandHandlerGraph(
		fixture.graphRequest,
		fixture.snapshot,
		fixture.observation,
		fixture.subject
	);
	if (graphOutcome.outcome !== 'partial') throw new Error(JSON.stringify(graphOutcome));
	const dependencies: CommandHandlerGraphReportRuntimeDependencies = {
		buildArtifactSet(_request, inputs) {
			observations.artifactSubject = inputs.subject;
			return { artifactSet: fixture.arrowArtifactSet, diagnostics: [], outcome: 'complete' };
		},
		buildGraph(graphRequest, snapshot, observation, subject) {
			observations.graphSnapshot = snapshot;
			observations.graphObservation = observation;
			observations.graphSubject = subject;
			return graphOutcome;
		},
		captureSemantic(predecessorRequest, options) {
			observations.captureAdditionalArtifacts = options.additionalArtifacts;
			return {
				diagnostics: [],
				frozenSubject: fixture.subject,
				outcome: 'semantic-captured',
				predecessorStageOutcomes: {
					semanticSnapshot: { diagnosticCodes: [], outcome: 'complete' },
					subject: { completeness: 'COMPLETE', diagnosticCodes: [], outcome: 'resolved' }
				},
				repositoryRoot: fixture.root,
				request: predecessorRequest as ProjectContextReportRequest,
				semanticSnapshot: fixture.snapshot
			};
		},
		async observeCensus(_request, inputs) {
			observations.observedArtifactSet = inputs.artifactSet;
			observations.observedSubject = inputs.subject;
			return { diagnostics: [], observation: evidenceObservation, outcome: 'complete' };
		},
		selectRegistries(_snapshot) {
			return {
				commandRegistry: fixture.graphRequest.commandRegistry,
				handlerRegistry: fixture.graphRequest.handlerRegistry
			};
		},
		validateArtifactSet: validateArrowCommandCensusArtifactSet,
		validateGraph() {
			return { issues: [], state: 'VALID' };
		},
		validateObservation: () => ({ issues: [], state: 'VALID' }),
		verifySubject(subject, options) {
			observations.verifiedSubject = subject;
			return verifyFrozenSubject(subject, options);
		}
	};
	return { dependencies, evidenceObservation, fixture, observations };
}

afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
});

describe('runCommandHandlerGraphReport', () => {
	it('admits only the fixed closure, exact execution acknowledgement, and bounded exact data', () => {
		expect(admitCommandHandlerGraphReportRequest(request())).toMatchObject({
			outcome: 'admitted'
		});
		expect(admitCommandHandlerGraphReportRequest({ ...request(), unexpected: true })).toMatchObject(
			{ code: 'REQUEST_SHAPE_INVALID', outcome: 'rejected' }
		);
		expect(
			admitCommandHandlerGraphReportRequest({
				...request(),
				executionSelection: 'RUN_RETAINED_VERIFIER'
			})
		).toMatchObject({ code: 'RETAINED_EXECUTION_NOT_ACKNOWLEDGED', outcome: 'rejected' });
		expect(
			admitCommandHandlerGraphReportRequest({
				...request(),
				subjectProjectConfigPaths: COMMAND_HANDLER_GRAPH_REPORT_PROJECT_CONFIG_PATHS.slice(0, -1)
			})
		).toMatchObject({ code: 'REQUIRED_PROJECT_CLOSURE_MISMATCH', outcome: 'rejected' });
		const excessive = request();
		expect(
			admitCommandHandlerGraphReportRequest({
				...excessive,
				budgets: {
					...excessive.budgets,
					commandHandlerGraph: {
						...excessive.budgets.commandHandlerGraph,
						maxNodes: COMMAND_HANDLER_GRAPH_REPORT_SAFETY_CEILINGS.commandHandlerGraph.maxNodes + 1
					}
				}
			})
		).toMatchObject({
			code: 'REQUEST_BUDGET_EXCEEDS_SAFETY_CEILING',
			outcome: 'rejected',
			state: 'resource-refused'
		});
	});

	it('emits nonempty same-subject registry and arrow evidence with complete stage framing', async () => {
		const { dependencies, evidenceObservation, fixture, observations } = syntheticDependencies();
		const progress: CommandHandlerGraphReportProgressEvent[] = [];
		const outcome = await runCommandHandlerGraphReportWithDependencies(
			fixtureRequest(fixture),
			{ onProgress: (event) => progress.push(event), repositoryRoot: fixture.root },
			dependencies
		);
		expect(outcome.outcome, JSON.stringify(outcome)).toBe('partial');
		if (outcome.outcome !== 'partial') return;
		expect(outcome.result.coverage.discoveredCommandRegistryEntries).toBeGreaterThan(0);
		expect(outcome.result.coverage.discoveredHandlerRegistryEntries).toBeGreaterThan(0);
		expect(outcome.result.evidence.observation.declaredArrows.length).toBeGreaterThan(0);
		expect(outcome.result.evidence.commandHandlerGraph.nodes.length).toBeGreaterThan(0);
		expect(outcome.result.capability).toMatchObject({
			commandDispatchCensusIntegration: 'NOT_INTEGRATED',
			facadeScope: COMMAND_HANDLER_GRAPH_REPORT_SCOPE,
			graphAuthority: 'NONE',
			id: 'command-handler-static-projection',
			registryStatus: 'IMPLEMENTATION_LOCAL_UNREGISTERED',
			runtimeDispatchClosure: 'NOT_CLAIMED',
			runtimePerformability: 'NOT_CLAIMED',
			status: 'PARTIAL'
		});
		expect(observations.captureAdditionalArtifacts).toEqual([
			'verif/arrow-command-census.ts',
			'verif/arrow-command-census.baseline.json',
			'verif/arrow-census-coverage.test.ts',
			'verif/arrow-command-census.test.ts'
		]);
		for (const bound of [
			observations.artifactSubject,
			observations.observedSubject,
			observations.graphSubject,
			observations.verifiedSubject
		])
			expect(bound).toBe(fixture.subject);
		expect(observations.observedArtifactSet).toBe(fixture.arrowArtifactSet);
		expect(observations.graphSnapshot).toBe(fixture.snapshot);
		expect(observations.graphObservation).toBe(evidenceObservation);
		for (const phase of [
			'REQUEST_BIND',
			'PREDECESSOR_PIPELINE',
			'ARTIFACT_SET',
			'RETAINED_CENSUS',
			'COMMAND_HANDLER_GRAPH',
			'CURRENTNESS',
			'RESULT'
		] as const)
			expect(
				progress.filter((event) => event.kind === 'REPORT_STAGE' && event.phase === phase)
			).toEqual([
				expect.objectContaining({ state: 'STARTED' }),
				expect.objectContaining({ state: 'COMPLETED' })
			]);
	});

	it('hands one validated handler pipeline to a successor with its artifact in the initial subject', async () => {
		const { dependencies, fixture, observations } = syntheticDependencies();
		const outcome = await captureCommandHandlerGraphReportPipeline(
			fixtureRequest(fixture),
			{
				additionalArtifacts: [COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_PATH],
				repositoryRoot: fixture.root
			},
			dependencies
		);
		expect(outcome.outcome, JSON.stringify(outcome)).toBe('captured');
		if (outcome.outcome !== 'captured') return;
		expect(observations.captureAdditionalArtifacts).toEqual([
			'verif/arrow-command-census.ts',
			'verif/arrow-command-census.baseline.json',
			'verif/arrow-census-coverage.test.ts',
			'verif/arrow-command-census.test.ts',
			COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_PATH
		]);
		expect(outcome.frozenSubject).toBe(fixture.subject);
		expect(outcome.semanticSnapshot).toBe(fixture.snapshot);
		expect(outcome.artifactSet).toBe(fixture.arrowArtifactSet);
		expect(outcome.observation.subjectId).toBe(fixture.subject.descriptor.subjectId);
		expect(outcome.commandHandlerGraph.subjectId).toBe(fixture.subject.descriptor.subjectId);
		expect(outcome).not.toHaveProperty('result');
		expect(observations.verifiedSubject).toBeUndefined();
	});

	it('fails final reconciliation for forged executor binding even when injected validators accept it', async () => {
		const { dependencies, evidenceObservation, fixture } = syntheticDependencies();
		const originalGraph = buildCommandHandlerGraph(
			fixture.graphRequest,
			fixture.snapshot,
			fixture.observation,
			fixture.subject
		);
		if (originalGraph.outcome !== 'partial') throw new Error(JSON.stringify(originalGraph));
		const forged = structuredClone(evidenceObservation);
		Object.assign(forged.executor, { retainedVerifierSha256: 'f'.repeat(64) });
		const outcome = await runCommandHandlerGraphReportWithDependencies(
			fixtureRequest(fixture),
			{ repositoryRoot: fixture.root },
			{
				...dependencies,
				buildGraph: () => originalGraph,
				observeCensus: async () => ({ diagnostics: [], observation: forged, outcome: 'complete' }),
				validateGraph: () => ({ issues: [], state: 'VALID' }),
				validateObservation: () => ({ issues: [], state: 'VALID' })
			}
		);
		expect(outcome).toMatchObject({
			code: 'EVIDENCE_IDENTITY_MISMATCH',
			outcome: 'unavailable',
			stage: 'RESULT',
			state: 'failed'
		});
	});

	it('refuses a successful evidence envelope that exceeds the admitted result budget', async () => {
		const { dependencies, fixture } = syntheticDependencies();
		const baseline = fixtureRequest(fixture);
		const outcome = await runCommandHandlerGraphReportWithDependencies(
			fixtureRequest(fixture, { budgets: { ...baseline.budgets, maxResultBytes: 1 } }),
			{ repositoryRoot: fixture.root },
			dependencies
		);
		expect(outcome).toMatchObject({
			code: 'RESULT_BUDGET_EXCEEDED',
			outcome: 'unavailable',
			stage: 'RESULT',
			state: 'resource-refused'
		});
	});
});
