import { Buffer } from 'node:buffer';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { CommandHandlerGraphReportRequest } from '../contracts/command-handler-graph-report.js';
import {
	GUARD_CLASSIFICATION_OVERLAY_REPORT_EXECUTION_SELECTION,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_NONCLAIMS,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_OPERATION_VERSION,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_PROJECT_CONFIG_PATHS,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_REQUEST_SCHEMA_VERSION,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_SAFETY_CEILINGS,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_SCOPE,
	type GuardClassificationOverlayReportRequest
} from '../contracts/guard-classification-overlay-report.js';
import { GUARD_ENFORCEMENT_LEDGER_REPORT_ADDITIONAL_ARTIFACT_PATHS } from '../contracts/guard-enforcement-ledger-report.js';
import type {
	GuardClassificationOverlayBuildInputs,
	GuardClassificationOverlaySnapshot
} from '../contracts/guard-classification-overlay.js';
import type { StateMachineGraphSnapshot } from '../contracts/state-machine-graph.js';
import { buildGuardClassificationOverlay } from '../graph/build-guard-classification-overlay.js';
import { buildStateMachineGraph } from '../graph/build-state-machine-graph.js';
import {
	createGuardClassificationOverlayReportPredecessorFixture,
	type GuardClassificationOverlayPredecessorFixture
} from '../graph/guard-classification-overlay-fixture.test-support.js';
import { validateCommandHandlerGraph } from '../graph/validate-command-handler-graph.js';
import { validateArrowCommandCensusObservation } from '../providers/jpwb-arrow-command-census/validate-arrow-command-census.js';
import {
	buildGuardEnforcementLedgerArtifactSet,
	validateGuardEnforcementLedgerArtifactSet
} from '../providers/jpwb-guard-enforcement-ledger/artifact-set.js';
import { validateGuardEnforcementLedgerObservation } from '../providers/jpwb-guard-enforcement-ledger/validate-guard-enforcement-ledger.js';
import { observeStateMachineTopology } from '../providers/jpwb-state-machines/observe-state-machines.js';
import { validateStateMachineTopologyObservation } from '../providers/jpwb-state-machines/validate-state-machine-observation.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import { verifyFrozenSubject } from '../subject/freshness.js';
import type { CommandHandlerGraphReportPipelineCapture } from './run-command-handler-graph-report.js';
import {
	admitGuardClassificationOverlayReportRequest,
	guardClassificationOverlayReportExitCode,
	runGuardClassificationOverlayReport,
	runGuardClassificationOverlayReportWithDependencies,
	type GuardClassificationOverlayReportProgressEvent,
	type GuardClassificationOverlayReportRuntimeDependencies
} from './run-guard-classification-overlay-report.js';

let fixture: GuardClassificationOverlayPredecessorFixture;

function request(
	overrides: Partial<GuardClassificationOverlayReportRequest> = {}
): GuardClassificationOverlayReportRequest {
	return {
		budgets: {
			artifactSet: GUARD_CLASSIFICATION_OVERLAY_REPORT_SAFETY_CEILINGS.artifactSet,
			commandHandlerGraph: fixture.commandHandlerRequest.budgets,
			guardArtifactSet: GUARD_CLASSIFICATION_OVERLAY_REPORT_SAFETY_CEILINGS.guardArtifactSet,
			guardClassificationOverlay: fixture.request.budgets,
			guardObservation: fixture.guardObservation.budgets,
			maxResultBytes: GUARD_CLASSIFICATION_OVERLAY_REPORT_SAFETY_CEILINGS.maxResultBytes,
			observation: fixture.arrowObservation.budgets,
			semantic: fixture.snapshot.budgets,
			stateMachineGraph: fixture.stateGraph.budgets,
			stateObservation: fixture.stateObservation.budgets,
			subject: fixture.subject.request.budgets
		},
		executionSelection: GUARD_CLASSIFICATION_OVERLAY_REPORT_EXECUTION_SELECTION,
		operationVersion: GUARD_CLASSIFICATION_OVERLAY_REPORT_OPERATION_VERSION,
		schemaVersion: GUARD_CLASSIFICATION_OVERLAY_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: GUARD_CLASSIFICATION_OVERLAY_REPORT_PROJECT_CONFIG_PATHS,
		...overrides
	};
}

function predecessorStageOutcomes(): CommandHandlerGraphReportPipelineCapture['predecessorStageOutcomes'] {
	return {
		artifactSet: { diagnosticCodes: [], outcome: 'complete' },
		commandHandlerGraph: { diagnosticCodes: ['GRAPH_PARTIAL'], outcome: 'partial' },
		predecessorPipeline: {
			semanticSnapshot: { diagnosticCodes: [], outcome: 'complete' },
			subject: { completeness: 'COMPLETE', diagnosticCodes: [], outcome: 'resolved' }
		},
		retainedCensus: { diagnosticCodes: [], outcome: 'complete' }
	};
}

function dependencies(
	overrides: Partial<GuardClassificationOverlayReportRuntimeDependencies> = {},
	observed?: {
		additionalArtifacts?: readonly string[];
		commandHandlerRequest?: GuardClassificationOverlayBuildInputs['commandHandlerRequest'];
	}
): GuardClassificationOverlayReportRuntimeDependencies {
	return {
		buildGuardArtifactSet: buildGuardEnforcementLedgerArtifactSet,
		buildOverlay: buildGuardClassificationOverlay,
		buildStateGraph: buildStateMachineGraph,
		async captureHandler(predecessorRequest, options) {
			if (observed !== undefined) observed.additionalArtifacts = options.additionalArtifacts;
			return {
				artifactSet: fixture.arrowArtifactSet!,
				commandHandlerGraph: fixture.commandHandlerGraph,
				diagnostics: [],
				frozenSubject: fixture.subject,
				observation: fixture.arrowObservation,
				outcome: 'captured',
				predecessorStageOutcomes: predecessorStageOutcomes(),
				repositoryRoot: fixture.root,
				request: predecessorRequest as CommandHandlerGraphReportRequest,
				semanticSnapshot: fixture.snapshot
			};
		},
		async observeGuard() {
			return { diagnostics: [], observation: fixture.guardObservation, outcome: 'complete' };
		},
		observeState: observeStateMachineTopology,
		validateGuardArtifactSet: validateGuardEnforcementLedgerArtifactSet,
		validateGuardObservation: validateGuardEnforcementLedgerObservation,
		validateHandlerGraph: validateCommandHandlerGraph,
		validateObservation: validateArrowCommandCensusObservation,
		validateStateObservation: validateStateMachineTopologyObservation,
		verifySubject: verifyFrozenSubject,
		...(observed === undefined
			? {}
			: {
					buildOverlay(
						inputs: GuardClassificationOverlayBuildInputs,
						options: Parameters<typeof buildGuardClassificationOverlay>[1]
					) {
						observed.commandHandlerRequest = inputs.commandHandlerRequest;
						return buildGuardClassificationOverlay(inputs, options);
					}
				}),
		...overrides
	};
}

beforeAll(() => {
	fixture = createGuardClassificationOverlayReportPredecessorFixture();
});

afterAll(() => {
	fixture.cleanup();
});

describe('runGuardClassificationOverlayReport', { timeout: 60_000 }, () => {
	it('admits only the exact acknowledged fixed closure and hostile-safe bounded data request', () => {
		expect(admitGuardClassificationOverlayReportRequest(request())).toMatchObject({
			outcome: 'admitted'
		});
		expect(
			admitGuardClassificationOverlayReportRequest({ ...request(), unexpected: true })
		).toMatchObject({ code: 'REQUEST_SHAPE_INVALID', outcome: 'rejected' });
		expect(
			admitGuardClassificationOverlayReportRequest({
				...request(),
				executionSelection: 'RUN_RETAINED_VERIFIER'
			})
		).toMatchObject({ code: 'RETAINED_EXECUTION_NOT_ACKNOWLEDGED', outcome: 'rejected' });
		expect(
			admitGuardClassificationOverlayReportRequest({
				...request(),
				subjectProjectConfigPaths: GUARD_CLASSIFICATION_OVERLAY_REPORT_PROJECT_CONFIG_PATHS.slice(
					0,
					-1
				)
			})
		).toMatchObject({ code: 'REQUIRED_PROJECT_CLOSURE_MISMATCH', outcome: 'rejected' });
		expect(
			admitGuardClassificationOverlayReportRequest({
				...request(),
				budgets: {
					...request().budgets,
					guardClassificationOverlay: {
						...request().budgets.guardClassificationOverlay,
						maxFrontiers:
							GUARD_CLASSIFICATION_OVERLAY_REPORT_SAFETY_CEILINGS.guardClassificationOverlay
								.maxFrontiers + 1
					}
				}
			})
		).toMatchObject({
			code: 'REQUEST_BUDGET_EXCEEDS_SAFETY_CEILING',
			outcome: 'rejected',
			state: 'resource-refused'
		});
		const hostile = new Proxy(request(), {
			ownKeys() {
				throw new Error('hostile');
			}
		});
		expect(admitGuardClassificationOverlayReportRequest(hostile)).toMatchObject({
			code: 'REQUEST_SHAPE_INVALID',
			outcome: 'rejected'
		});
	});

	it('rejects non-data request records and invalid scalar versions through the public facade', async () => {
		const nonEnumerable = { ...request() };
		Object.defineProperty(nonEnumerable, 'schemaVersion', {
			enumerable: false,
			value: GUARD_CLASSIFICATION_OVERLAY_REPORT_REQUEST_SCHEMA_VERSION
		});
		for (const malformed of [new Date(), nonEnumerable]) {
			expect(admitGuardClassificationOverlayReportRequest(malformed)).toMatchObject({
				code: 'REQUEST_SHAPE_INVALID',
				outcome: 'rejected'
			});
		}
		expect(
			admitGuardClassificationOverlayReportRequest({
				...request(),
				operationVersion: 'unsupported'
			})
		).toMatchObject({ code: 'REQUEST_OPERATION_INCOMPATIBLE', outcome: 'rejected' });
		expect(
			admitGuardClassificationOverlayReportRequest({
				...request(),
				schemaVersion: 'unsupported'
			})
		).toMatchObject({ code: 'REQUEST_SCHEMA_INCOMPATIBLE', outcome: 'rejected' });
		const base = request();
		expect(
			admitGuardClassificationOverlayReportRequest({
				...base,
				budgets: { ...base.budgets, maxResultBytes: 0 }
			})
		).toMatchObject({ code: 'REQUEST_BUDGET_INVALID', outcome: 'rejected' });
		expect(
			admitGuardClassificationOverlayReportRequest({
				...base,
				budgets: {
					...base.budgets,
					guardArtifactSet: { ...base.budgets.guardArtifactSet, maxArtifacts: 0 }
				}
			})
		).toMatchObject({ code: 'REQUEST_BUDGET_INVALID', outcome: 'rejected' });

		const publicOutcome = await runGuardClassificationOverlayReport(null, {
			repositoryRoot: fixture.root
		});
		expect(publicOutcome).toMatchObject({
			code: 'REQUEST_SHAPE_INVALID',
			outcome: 'unavailable',
			stage: 'REQUEST'
		});
		expect(guardClassificationOverlayReportExitCode(publicOutcome)).toBe(2);
	});

	it('emits one complete validated same-subject partial overlay and bounded ordered progress', async () => {
		const progress: GuardClassificationOverlayReportProgressEvent[] = [];
		const observed: {
			additionalArtifacts?: readonly string[];
			commandHandlerRequest?: GuardClassificationOverlayBuildInputs['commandHandlerRequest'];
		} = {};
		const outcome = await runGuardClassificationOverlayReportWithDependencies(
			request(),
			{
				onProgress: (event) => progress.push(event),
				repositoryRoot: fixture.root
			},
			dependencies({}, observed)
		);
		expect(outcome.outcome, JSON.stringify(outcome)).toBe('partial');
		if (outcome.outcome !== 'partial') return;
		expect(guardClassificationOverlayReportExitCode(outcome)).toBe(3);
		expect(outcome).toMatchObject({
			analysisAuthority: 'NONE',
			authorityTransfer: 'NONE',
			gateEffect: 'NONE',
			result: {
				capability: {
					facadeScope: GUARD_CLASSIFICATION_OVERLAY_REPORT_SCOPE,
					graphAuthority: 'NONE',
					status: 'PARTIAL'
				},
				currentness: { state: 'CURRENT_FOR_CAPTURED_SUBJECT' },
				selection: {
					commandDispatchTopology: 'NOT_CONSUMED',
					commandEventContractOverlay: 'NOT_CONSUMED'
				}
			},
			state: 'partial'
		});
		expect(outcome.result.facadeNonclaims).toBe(GUARD_CLASSIFICATION_OVERLAY_REPORT_NONCLAIMS);
		expect(outcome.result.coverage).toMatchObject({
			classifications: 1,
			occurrences: 1,
			reconciles: true
		});
		expect(outcome.result.evidence).toMatchObject({
			arrowObservation: { id: fixture.arrowObservation.id },
			commandHandlerGraph: { id: fixture.commandHandlerGraph.id },
			guardObservation: { id: fixture.guardObservation.id },
			overlay: { subjectId: fixture.subject.descriptor.subjectId },
			stateMachineGraph: { id: fixture.stateGraph.id },
			stateObservation: { id: fixture.stateObservation.id }
		});
		expect(observed.additionalArtifacts).toEqual(
			GUARD_ENFORCEMENT_LEDGER_REPORT_ADDITIONAL_ARTIFACT_PATHS
		);
		expect(observed.commandHandlerRequest).toEqual(fixture.commandHandlerRequest);
		for (const phase of [
			'REQUEST_BIND',
			'PREDECESSOR_PIPELINE',
			'GUARD_ARTIFACT_SET',
			'GUARD_ENFORCEMENT_LEDGER',
			'STATE_TOPOLOGY_OBSERVATION',
			'STATE_MACHINE_GRAPH',
			'GUARD_CLASSIFICATION_OVERLAY',
			'CURRENTNESS',
			'RESULT'
		])
			expect(
				progress
					.filter((event) => event.kind === 'REPORT_STAGE' && event.phase === phase)
					.map((event) => event.state)
			).toEqual(['STARTED', 'COMPLETED']);
		expect(progress.some((event) => event.kind === 'OVERLAY_BUILDER')).toBe(true);
		expect(progress.every((event, index) => event.sequence === index + 1)).toBe(true);
		const resultCompleted = progress.find(
			(event) =>
				event.kind === 'REPORT_STAGE' && event.phase === 'RESULT' && event.state === 'COMPLETED'
		);
		expect(resultCompleted?.observations).toContainEqual(
			expect.objectContaining({
				metric: 'RESULT_BYTES',
				value: Buffer.byteLength(canonicalSemanticJson(outcome), 'utf8') + 1
			})
		);
	});

	it('classifies each injected producer and validation-stage failure deterministically', async () => {
		const diagnostic = (code: string) => ({
			code,
			message: `Synthetic ${code}.`,
			path: null,
			phase: 'REQUEST',
			severity: 'ERROR'
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
		const run = (overrides: Partial<GuardClassificationOverlayReportRuntimeDependencies>) =>
			runGuardClassificationOverlayReportWithDependencies(
				request(),
				{ repositoryRoot: fixture.root },
				dependencies(overrides)
			);

		const predecessorUnavailable = await run({
			captureHandler: (async () => ({
				code: 'SYNTHETIC_PREDECESSOR_UNAVAILABLE',
				diagnostics: [
					{
						...diagnostic('SYNTHETIC_PREDECESSOR_DIAGNOSTIC'),
						predecessorSource: null,
						source: 'REPORT'
					}
				],
				outcome: 'unavailable',
				stage: 'SUBJECT',
				state: 'failed'
			})) as unknown as GuardClassificationOverlayReportRuntimeDependencies['captureHandler']
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

		for (const [code, state] of [
			['BUDGET_EXHAUSTED', 'resource-refused'],
			['REQUEST_INVALID', 'incompatible'],
			['POPULATION_RECONCILIATION_FAILED', 'failed']
		] as const) {
			const outcome = await run({
				buildGuardArtifactSet: (() => ({
					diagnostics: [diagnostic(code)],
					outcome: 'unavailable'
				})) as GuardClassificationOverlayReportRuntimeDependencies['buildGuardArtifactSet']
			});
			expect(outcome).toMatchObject({
				code: 'GUARD_ARTIFACT_SET_UNAVAILABLE',
				outcome: 'unavailable',
				stage: 'GUARD_ARTIFACT_SET',
				state
			});
		}

		const projectedGuardArtifactDiagnostics = await run({
			buildGuardArtifactSet: (() => ({
				diagnostics: [
					'fixture/relative.ts',
					'../escape',
					'$.budgets',
					'$request.budgets.maxArtifacts',
					'$request.unsupported'
				].map((path) => ({
					...diagnostic('POPULATION_RECONCILIATION_FAILED'),
					path
				})),
				outcome: 'unavailable'
			})) as GuardClassificationOverlayReportRuntimeDependencies['buildGuardArtifactSet']
		});
		expect(projectedGuardArtifactDiagnostics).toMatchObject({
			code: 'GUARD_ARTIFACT_SET_UNAVAILABLE',
			diagnostics: expect.arrayContaining([
				expect.objectContaining({ path: 'fixture/relative.ts' }),
				expect.objectContaining({ path: '$.budgets.guardArtifactSet' }),
				expect.objectContaining({ path: '$.budgets.guardArtifactSet.maxArtifacts' }),
				expect.objectContaining({ path: null })
			]),
			state: 'failed'
		});

		for (const [validationState, state] of [
			['INVALID', 'failed'],
			['BUDGET_EXHAUSTED', 'resource-refused']
		] as const) {
			const outcome = await run({
				validateGuardArtifactSet: (() =>
					validation(
						validationState
					)) as GuardClassificationOverlayReportRuntimeDependencies['validateGuardArtifactSet']
			});
			expect(outcome).toMatchObject({
				code: 'GUARD_ARTIFACT_SET_VALIDATION_FAILED',
				outcome: 'unavailable',
				stage: 'GUARD_ARTIFACT_SET',
				state
			});
		}

		for (const [code, state] of [
			['BUDGET_EXHAUSTED', 'resource-refused'],
			['REQUEST_INVALID', 'incompatible'],
			['EXECUTOR_FAILED', 'failed']
		] as const) {
			const outcome = await run({
				observeGuard: (async () => ({
					diagnostics: [diagnostic(code)],
					outcome: 'unavailable'
				})) as GuardClassificationOverlayReportRuntimeDependencies['observeGuard']
			});
			expect(outcome).toMatchObject({
				code: 'GUARD_OBSERVATION_UNAVAILABLE',
				outcome: 'unavailable',
				stage: 'GUARD_ENFORCEMENT_LEDGER',
				state
			});
		}

		for (const [validationState, state] of [
			['INVALID', 'failed'],
			['BUDGET_EXHAUSTED', 'resource-refused']
		] as const) {
			const outcome = await run({
				validateGuardObservation: (() =>
					validation(
						validationState
					)) as GuardClassificationOverlayReportRuntimeDependencies['validateGuardObservation']
			});
			expect(outcome).toMatchObject({
				code: 'GUARD_OBSERVATION_VALIDATION_FAILED',
				outcome: 'unavailable',
				stage: 'GUARD_ENFORCEMENT_LEDGER',
				state
			});
		}

		for (const [code, state] of [
			['BUDGET_EXHAUSTED', 'resource-refused'],
			['REQUEST_INVALID', 'incompatible'],
			['MALFORMED_GENERATED_TABLE', 'failed']
		] as const) {
			const outcome = await run({
				observeState: (() => ({
					diagnostics: [diagnostic(code)],
					outcome: 'unavailable'
				})) as GuardClassificationOverlayReportRuntimeDependencies['observeState']
			});
			expect(outcome).toMatchObject({
				code: 'STATE_OBSERVATION_UNAVAILABLE',
				outcome: 'unavailable',
				stage: 'STATE_TOPOLOGY_OBSERVATION',
				state
			});
		}

		const invalidStateObservation = await run({
			validateStateObservation: (() =>
				validation(
					'INVALID'
				)) as GuardClassificationOverlayReportRuntimeDependencies['validateStateObservation']
		});
		expect(invalidStateObservation).toMatchObject({
			code: 'STATE_OBSERVATION_VALIDATION_FAILED',
			outcome: 'unavailable',
			stage: 'STATE_TOPOLOGY_OBSERVATION',
			state: 'failed'
		});

		for (const [code, state] of [
			['BUDGET_EXHAUSTED', 'resource-refused'],
			['REQUEST_INVALID', 'incompatible'],
			['GRAPH_VALIDATION_FAILED', 'failed']
		] as const) {
			const outcome = await run({
				buildStateGraph: (() => ({
					diagnostics: [diagnostic(code)],
					outcome: 'unavailable'
				})) as GuardClassificationOverlayReportRuntimeDependencies['buildStateGraph']
			});
			expect(outcome).toMatchObject({
				code: 'STATE_MACHINE_GRAPH_UNAVAILABLE',
				outcome: 'unavailable',
				stage: 'STATE_MACHINE_GRAPH',
				state
			});
		}
	});

	it('contains malformed forwarded telemetry and fails closed at selector, freshness, and internal boundaries', async () => {
		const nullOptions = await runGuardClassificationOverlayReport(null, null as never);
		expect(nullOptions).toMatchObject({ code: 'REQUEST_SHAPE_INVALID', stage: 'REQUEST' });

		const base = dependencies();
		const progress: GuardClassificationOverlayReportProgressEvent[] = [];
		const forwarded = await runGuardClassificationOverlayReportWithDependencies(
			request(),
			{
				onProgress(event) {
					progress.push(event);
					return Promise.reject(new Error('contained progress rejection'));
				},
				repositoryRoot: fixture.root
			},
			dependencies({
				async captureHandler(predecessorRequest, options) {
					options.onProgress?.({ detailCode: 'SYNTHETIC', state: 'COMPLETED' } as never);
					options.onProgress?.(1n as never);
					return base.captureHandler(predecessorRequest, options);
				},
				async observeGuard(guardRequest, inputs, options) {
					options?.onProgress?.({ phase: 'VALIDATE', state: 'COMPLETED' } as never);
					options?.onProgress?.(1n as never);
					return base.observeGuard(guardRequest, inputs, options);
				}
			})
		);
		expect(forwarded.outcome).toBe('partial');
		expect(progress.some((event) => event.kind === 'PREDECESSOR_REPORT')).toBe(true);
		expect(progress.some((event) => event.kind === 'GUARD_ADAPTER')).toBe(true);

		const selectorBase = dependencies();
		const selectorUnavailable = await runGuardClassificationOverlayReportWithDependencies(
			request(),
			{ repositoryRoot: fixture.root },
			dependencies({
				async captureHandler(predecessorRequest, options) {
					const captured = await selectorBase.captureHandler(predecessorRequest, options);
					if (captured.outcome !== 'captured') return captured;
					const semanticSnapshot = structuredClone(captured.semanticSnapshot);
					Object.assign(semanticSnapshot, {
						sources: semanticSnapshot.sources.filter(
							(source) => source.logicalPath !== 'packages/rph-contracts/src/messages.ts'
						)
					});
					return { ...captured, semanticSnapshot };
				},
				validateHandlerGraph: (() => ({
					issues: [],
					state: 'VALID'
				})) as GuardClassificationOverlayReportRuntimeDependencies['validateHandlerGraph']
			})
		);
		expect(selectorUnavailable).toMatchObject({
			code: 'REGISTRY_SELECTION_UNAVAILABLE',
			stage: 'GUARD_CLASSIFICATION_OVERLAY',
			state: 'incompatible'
		});

		const sourceBase = dependencies();
		const stateSourceUnavailable = await runGuardClassificationOverlayReportWithDependencies(
			request(),
			{ repositoryRoot: fixture.root },
			dependencies({
				async captureHandler(predecessorRequest, options) {
					const captured = await sourceBase.captureHandler(predecessorRequest, options);
					if (captured.outcome !== 'captured') return captured;
					const semanticSnapshot = structuredClone(captured.semanticSnapshot);
					Object.assign(semanticSnapshot, {
						sources: semanticSnapshot.sources.filter(
							(source) => source.logicalPath !== 'packages/rph-domain/src/transitions.data.ts'
						)
					});
					return { ...captured, semanticSnapshot };
				},
				validateHandlerGraph: (() => ({
					issues: [],
					state: 'VALID'
				})) as GuardClassificationOverlayReportRuntimeDependencies['validateHandlerGraph']
			})
		);
		expect(stateSourceUnavailable).toMatchObject({
			code: 'STATE_SOURCE_BINDING_UNAVAILABLE',
			stage: 'STATE_TOPOLOGY_OBSERVATION',
			state: 'incompatible'
		});

		const missingArtifactBase = dependencies();
		const missingStateArtifact = await runGuardClassificationOverlayReportWithDependencies(
			request(),
			{ repositoryRoot: fixture.root },
			dependencies({
				buildGuardArtifactSet: (() => ({
					artifactSet: fixture.guardArtifactSet,
					diagnostics: [],
					outcome: 'complete'
				})) as GuardClassificationOverlayReportRuntimeDependencies['buildGuardArtifactSet'],
				async captureHandler(predecessorRequest, options) {
					const captured = await missingArtifactBase.captureHandler(predecessorRequest, options);
					if (captured.outcome !== 'captured') return captured;
					return {
						...captured,
						frozenSubject: {
							...captured.frozenSubject,
							artifacts: captured.frozenSubject.artifacts.filter(
								(artifact) => artifact.path !== 'packages/rph-domain/src/transitions.data.ts'
							)
						}
					};
				},
				observeGuard: (async () => ({
					diagnostics: [],
					observation: fixture.guardObservation,
					outcome: 'complete'
				})) as GuardClassificationOverlayReportRuntimeDependencies['observeGuard'],
				validateGuardArtifactSet: (() => ({
					issues: [],
					state: 'VALID'
				})) as GuardClassificationOverlayReportRuntimeDependencies['validateGuardArtifactSet'],
				validateGuardObservation: (() => ({
					issues: [],
					state: 'VALID'
				})) as GuardClassificationOverlayReportRuntimeDependencies['validateGuardObservation'],
				validateHandlerGraph: (() => ({
					issues: [],
					state: 'VALID'
				})) as GuardClassificationOverlayReportRuntimeDependencies['validateHandlerGraph'],
				validateObservation: (() => ({
					issues: [],
					state: 'VALID'
				})) as GuardClassificationOverlayReportRuntimeDependencies['validateObservation']
			})
		);
		expect(missingStateArtifact).toMatchObject({
			code: 'STATE_SOURCE_BINDING_UNAVAILABLE',
			stage: 'STATE_TOPOLOGY_OBSERVATION',
			state: 'incompatible'
		});

		const expectedEmptyBase = dependencies();
		const incompatibleSnapshotContract = await runGuardClassificationOverlayReportWithDependencies(
			request(),
			{ repositoryRoot: fixture.root },
			dependencies({
				buildOverlay: (() =>
					buildGuardClassificationOverlay(
						fixture.inputs
					)) as GuardClassificationOverlayReportRuntimeDependencies['buildOverlay'],
				async captureHandler(predecessorRequest, options) {
					const captured = await expectedEmptyBase.captureHandler(predecessorRequest, options);
					if (captured.outcome !== 'captured') return captured;
					return {
						...captured,
						semanticSnapshot: { ...captured.semanticSnapshot, expectedEmpty: true }
					};
				},
				validateHandlerGraph: (() => ({
					issues: [],
					state: 'VALID'
				})) as GuardClassificationOverlayReportRuntimeDependencies['validateHandlerGraph']
			})
		);
		expect(incompatibleSnapshotContract).toMatchObject({
			code: 'EVIDENCE_IDENTITY_MISMATCH',
			stage: 'RESULT',
			state: 'failed'
		});

		const freshnessUnavailable = await runGuardClassificationOverlayReportWithDependencies(
			request(),
			{ repositoryRoot: fixture.root },
			dependencies({
				verifySubject: (() => {
					throw new Error('synthetic freshness failure');
				}) as typeof verifyFrozenSubject
			})
		);
		expect(freshnessUnavailable).toMatchObject({
			outcome: 'partial',
			result: { currentness: { state: 'UNAVAILABLE' } }
		});

		const internalFailure = await runGuardClassificationOverlayReportWithDependencies(
			request(),
			{ repositoryRoot: fixture.root },
			dependencies({
				captureHandler: (async () => {
					throw new Error('synthetic predecessor failure');
				}) as GuardClassificationOverlayReportRuntimeDependencies['captureHandler']
			})
		);
		expect(internalFailure).toMatchObject({
			code: 'INTERNAL_FAILURE',
			stage: 'RESULT',
			state: 'failed'
		});
	});

	it('refuses full-output truncation and keeps a small terminal refusal envelope', async () => {
		const base = request();
		const outcome = await runGuardClassificationOverlayReportWithDependencies(
			request({ budgets: { ...base.budgets, maxResultBytes: 1 } }),
			{ repositoryRoot: fixture.root },
			dependencies()
		);
		expect(outcome).toMatchObject({
			analysisAuthority: 'NONE',
			code: 'RESULT_BUDGET_EXCEEDED',
			gateEffect: 'NONE',
			outcome: 'unavailable',
			stage: 'RESULT',
			state: 'resource-refused'
		});
		expect(guardClassificationOverlayReportExitCode(outcome)).toBe(3);
		expect(canonicalSemanticJson(outcome)).not.toContain('"overlay"');
	});

	it('rejects forged successful-stage envelopes before final currentness', async () => {
		const envelopeCases: readonly {
			readonly name: string;
			readonly overrides: Partial<GuardClassificationOverlayReportRuntimeDependencies>;
		}[] = [
			{
				name: 'guard artifact-set diagnostics',
				overrides: {
					buildGuardArtifactSet(requestValue, inputs) {
						const outcome = buildGuardEnforcementLedgerArtifactSet(requestValue, inputs);
						if (outcome.outcome !== 'complete') return outcome;
						return {
							...outcome,
							diagnostics: [
								{
									code: 'ARTIFACT_CLASSIFICATION_MISMATCH',
									message: 'synthetic forged success diagnostic',
									path: null,
									phase: 'CLASSIFY'
								}
							]
						};
					}
				}
			},
			{
				name: 'guard complete/partial classification',
				overrides: {
					async observeGuard() {
						return { diagnostics: [], observation: fixture.guardObservation, outcome: 'partial' };
					}
				}
			},
			{
				name: 'state observation diagnostics',
				overrides: {
					observeState(requestValue, options) {
						const outcome = observeStateMachineTopology(requestValue, options);
						if (outcome.outcome !== 'complete') return outcome;
						return {
							...outcome,
							diagnostics: [
								{
									code: 'MALFORMED_GENERATED_TABLE',
									message: 'synthetic forged success diagnostic',
									path: null,
									phase: 'PARSE'
								}
							]
						};
					}
				}
			},
			{
				name: 'state graph diagnostics',
				overrides: {
					buildStateGraph(requestValue, snapshot, observation) {
						const outcome = buildStateMachineGraph(requestValue, snapshot, observation);
						return outcome.outcome === 'partial' ? { ...outcome, diagnostics: [] } : outcome;
					}
				}
			},
			{
				name: 'overlay diagnostics',
				overrides: {
					buildOverlay(inputs, options) {
						const outcome = buildGuardClassificationOverlay(inputs, options);
						if (outcome.outcome !== 'partial') return outcome;
						return {
							...outcome,
							diagnostics: [
								{
									code: 'UNSUPPORTED_TRANSITION_JOIN',
									message: 'synthetic forged success diagnostic',
									path: null,
									phase: 'JOIN'
								}
							]
						};
					}
				}
			}
		];

		for (const testCase of envelopeCases) {
			let freshnessChecks = 0;
			const outcome = await runGuardClassificationOverlayReportWithDependencies(
				request(),
				{ repositoryRoot: fixture.root },
				dependencies({
					...testCase.overrides,
					verifySubject(subject, options) {
						freshnessChecks += 1;
						return verifyFrozenSubject(subject, options);
					}
				})
			);
			expect(outcome, testCase.name).toMatchObject({
				code: 'EVIDENCE_IDENTITY_MISMATCH',
				outcome: 'unavailable',
				stage: 'RESULT',
				state: 'failed'
			});
			expect(freshnessChecks, testCase.name).toBe(0);
		}
	}, 120_000);

	it('rejects a cloned semantic snapshot without the exact producer capability before final currentness', async () => {
		let freshnessChecks = 0;
		const outcome = await runGuardClassificationOverlayReportWithDependencies(
			request(),
			{ repositoryRoot: fixture.root },
			dependencies({
				async captureHandler(predecessorRequest) {
					return {
						artifactSet: fixture.arrowArtifactSet!,
						commandHandlerGraph: fixture.commandHandlerGraph,
						diagnostics: [],
						frozenSubject: fixture.subject,
						observation: fixture.arrowObservation,
						outcome: 'captured',
						predecessorStageOutcomes: predecessorStageOutcomes(),
						repositoryRoot: fixture.root,
						request: predecessorRequest as CommandHandlerGraphReportRequest,
						semanticSnapshot: Object.freeze(structuredClone(fixture.snapshot))
					};
				},
				verifySubject(subject, options) {
					freshnessChecks += 1;
					return verifyFrozenSubject(subject, options);
				}
			})
		);
		expect(outcome).toMatchObject({
			code: 'EVIDENCE_IDENTITY_MISMATCH',
			outcome: 'unavailable',
			stage: 'RESULT',
			state: 'failed'
		});
		expect(freshnessChecks).toBe(0);
	});

	it('detaches reconciled evidence before an injected currentness check can mutate retained products', async () => {
		let changedPaths: string[] | undefined;
		let mutableOverlay: GuardClassificationOverlaySnapshot | undefined;
		let mutableStateGraph: StateMachineGraphSnapshot | undefined;
		let observedRootLocator: string | undefined;
		let retainedCapture: CommandHandlerGraphReportPipelineCapture | undefined;
		const outcome = await runGuardClassificationOverlayReportWithDependencies(
			request(),
			{
				onProgress(event) {
					if (event.phase === 'CURRENTNESS' && event.state === 'COMPLETED')
						changedPaths?.push('mutated-during-progress');
				},
				repositoryRoot: fixture.root
			},
			dependencies({
				buildOverlay(inputs) {
					const built = buildGuardClassificationOverlay(inputs);
					if (built.outcome !== 'partial') return built;
					mutableOverlay = structuredClone(built.overlay);
					return { ...built, overlay: mutableOverlay };
				},
				async captureHandler(predecessorRequest) {
					retainedCapture = {
						artifactSet: fixture.arrowArtifactSet!,
						commandHandlerGraph: fixture.commandHandlerGraph,
						diagnostics: [],
						frozenSubject: fixture.subject,
						observation: fixture.arrowObservation,
						outcome: 'captured',
						predecessorStageOutcomes: predecessorStageOutcomes(),
						repositoryRoot: fixture.root,
						request: predecessorRequest as CommandHandlerGraphReportRequest,
						semanticSnapshot: fixture.snapshot
					};
					return retainedCapture;
				},
				buildStateGraph(requestValue, snapshot, observation) {
					const built = buildStateMachineGraph(requestValue, snapshot, observation);
					if (built.outcome !== 'partial') return built;
					mutableStateGraph = structuredClone(built.graph);
					return { ...built, graph: mutableStateGraph };
				},
				verifySubject(_subject, options) {
					if (
						mutableOverlay === undefined ||
						mutableStateGraph === undefined ||
						retainedCapture === undefined
					)
						throw new Error('Expected retained mutable products.');
					observedRootLocator = options.rootLocator;
					Object.assign(mutableOverlay.coverage, {
						classifications: mutableOverlay.coverage.classifications + 1
					});
					Object.assign(mutableStateGraph.coverage, {
						machineNodes: mutableStateGraph.coverage.machineNodes + 1
					});
					Object.assign(retainedCapture, {
						frozenSubject: Object.freeze({
							...fixture.subject,
							descriptor: Object.freeze({
								...fixture.subject.descriptor,
								subjectId: 'forged-subject-after-reconciliation'
							})
						}),
						repositoryRoot: 'forged-root-after-reconciliation',
						semanticSnapshot: Object.freeze({ ...fixture.snapshot, astNodes: [] })
					});
					changedPaths = ['fixture/original-change.ts'];
					queueMicrotask(() => changedPaths?.push('mutated-from-queued-microtask'));
					return {
						changedPaths,
						diagnostics: [
							{
								code: 'SUBJECT_CHANGED_DURING_RESOLUTION',
								message: `${fixture.root} changed during the synthetic currentness check.`,
								path: `${fixture.root}/fixture/original-change.ts`,
								phase: 'FRESHNESS',
								severity: 'WARNING'
							}
						],
						state: 'STALE'
					};
				}
			})
		);
		expect(outcome.outcome).toBe('partial');
		if (outcome.outcome !== 'partial') return;
		expect(outcome.result.evidence.overlay).not.toBe(mutableOverlay);
		expect(outcome.result.evidence.stateMachineGraph).not.toBe(mutableStateGraph);
		expect(outcome.subject.subjectId).toBe(fixture.subject.descriptor.subjectId);
		expect(outcome.result.semanticSnapshotSummary.astNodes).toBe(fixture.snapshot.astNodes.length);
		expect(outcome.result.currentness.changedPaths).toEqual(['fixture/original-change.ts']);
		expect(observedRootLocator).toBe(fixture.root);
		expect(JSON.stringify(outcome.diagnostics)).not.toContain(fixture.root);
		expect(outcome.result.evidence.overlay.coverage.classifications).toBe(1);
		expect(outcome.result.evidence.stateMachineGraph.coverage.machineNodes).toBe(
			fixture.stateGraph.coverage.machineNodes
		);
		expect(Object.isFrozen(outcome.result.evidence.overlay)).toBe(true);
		expect(Object.isFrozen(outcome.result.evidence.stateMachineGraph)).toBe(true);
		expect(mutableOverlay?.coverage.classifications).toBe(2);
		expect(mutableStateGraph?.coverage.machineNodes).toBe(
			fixture.stateGraph.coverage.machineNodes + 1
		);
		expect(changedPaths).toContain('mutated-during-progress');
	});

	it('fails closed on a forged injected state-graph product before final currentness', async () => {
		let freshnessChecks = 0;
		const outcome = await runGuardClassificationOverlayReportWithDependencies(
			request(),
			{ repositoryRoot: fixture.root },
			dependencies({
				buildStateGraph(requestValue, snapshot, observation) {
					const built = buildStateMachineGraph(requestValue, snapshot, observation);
					if (built.outcome !== 'partial') return built;
					const forged = structuredClone(built.graph);
					Object.assign(forged.coverage, { machineNodes: forged.coverage.machineNodes + 1 });
					return { ...built, graph: forged };
				},
				verifySubject(subject, options) {
					freshnessChecks += 1;
					return verifyFrozenSubject(subject, options);
				}
			})
		);
		expect(outcome).toMatchObject({
			code: 'GUARD_CLASSIFICATION_OVERLAY_UNAVAILABLE',
			outcome: 'unavailable',
			stage: 'GUARD_CLASSIFICATION_OVERLAY'
		});
		expect(freshnessChecks).toBe(0);
	});

	it('replays and validates with trusted implementations against forged injected evidence', async () => {
		const outcome = await runGuardClassificationOverlayReportWithDependencies(
			request(),
			{ repositoryRoot: fixture.root },
			dependencies({
				buildOverlay(inputs) {
					const built = buildGuardClassificationOverlay(inputs);
					if (built.outcome !== 'partial') return built;
					const forged = JSON.parse(
						canonicalSemanticJson(built.overlay)
					) as GuardClassificationOverlaySnapshot;
					Object.assign(forged.coverage, { classifications: forged.coverage.classifications + 1 });
					return { diagnostics: [], outcome: 'partial', overlay: forged };
				}
			})
		);
		expect(outcome).toMatchObject({
			code: 'EVIDENCE_IDENTITY_MISMATCH',
			outcome: 'unavailable',
			stage: 'RESULT',
			state: 'failed'
		});
		expect(guardClassificationOverlayReportExitCode(outcome)).toBe(4);
	});

	it.each([
		{
			expected: 'STALE',
			freshness: { changedPaths: ['fixture/tsconfig.json'], diagnostics: [], state: 'STALE' }
		},
		{
			expected: 'UNAVAILABLE',
			freshness: { changedPaths: [], diagnostics: [], state: 'UNAVAILABLE' }
		}
	] as const)(
		'retains captured overlay evidence when final currentness is $expected',
		async ({ expected, freshness }) => {
			const outcome = await runGuardClassificationOverlayReportWithDependencies(
				request(),
				{ repositoryRoot: fixture.root },
				dependencies({
					verifySubject: (() => freshness) as typeof verifyFrozenSubject
				})
			);
			expect(outcome).toMatchObject({
				outcome: 'partial',
				result: {
					coverage: { classifications: 1, occurrences: 1 },
					currentness: { state: expected }
				}
			});
		}
	);

	it('admits the exact LF-inclusive terminal size and refuses one byte below it', async () => {
		let limit = GUARD_CLASSIFICATION_OVERLAY_REPORT_SAFETY_CEILINGS.maxResultBytes;
		let exactOutcome;
		for (let attempt = 0; attempt < 8; attempt += 1) {
			const base = request();
			exactOutcome = await runGuardClassificationOverlayReportWithDependencies(
				request({ budgets: { ...base.budgets, maxResultBytes: limit } }),
				{ repositoryRoot: fixture.root },
				dependencies()
			);
			expect(exactOutcome.outcome, JSON.stringify(exactOutcome)).toBe('partial');
			const measured = Buffer.byteLength(canonicalSemanticJson(exactOutcome), 'utf8') + 1;
			if (measured === limit) break;
			limit = measured;
		}
		expect(exactOutcome?.outcome).toBe('partial');
		expect(Buffer.byteLength(canonicalSemanticJson(exactOutcome), 'utf8') + 1).toBe(limit);

		const base = request();
		const refused = await runGuardClassificationOverlayReportWithDependencies(
			request({ budgets: { ...base.budgets, maxResultBytes: limit - 1 } }),
			{ repositoryRoot: fixture.root },
			dependencies()
		);
		expect(refused).toMatchObject({
			code: 'RESULT_BUDGET_EXCEEDED',
			outcome: 'unavailable',
			stage: 'RESULT',
			state: 'resource-refused'
		});
	}, 120_000);

	it('contains progress sink exceptions without changing deterministic terminal evidence', async () => {
		const withThrowingSink = await runGuardClassificationOverlayReportWithDependencies(
			request(),
			{
				onProgress() {
					throw new Error('closed sink');
				},
				repositoryRoot: fixture.root
			},
			dependencies()
		);
		const withoutSink = await runGuardClassificationOverlayReportWithDependencies(
			request(),
			{ repositoryRoot: fixture.root },
			dependencies()
		);
		expect(withThrowingSink).toEqual(withoutSink);
	});
});
