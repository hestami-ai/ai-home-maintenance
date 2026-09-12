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
import type { ArrowCommandCensusProgressEvent } from '../providers/jpwb-arrow-command-census/observe-arrow-command-census.js';
import { verifyFrozenSubject } from '../subject/freshness.js';
import {
	admitCommandHandlerGraphReportRequest,
	captureCommandHandlerGraphReportPipeline,
	commandHandlerGraphReportExitCode,
	runCommandHandlerGraphReport,
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

function adapterEvent(details: Readonly<Record<string, unknown>>): ArrowCommandCensusProgressEvent {
	return {
		adapterElapsedMs: 1,
		details,
		durationMs: 1,
		event: 'CSAA_ARROW_COMMAND_CENSUS_PHASE',
		phase: 'OBSERVATION_NORMALIZATION',
		schemaVersion: 'jan-csaa-arrow-command-census-progress/1.0.0',
		sequence: 1,
		state: 'COMPLETED',
		timestamp: '2026-01-01T00:00:00.000Z'
	};
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

		const customPrototype = Object.assign(Object.create({ inherited: true }) as object, request());
		expect(admitCommandHandlerGraphReportRequest(customPrototype)).toMatchObject({
			code: 'REQUEST_SHAPE_INVALID',
			outcome: 'rejected',
			path: '$'
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
		expect(admitCommandHandlerGraphReportRequest(accessor)).toMatchObject({
			code: 'REQUEST_SHAPE_INVALID',
			outcome: 'rejected',
			path: '$.budgets'
		});
		expect(touched).toBe(false);

		for (const [key, value, code, path] of [
			[
				'operationVersion',
				'jan-csaa-report-command-handler-graph/unsupported',
				'REQUEST_OPERATION_INCOMPATIBLE',
				'$.operationVersion'
			],
			[
				'schemaVersion',
				'jan-csaa-command-handler-graph-report-request/unsupported',
				'REQUEST_SCHEMA_INCOMPATIBLE',
				'$.schemaVersion'
			]
		] as const)
			expect(admitCommandHandlerGraphReportRequest({ ...request(), [key]: value })).toMatchObject({
				code,
				outcome: 'rejected',
				path
			});

		const invalidReportBudget = request();
		(invalidReportBudget.budgets.artifactSet as { maxArtifacts: number }).maxArtifacts = 0;
		expect(admitCommandHandlerGraphReportRequest(invalidReportBudget)).toMatchObject({
			code: 'REQUEST_BUDGET_INVALID',
			outcome: 'rejected',
			path: '$.budgets.artifactSet.maxArtifacts'
		});

		const invalidPredecessorBudget = request();
		(invalidPredecessorBudget.budgets.semantic as { maxSources: number }).maxSources = 0;
		expect(admitCommandHandlerGraphReportRequest(invalidPredecessorBudget)).toMatchObject({
			code: 'REQUEST_BUDGET_INVALID',
			outcome: 'rejected',
			path: '$.budgets.semantic.maxSources'
		});

		const duplicateClosure = [...COMMAND_HANDLER_GRAPH_REPORT_PROJECT_CONFIG_PATHS];
		duplicateClosure[1] = duplicateClosure[0]!;
		expect(
			admitCommandHandlerGraphReportRequest(
				request({ subjectProjectConfigPaths: duplicateClosure })
			)
		).toMatchObject({ code: 'REQUEST_PROJECTS_INVALID', outcome: 'rejected' });
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

	it('forwards canonical retained-adapter progress and contains malformed and rejected observers', async () => {
		const { dependencies, fixture } = syntheticDependencies();
		const originalObserve = dependencies.observeCensus;
		const progress: CommandHandlerGraphReportProgressEvent[] = [];
		const outcome = await runCommandHandlerGraphReportWithDependencies(
			fixtureRequest(fixture),
			{
				onProgress(event) {
					progress.push(event);
					if (event.kind === 'RETAINED_ADAPTER')
						return Promise.reject(new Error('synthetic rejected observer'));
				},
				repositoryRoot: fixture.root
			},
			{
				...dependencies,
				async observeCensus(requestValue, inputs, options) {
					options?.onProgress?.(adapterEvent({ code: 'ADAPTER_COMPLETE' }));
					options?.onProgress?.(adapterEvent({}));
					options?.onProgress?.({
						...adapterEvent({}),
						details: { nonCanonical: 1n }
					} as unknown as ArrowCommandCensusProgressEvent);
					return originalObserve(requestValue, inputs, options);
				}
			}
		);
		expect(outcome.outcome).toBe('partial');
		expect(commandHandlerGraphReportExitCode(outcome)).toBe(3);
		expect(
			progress
				.filter((event) => event.kind === 'RETAINED_ADAPTER')
				.map((event) => [event.detailCode, event.adapterProgress?.phase])
		).toEqual([
			['ADAPTER_COMPLETE', 'OBSERVATION_NORMALIZATION'],
			['OBSERVATION_NORMALIZATION', 'OBSERVATION_NORMALIZATION']
		]);
	});

	it('hands one validated handler pipeline to a successor with its artifact in the initial subject', async () => {
		const { dependencies, fixture, observations } = syntheticDependencies();
		const outcome = await captureCommandHandlerGraphReportPipeline(
			fixtureRequest(fixture),
			{
				additionalArtifacts: [
					COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_PATH,
					'verif/arrow-command-census.ts'
				],
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

	it('fails capture reconciliation for a forged executor binding before evidence handoff', async () => {
		const { dependencies, evidenceObservation, fixture } = syntheticDependencies();
		const forged = structuredClone(evidenceObservation);
		Object.assign(forged.executor, { retainedVerifierSha256: 'e'.repeat(64) });
		const outcome = await captureCommandHandlerGraphReportPipeline(
			fixtureRequest(fixture),
			{ repositoryRoot: fixture.root },
			{
				...dependencies,
				observeCensus: async () => ({ diagnostics: [], observation: forged, outcome: 'complete' }),
				validateGraph: () => ({ issues: [], state: 'VALID' }),
				validateObservation: () => ({ issues: [], state: 'VALID' })
			}
		);
		expect(outcome).toMatchObject({
			code: 'EVIDENCE_IDENTITY_MISMATCH',
			outcome: 'unavailable',
			stage: 'COMMAND_HANDLER_GRAPH',
			state: 'failed'
		});
	});

	it('fails closed across predecessor, retained-evidence, registry, and graph dependency states', async () => {
		const { dependencies, evidenceObservation, fixture } = syntheticDependencies();
		const run = (overrides: Partial<CommandHandlerGraphReportRuntimeDependencies>) =>
			runCommandHandlerGraphReportWithDependencies(
				fixtureRequest(fixture),
				{ repositoryRoot: fixture.root },
				{ ...dependencies, ...overrides }
			);
		const diagnostic = (code: string, path: string | null = null) => ({
			code,
			message: `Synthetic ${code}.`,
			path,
			phase: 'VALIDATE',
			severity: 'ERROR'
		});

		const predecessor = await run({
			captureSemantic: () =>
				({
					code: 'SUBJECT_UNAVAILABLE',
					diagnostics: [diagnostic('SUBJECT_UNAVAILABLE', 'not/canonical/../path.ts')],
					outcome: 'unavailable',
					state: 'incompatible'
				}) as never
		});
		expect(predecessor).toMatchObject({
			code: 'SUBJECT_UNAVAILABLE',
			outcome: 'unavailable',
			stage: 'PREDECESSOR_PIPELINE',
			state: 'incompatible'
		});

		for (const [code, state] of [
			['BUDGET_EXHAUSTED', 'resource-refused'],
			['REQUIRED_ARTIFACT_MISSING', 'incompatible'],
			['ARTIFACT_READ_FAILED', 'failed']
		] as const) {
			const outcome = await run({
				buildArtifactSet: () =>
					({
						diagnostics: [diagnostic(code, '$request.budgets.maxArtifacts')],
						outcome: 'unavailable'
					}) as never
			});
			expect(outcome).toMatchObject({
				code: 'ARTIFACT_SET_UNAVAILABLE',
				outcome: 'unavailable',
				stage: 'ARTIFACT_SET',
				state
			});
		}

		for (const [code, state] of [
			['BUDGET_EXHAUSTED', 'resource-refused'],
			['EXECUTION_FAILED', 'failed']
		] as const) {
			const outcome = await run({
				observeCensus: async () =>
					({ diagnostics: [diagnostic(code, '$request.budgets')], outcome: 'unavailable' }) as never
			});
			expect(outcome).toMatchObject({
				code: 'RETAINED_CENSUS_UNAVAILABLE',
				outcome: 'unavailable',
				stage: 'RETAINED_CENSUS',
				state
			});
		}

		const registry = await run({
			selectRegistries() {
				throw new Error('synthetic ambiguous registry');
			}
		});
		expect(registry).toMatchObject({
			code: 'REGISTRY_SELECTION_UNAVAILABLE',
			outcome: 'unavailable',
			stage: 'COMMAND_HANDLER_GRAPH',
			state: 'incompatible'
		});

		for (const [code, state] of [
			['BUDGET_EXCEEDED', 'resource-refused'],
			['UNSUPPORTED_HANDLER_REGISTRY', 'incompatible'],
			['GRAPH_BUILD_FAILED', 'failed']
		] as const) {
			const outcome = await run({
				buildGraph: () =>
					({
						diagnostics: [diagnostic(code, '$request.budgets.maxNodes')],
						outcome: 'unavailable'
					}) as never
			});
			expect(outcome).toMatchObject({
				code: 'COMMAND_HANDLER_GRAPH_UNAVAILABLE',
				outcome: 'unavailable',
				stage: 'COMMAND_HANDLER_GRAPH',
				state
			});
		}

		const contradictoryCensus = await run({
			observeCensus: async () =>
				({ diagnostics: [], observation: evidenceObservation, outcome: 'partial' }) as never
		});
		expect(contradictoryCensus).toMatchObject({
			code: 'EVIDENCE_IDENTITY_MISMATCH',
			outcome: 'unavailable',
			stage: 'RETAINED_CENSUS',
			state: 'failed'
		});
	});

	it('rejects independently invalid artifacts, observations, graphs, and graph envelopes', async () => {
		const { dependencies, fixture } = syntheticDependencies();
		const run = (overrides: Partial<CommandHandlerGraphReportRuntimeDependencies>) =>
			runCommandHandlerGraphReportWithDependencies(
				fixtureRequest(fixture),
				{ repositoryRoot: fixture.root },
				{ ...dependencies, ...overrides }
			);
		const issue = {
			code: 'IDENTITY_MISMATCH',
			message: `${fixture.root} synthetic invalid evidence.`,
			path: '$.id'
		};

		for (const [name, overrides, stage, state] of [
			[
				'artifact set',
				{ validateArtifactSet: () => ({ issues: [issue], state: 'INVALID' }) as never },
				'ARTIFACT_SET',
				'failed'
			],
			[
				'artifact-set validation budget',
				{ validateArtifactSet: () => ({ issues: [issue], state: 'BUDGET_EXHAUSTED' }) as never },
				'ARTIFACT_SET',
				'resource-refused'
			],
			[
				'observation',
				{ validateObservation: () => ({ issues: [issue], state: 'INVALID' }) as never },
				'RETAINED_CENSUS',
				'failed'
			],
			[
				'observation validation budget',
				{ validateObservation: () => ({ issues: [issue], state: 'BUDGET_EXHAUSTED' }) as never },
				'RETAINED_CENSUS',
				'resource-refused'
			],
			[
				'graph',
				{ validateGraph: () => ({ issues: [issue], state: 'INVALID' }) as never },
				'COMMAND_HANDLER_GRAPH',
				'failed'
			],
			[
				'graph validation budget',
				{ validateGraph: () => ({ issues: [issue], state: 'BUDGET_EXHAUSTED' }) as never },
				'COMMAND_HANDLER_GRAPH',
				'resource-refused'
			]
		] as const) {
			const outcome = await run(overrides);
			expect(outcome, name).toMatchObject({ outcome: 'unavailable', stage, state });
			expect(outcome.diagnostics).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ message: expect.not.stringContaining(fixture.root) })
				])
			);
		}

		const originalBuild = dependencies.buildGraph;
		const envelope = await run({
			buildGraph(...args) {
				const outcome = originalBuild(...args);
				if (outcome.outcome !== 'partial') return outcome;
				return { ...outcome, diagnostics: [...outcome.diagnostics, ...outcome.diagnostics] };
			}
		});
		expect(envelope).toMatchObject({
			code: 'GRAPH_OUTCOME_MISMATCH',
			outcome: 'unavailable',
			stage: 'COMMAND_HANDLER_GRAPH',
			state: 'failed'
		});
	});

	it('redacts predecessor diagnostics and canonicalizes nested validation paths fail-closed', async () => {
		const { dependencies, fixture } = syntheticDependencies();
		const originalCapture = dependencies.captureSemantic;
		const absolutePath = `${fixture.root}\\projects\\app\\src\\handler.ts`;
		const outcome = await runCommandHandlerGraphReportWithDependencies(
			fixtureRequest(fixture),
			{ repositoryRoot: fixture.root },
			{
				...dependencies,
				captureSemantic(...args) {
					const capture = originalCapture(...args);
					if (capture.outcome !== 'semantic-captured') return capture;
					return {
						...capture,
						diagnostics: [
							{
								code: 'PREDECESSOR_WARNING',
								message: `Synthetic warning under ${fixture.root}.`,
								path: absolutePath,
								phase: 'CAPTURE',
								severity: 'WARNING',
								source: 'SUBJECT'
							}
						]
					};
				},
				validateArtifactSet: () =>
					({
						issues: [
							{ code: 'ABSOLUTE_PATH', message: 'absolute', path: absolutePath },
							{
								code: 'CANONICAL_RELATIVE_PATH',
								message: 'relative',
								path: 'projects/app/src/handler.ts'
							},
							{
								code: 'INVALID_RELATIVE_PATH',
								message: 'invalid',
								path: 'projects/app/../secret.ts'
							},
							{
								code: 'UNBOUND_REQUEST_PATH',
								message: 'request',
								path: '$request.executionSelection'
							}
						],
						state: 'INVALID'
					}) as never
			}
		);
		expect(outcome).toMatchObject({
			code: 'ARTIFACT_SET_VALIDATION_FAILED',
			outcome: 'unavailable',
			stage: 'ARTIFACT_SET',
			state: 'failed'
		});
		expect(outcome.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'PREDECESSOR_WARNING',
					path: 'projects/app/src/handler.ts'
				}),
				expect.objectContaining({ code: 'ABSOLUTE_PATH', path: 'projects/app/src/handler.ts' }),
				expect.objectContaining({
					code: 'CANONICAL_RELATIVE_PATH',
					path: 'projects/app/src/handler.ts'
				}),
				expect.objectContaining({ code: 'INVALID_RELATIVE_PATH', path: null }),
				expect.objectContaining({ code: 'UNBOUND_REQUEST_PATH', path: null })
			])
		);
		expect(JSON.stringify(outcome)).not.toContain(fixture.root);
	});

	it('contains hostile request and progress observers without losing deterministic evidence', async () => {
		const { dependencies, fixture } = syntheticDependencies();
		const hostile = new Proxy(
			{},
			{
				ownKeys() {
					throw new Error('synthetic inspection failure');
				}
			}
		);
		const rejected = await runCommandHandlerGraphReportWithDependencies(
			hostile,
			{ repositoryRoot: fixture.root },
			dependencies
		);
		expect(rejected).toMatchObject({
			code: 'REQUEST_SHAPE_INVALID',
			outcome: 'unavailable',
			stage: 'REQUEST',
			state: 'incompatible'
		});

		const outcome = await runCommandHandlerGraphReportWithDependencies(
			fixtureRequest(fixture),
			{
				onProgress() {
					throw new Error('synthetic progress failure');
				},
				repositoryRoot: fixture.root
			},
			dependencies
		);
		expect(outcome.outcome).toBe('partial');
	});

	it('retains a reconciled partial census and contains a throwing final currentness verifier', async () => {
		const { dependencies, evidenceObservation, fixture } = syntheticDependencies();
		const partialObservation = structuredClone(evidenceObservation);
		Object.assign(partialObservation.coverage, { baselineMatches: false });
		Object.assign(partialObservation.baselineComparison, { matches: false });
		Object.assign(partialObservation.epistemic, { executionHealth: 'PARTIAL' });
		const outcome = await runCommandHandlerGraphReportWithDependencies(
			fixtureRequest(fixture),
			{ repositoryRoot: fixture.root },
			{
				...dependencies,
				observeCensus: async () => ({
					diagnostics: [
						{
							code: 'BASELINE_MISMATCH',
							message: 'The retained baseline differs.',
							path: 'verif/arrow-command-census.baseline.json',
							phase: 'VALIDATE',
							severity: 'WARNING'
						}
					],
					observation: partialObservation,
					outcome: 'partial'
				}),
				validateObservation: () => ({ issues: [], state: 'VALID' }),
				verifySubject: (() => {
					throw new Error(`synthetic currentness failure: ${fixture.root}`);
				}) as typeof verifyFrozenSubject
			}
		);
		expect(outcome).toMatchObject({
			outcome: 'partial',
			result: {
				currentness: {
					changedPaths: [],
					diagnosticCodes: ['SUBJECT_CHANGED_DURING_RESOLUTION'],
					state: 'UNAVAILABLE'
				}
			},
			stageOutcomes: {
				currentness: {
					diagnosticCodes: ['SUBJECT_CHANGED_DURING_RESOLUTION'],
					state: 'UNAVAILABLE'
				},
				retainedCensus: {
					diagnosticCodes: ['BASELINE_MISMATCH'],
					outcome: 'partial'
				}
			}
		});
		expect(JSON.stringify(outcome)).not.toContain('synthetic currentness failure');
		expect(JSON.stringify(outcome)).not.toContain(fixture.root);
	});

	it('fails final serialization closed for a non-canonical injected currentness witness', async () => {
		const { dependencies, fixture } = syntheticDependencies();
		const outcome = await runCommandHandlerGraphReportWithDependencies(
			fixtureRequest(fixture),
			{ repositoryRoot: fixture.root },
			{
				...dependencies,
				verifySubject: (() => ({
					changedPaths: [1n],
					diagnostics: [],
					state: 'CURRENT'
				})) as unknown as typeof verifyFrozenSubject
			}
		);
		expect(outcome).toMatchObject({
			code: 'RESULT_SERIALIZATION_FAILED',
			outcome: 'unavailable',
			stage: 'RESULT',
			state: 'failed'
		});
		expect(JSON.stringify(outcome)).not.toContain('1n');
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
		expect(commandHandlerGraphReportExitCode(outcome)).toBe(3);
	});

	it('contains public and capture dependency exceptions with distinct fail-closed terminals', async () => {
		const { dependencies, fixture } = syntheticDependencies();
		const publicOutcome = await runCommandHandlerGraphReportWithDependencies(
			fixtureRequest(fixture),
			null as unknown as Parameters<typeof runCommandHandlerGraphReportWithDependencies>[1],
			dependencies
		);
		expect(publicOutcome).toMatchObject({
			code: 'INTERNAL_FAILURE',
			outcome: 'unavailable',
			stage: 'RESULT',
			state: 'failed'
		});
		expect(commandHandlerGraphReportExitCode(publicOutcome)).toBe(4);

		const captureOutcome = await captureCommandHandlerGraphReportPipeline(
			fixtureRequest(fixture),
			{ repositoryRoot: fixture.root },
			{
				...dependencies,
				captureSemantic() {
					throw new Error(`synthetic capture failure: ${fixture.root}`);
				}
			}
		);
		expect(captureOutcome).toMatchObject({
			code: 'INTERNAL_FAILURE',
			outcome: 'unavailable',
			stage: 'COMMAND_HANDLER_GRAPH',
			state: 'failed'
		});
		expect(JSON.stringify(captureOutcome)).not.toContain('synthetic capture failure');
		expect(JSON.stringify(captureOutcome)).not.toContain(fixture.root);
	});

	it('maps the public default wrapper incompatible terminal to exit code two', async () => {
		const { fixture } = syntheticDependencies();
		const outcome = await runCommandHandlerGraphReport(
			{
				...fixtureRequest(fixture),
				operationVersion: 'jan-csaa-report-command-handler-graph/unsupported'
			},
			{ repositoryRoot: fixture.root }
		);
		expect(outcome).toMatchObject({
			code: 'REQUEST_OPERATION_INCOMPATIBLE',
			outcome: 'unavailable',
			stage: 'REQUEST',
			state: 'incompatible'
		});
		expect(commandHandlerGraphReportExitCode(outcome)).toBe(2);
	});
});
