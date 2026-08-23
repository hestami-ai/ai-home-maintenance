import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { CommandHandlerGraphReportRequest } from '../contracts/command-handler-graph-report.js';
import {
	ARROW_COMMAND_CENSUS_ARTIFACT_SET_OPERATION_VERSION,
	ARROW_COMMAND_CENSUS_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
	ARROW_COMMAND_CENSUS_OPERATION_VERSION,
	ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION,
	type ArrowCommandCensusArtifactSetBinding
} from '../contracts/arrow-command-census.js';
import {
	COMMAND_HANDLER_GRAPH_OPERATION_VERSION,
	COMMAND_HANDLER_GRAPH_REQUEST_SCHEMA_VERSION,
	type BuildCommandHandlerGraphRequest,
	type CommandHandlerGraphSnapshot
} from '../contracts/command-handler-graph.js';
import {
	COMMAND_EVENT_CONTRACT_OVERLAY_OPERATION_VERSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_PROGRESS_SCHEMA_VERSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_REQUEST_SCHEMA_VERSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH,
	COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH,
	type CommandEventContractOverlayBuildInputs,
	type CommandEventContractOverlaySnapshot
} from '../contracts/command-event-contract-overlay.js';
import {
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_EXECUTION_SELECTION,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_OPERATION_VERSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROJECT_CONFIG_PATHS,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_REQUEST_SCHEMA_VERSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SAFETY_CEILINGS,
	type CommandEventContractOverlayReportRequest
} from '../contracts/command-event-contract-overlay-report.js';
import {
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_REQUEST_SCHEMA_VERSION,
	type StaticSemanticSnapshot
} from '../contracts/semantic.js';
import {
	SUBJECT_POLICY_VERSION,
	SUBJECT_REQUEST_SCHEMA_VERSION,
	type FrozenSubject
} from '../contracts/subject.js';
import {
	buildCommandEventContractOverlay,
	selectJpwbCommandEventContractOverlayInputs
} from '../graph/build-command-event-contract-overlay.js';
import {
	buildCommandHandlerGraph,
	selectJpwbCommandHandlerRegistries
} from '../graph/build-command-handler-graph.js';
import {
	createCommandEventContractOverlayFixture,
	type CommandEventContractOverlayFixture
} from '../graph/command-event-contract-overlay-fixture.test-support.js';
import {
	ARROW_COMMAND_CENSUS_RETAINED_VERIFIER_PATHS,
	buildArrowCommandCensusArtifactSet
} from '../providers/jpwb-arrow-command-census/artifact-set.js';
import { normalizeArrowCommandCensusObservation } from '../providers/jpwb-arrow-command-census/normalize-arrow-command-census.js';
import { buildStaticSemanticSnapshot } from '../semantic/build-static-semantic-snapshot.js';
import { canonicalSemanticJson, canonicalSemanticJsonWitness } from '../semantic/canonical.js';
import { resolveSubject } from '../subject/resolve-subject.js';
import type { CommandHandlerGraphReportPipelineCapture } from './run-command-handler-graph-report.js';
import {
	admitCommandEventContractOverlayReportRequest,
	commandEventContractOverlayReportExitCode,
	runCommandEventContractOverlayReportWithDependencies,
	type CommandEventContractOverlayReportProgressEvent,
	type CommandEventContractOverlayReportRuntimeDependencies
} from './run-command-event-contract-overlay-report.js';

interface ReportFixture {
	readonly arrowArtifactSet: ArrowCommandCensusArtifactSetBinding;
	readonly base: CommandEventContractOverlayFixture;
	readonly commandHandlerGraph: CommandHandlerGraphSnapshot;
	readonly commandHandlerRequest: BuildCommandHandlerGraphRequest;
	readonly inputs: CommandEventContractOverlayBuildInputs;
	readonly root: string;
	readonly snapshot: StaticSemanticSnapshot;
	readonly subject: FrozenSubject;
}

function addFixedReportProjectClosure(root: string): void {
	for (const directory of ['rph-assurance', 'rph-persistence', 'rph-ports', 'rph-projections']) {
		const packageRoot = join(root, 'packages', directory);
		mkdirSync(join(packageRoot, 'src'), { recursive: true });
		writeFileSync(
			join(packageRoot, 'package.json'),
			JSON.stringify({
				name: '@fixture/' + directory,
				private: true,
				type: 'module',
				version: '0.0.0'
			}) + '\n',
			'utf8'
		);
		writeFileSync(join(packageRoot, 'src', 'index.ts'), 'export {};\n', 'utf8');
		writeFileSync(
			join(packageRoot, 'tsconfig.json'),
			JSON.stringify({
				compilerOptions: {
					module: 'NodeNext',
					moduleResolution: 'NodeNext',
					noEmit: true,
					noLib: true,
					strict: true,
					target: 'ES2022'
				},
				files: ['src/index.ts']
			}) + '\n',
			'utf8'
		);
	}
}

function reportFixture(extraArtifacts: readonly string[] = []): ReportFixture {
	const base = createCommandEventContractOverlayFixture();
	try {
		addFixedReportProjectClosure(base.root);
		const subjectOutcome = resolveSubject({
			budgets: base.subject.request.budgets,
			expectEmpty: false,
			filters: { exclude: [], include: [] },
			operationVersion: 'command-event-contract-overlay-report-fixture/1.0.0',
			outputs: [],
			policyVersion: SUBJECT_POLICY_VERSION,
			rootLocator: base.root,
			schemaVersion: SUBJECT_REQUEST_SCHEMA_VERSION,
			scope: {
				additionalArtifacts: [
					...ARROW_COMMAND_CENSUS_RETAINED_VERIFIER_PATHS,
					COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH,
					COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH,
					...extraArtifacts
				],
				kind: 'EXPLICIT_PROJECTS',
				projects: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROJECT_CONFIG_PATHS
			},
			subjectKind: 'WORKTREE'
		});
		if (subjectOutcome.outcome !== 'resolved')
			throw new Error('Report subject fixture failed: ' + JSON.stringify(subjectOutcome));
		const subject = subjectOutcome.subject;
		const semanticOutcome = buildStaticSemanticSnapshot(
			{
				assignabilityRequests: [],
				budgets: base.snapshot.budgets,
				capabilities: ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'],
				expectEmpty: false,
				operationVersion: SEMANTIC_OPERATION_VERSION,
				rootLocator: base.root,
				schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
				subjectId: subject.descriptor.subjectId
			},
			{ subject }
		);
		if (semanticOutcome.outcome === 'unavailable' || semanticOutcome.outcome === 'incompatible')
			throw new Error('Report semantic fixture failed: ' + JSON.stringify(semanticOutcome));
		const snapshot = semanticOutcome.snapshot;
		const artifactSetOutcome = buildArrowCommandCensusArtifactSet(
			{
				budgets: {
					maxArtifacts: subject.artifacts.length + 1,
					maxDiagnostics: 1_000,
					maxTotalBytes: subject.artifacts.reduce((sum, artifact) => sum + artifact.bytes, 0) + 1
				},
				operationVersion: ARROW_COMMAND_CENSUS_ARTIFACT_SET_OPERATION_VERSION,
				schemaVersion: ARROW_COMMAND_CENSUS_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
				subjectId: subject.descriptor.subjectId
			},
			{ subject }
		);
		if (artifactSetOutcome.outcome !== 'complete')
			throw new Error('Arrow artifact fixture failed: ' + JSON.stringify(artifactSetOutcome));
		const arrowArtifactSet = artifactSetOutcome.artifactSet;
		const observation = normalizeArrowCommandCensusObservation({
			artifactSet: arrowArtifactSet,
			evidence: base.observation.rawEvidence,
			executor: base.observation.executor,
			request: {
				artifactSetId: arrowArtifactSet.id,
				budgets: base.observation.budgets,
				operationVersion: ARROW_COMMAND_CENSUS_OPERATION_VERSION,
				schemaVersion: ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION,
				subjectId: subject.descriptor.subjectId
			}
		}).observation;
		const registries = selectJpwbCommandHandlerRegistries(snapshot);
		const commandHandlerRequest: BuildCommandHandlerGraphRequest = {
			arrowObservationId: observation.id,
			budgets: base.graphRequest.budgets,
			commandRegistry: registries.commandRegistry,
			handlerRegistry: registries.handlerRegistry,
			operationVersion: COMMAND_HANDLER_GRAPH_OPERATION_VERSION,
			schemaVersion: COMMAND_HANDLER_GRAPH_REQUEST_SCHEMA_VERSION,
			semanticSnapshotId: snapshot.id,
			subjectId: subject.descriptor.subjectId
		};
		const graphOutcome = buildCommandHandlerGraph(
			commandHandlerRequest,
			snapshot,
			observation,
			subject
		);
		if (graphOutcome.outcome !== 'partial')
			throw new Error('Command-handler fixture failed: ' + JSON.stringify(graphOutcome));
		const commandHandlerGraph = graphOutcome.graph;
		const selection = selectJpwbCommandEventContractOverlayInputs(snapshot, subject);
		const overlayRequest = {
			arrowObservationId: observation.id,
			budgets: base.request.budgets,
			commandHandlerGraphId: commandHandlerGraph.id,
			commandRegistry: selection.commandRegistry,
			eventRegistry: selection.eventRegistry,
			operationVersion: COMMAND_EVENT_CONTRACT_OVERLAY_OPERATION_VERSION,
			retainedCensusArtifact: selection.retainedCensusArtifact,
			schemaVersion: COMMAND_EVENT_CONTRACT_OVERLAY_REQUEST_SCHEMA_VERSION,
			semanticSnapshotId: snapshot.id,
			subjectId: subject.descriptor.subjectId,
			vocabArtifact: selection.vocabArtifact
		};
		return {
			arrowArtifactSet,
			base,
			commandHandlerGraph,
			commandHandlerRequest,
			inputs: {
				arrowObservation: observation,
				commandHandlerGraph,
				commandHandlerRequest,
				request: overlayRequest,
				semanticSnapshot: snapshot,
				subject
			},
			root: base.root,
			snapshot,
			subject
		};
	} catch (error) {
		base.cleanup();
		throw error;
	}
}

let fixture: ReportFixture;
const OVERLAY_BUDGET_KEYS = [
	'maxAstNodes',
	'maxBoundContributions',
	'maxCommands',
	'maxDeclaredLinks',
	'maxDiagnostics',
	'maxEventContracts',
	'maxFrontiers',
	'maxPinnedEmissions',
	'maxSourceBytes'
] as const;

function request(
	overrides: Partial<CommandEventContractOverlayReportRequest> = {}
): CommandEventContractOverlayReportRequest {
	return {
		budgets: {
			artifactSet: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SAFETY_CEILINGS.artifactSet,
			commandEventContractOverlay: fixture.inputs.request.budgets,
			commandHandlerGraph: fixture.commandHandlerRequest.budgets,
			maxResultBytes: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SAFETY_CEILINGS.maxResultBytes,
			observation: fixture.inputs.arrowObservation.budgets,
			semantic: fixture.snapshot.budgets,
			subject: fixture.subject.request.budgets
		},
		executionSelection: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_EXECUTION_SELECTION,
		operationVersion: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_OPERATION_VERSION,
		schemaVersion: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROJECT_CONFIG_PATHS,
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
	overrides: Partial<CommandEventContractOverlayReportRuntimeDependencies> = {}
): CommandEventContractOverlayReportRuntimeDependencies {
	return {
		buildOverlay: buildCommandEventContractOverlay,
		async captureHandler(predecessorRequest, options) {
			expect(options.additionalArtifacts).toEqual([
				COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH,
				COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH
			]);
			return {
				artifactSet: fixture.arrowArtifactSet,
				commandHandlerGraph: fixture.commandHandlerGraph,
				diagnostics: [],
				frozenSubject: fixture.subject,
				observation: fixture.inputs.arrowObservation,
				outcome: 'captured',
				predecessorStageOutcomes: predecessorStageOutcomes(),
				repositoryRoot: fixture.root,
				request: predecessorRequest as CommandHandlerGraphReportRequest,
				semanticSnapshot: fixture.snapshot
			};
		},
		verifySubject() {
			return { changedPaths: [], diagnostics: [], state: 'CURRENT' };
		},
		...overrides
	};
}

beforeAll(() => {
	fixture = reportFixture();
});

afterAll(() => {
	fixture?.base.cleanup();
});

describe('runCommandEventContractOverlayReport', { timeout: 60_000 }, () => {
	it('admits only the exact fixed closure and actual bounded overlay budgets', () => {
		expect(admitCommandEventContractOverlayReportRequest(request())).toMatchObject({
			outcome: 'admitted'
		});
		expect(
			admitCommandEventContractOverlayReportRequest({ ...request(), unexpected: true })
		).toMatchObject({ code: 'REQUEST_SHAPE_INVALID', outcome: 'rejected' });
		expect(
			admitCommandEventContractOverlayReportRequest({
				...request(),
				subjectProjectConfigPaths: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROJECT_CONFIG_PATHS.slice(
					0,
					-1
				)
			})
		).toMatchObject({ code: 'REQUIRED_PROJECT_CLOSURE_MISMATCH', outcome: 'rejected' });
		const over = request();
		for (const key of OVERLAY_BUDGET_KEYS)
			expect(
				admitCommandEventContractOverlayReportRequest({
					...over,
					budgets: {
						...over.budgets,
						commandEventContractOverlay: {
							...over.budgets.commandEventContractOverlay,
							[key]:
								COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SAFETY_CEILINGS.commandEventContractOverlay[
									key
								] + 1
						}
					}
				})
			).toMatchObject({
				code: 'REQUEST_BUDGET_EXCEEDS_SAFETY_CEILING',
				outcome: 'rejected',
				path: '$.budgets.commandEventContractOverlay.' + key,
				state: 'resource-refused'
			});
		const accessorBudgets = { ...over.budgets.commandEventContractOverlay };
		Object.defineProperty(accessorBudgets, 'maxCommands', { enumerable: true, get: () => 1 });
		expect(
			admitCommandEventContractOverlayReportRequest({
				...over,
				budgets: { ...over.budgets, commandEventContractOverlay: accessorBudgets }
			})
		).toMatchObject({ code: 'REQUEST_SHAPE_INVALID', outcome: 'rejected' });
		expect(admitCommandEventContractOverlayReportRequest(new Proxy(request(), {}))).toMatchObject({
			code: 'REQUEST_SHAPE_INVALID',
			outcome: 'rejected'
		});
	});

	it('returns one bounded same-subject partial overlay with forwarded progress', async () => {
		const progress: CommandEventContractOverlayReportProgressEvent[] = [];
		const outcome = await runCommandEventContractOverlayReportWithDependencies(
			request(),
			{ onProgress: (event) => progress.push(event), repositoryRoot: fixture.root },
			dependencies()
		);
		expect(outcome.outcome).toBe('partial');
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		expect(outcome.result.coverage).toMatchObject(fixture.base.expectedCoverage);
		expect(outcome.result.evidence.overlay.coverage).toEqual(fixture.base.expectedCoverage);
		expect(outcome.result.evidence.arrowObservation.id).toBe(fixture.inputs.arrowObservation.id);
		expect(outcome.result.evidence.commandHandlerGraph.id).toBe(fixture.commandHandlerGraph.id);
		expect(outcome.result.evidence.encoding).toContain('RETAINED_ARROW_COMMAND_HANDLER');
		expect(outcome.result.currentness.state).toBe('CURRENT_FOR_CAPTURED_SUBJECT');
		expect(outcome.result.selection.commandDispatchTopology).toBe('NOT_CONSUMED');
		expect(outcome.result.selection.guardClassificationOverlay).toBe('NOT_CONSUMED');
		expect(progress.some((event) => event.kind === 'OVERLAY_BUILDER')).toBe(true);
		expect(
			progress.at(-1),
			JSON.stringify(progress.map((event) => [event.kind, event.phase, event.state]))
		).toMatchObject({ phase: 'RESULT', state: 'COMPLETED' });
		expect(commandEventContractOverlayReportExitCode(outcome)).toBe(3);
	});

	it('detaches evidence before the overlay-completion callback can mutate injected products', async () => {
		let injectedOverlay: CommandEventContractOverlaySnapshot | undefined;
		const injectedGraph = structuredClone(
			fixture.commandHandlerGraph
		) as CommandHandlerGraphSnapshot;
		const custom = dependencies({
			buildOverlay(inputs, options) {
				const built = buildCommandEventContractOverlay(inputs, options);
				if (built.outcome !== 'partial') return built;
				injectedOverlay = structuredClone(built.overlay) as CommandEventContractOverlaySnapshot;
				return { diagnostics: [], outcome: 'partial', overlay: injectedOverlay };
			},
			async captureHandler(predecessorRequest) {
				return {
					artifactSet: fixture.arrowArtifactSet,
					commandHandlerGraph: injectedGraph,
					diagnostics: [],
					frozenSubject: fixture.subject,
					observation: fixture.inputs.arrowObservation,
					outcome: 'captured',
					predecessorStageOutcomes: predecessorStageOutcomes(),
					repositoryRoot: fixture.root,
					request: predecessorRequest as CommandHandlerGraphReportRequest,
					semanticSnapshot: fixture.snapshot
				};
			}
		});
		const outcome = await runCommandEventContractOverlayReportWithDependencies(
			request(),
			{
				onProgress(event) {
					if (
						event.kind === 'REPORT_STAGE' &&
						event.phase === 'COMMAND_EVENT_CONTRACT_OVERLAY' &&
						event.state === 'COMPLETED'
					) {
						if (injectedOverlay !== undefined)
							(injectedOverlay.coverage as { commands: number }).commands = 999;
						(injectedGraph.nodes as unknown as unknown[]).length = 0;
					}
				},
				repositoryRoot: fixture.root
			},
			custom
		);
		expect(outcome.outcome).toBe('partial');
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		expect(outcome.result.evidence.overlay.coverage.commands).toBe(
			fixture.base.expectedCoverage.commands
		);
		expect(outcome.result.evidence.commandHandlerGraph.nodes.length).toBe(
			fixture.commandHandlerGraph.nodes.length
		);
	});

	it('rejects a cloned semantic snapshot without the validated producer capability', async () => {
		const outcome = await runCommandEventContractOverlayReportWithDependencies(
			request(),
			{ repositoryRoot: fixture.root },
			dependencies({
				async captureHandler(predecessorRequest) {
					return {
						artifactSet: fixture.arrowArtifactSet,
						commandHandlerGraph: fixture.commandHandlerGraph,
						diagnostics: [],
						frozenSubject: fixture.subject,
						observation: fixture.inputs.arrowObservation,
						outcome: 'captured',
						predecessorStageOutcomes: predecessorStageOutcomes(),
						repositoryRoot: fixture.root,
						request: predecessorRequest as CommandHandlerGraphReportRequest,
						semanticSnapshot: structuredClone(fixture.snapshot)
					};
				}
			})
		);
		expect(outcome).toMatchObject({
			code: 'PREDECESSOR_VALIDATION_FAILED',
			outcome: 'unavailable',
			stage: 'PREDECESSOR_PIPELINE',
			state: 'failed'
		});
	});

	it('discloses stale captured-subject currentness without changing overlay evidence', async () => {
		const outcome = await runCommandEventContractOverlayReportWithDependencies(
			request(),
			{ repositoryRoot: fixture.root },
			dependencies({
				verifySubject() {
					return {
						changedPaths: ['packages/rph-contracts/src/messages.ts'],
						diagnostics: [],
						state: 'STALE'
					};
				}
			})
		);
		expect(outcome.outcome).toBe('partial');
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		expect(outcome.result.currentness).toMatchObject({
			changedPaths: ['packages/rph-contracts/src/messages.ts'],
			scope: 'SELECTED_CAPTURED_SUBJECT_ONLY',
			state: 'STALE'
		});
		expect(outcome.result.evidence.overlay.coverage).toEqual(fixture.base.expectedCoverage);
	});

	it('rejects injected valid-looking overlay evidence that differs from trusted derivation', async () => {
		const outcome = await runCommandEventContractOverlayReportWithDependencies(
			request(),
			{ repositoryRoot: fixture.root },
			dependencies({
				buildOverlay(inputs) {
					const built = buildCommandEventContractOverlay(inputs);
					if (built.outcome !== 'partial') return built;
					const forged = structuredClone(built.overlay) as CommandEventContractOverlaySnapshot;
					(forged.coverage as { commands: number }).commands += 1;
					return { diagnostics: [], outcome: 'partial', overlay: forged };
				}
			})
		);
		expect(outcome).toMatchObject({
			code: 'EVIDENCE_IDENTITY_MISMATCH',
			outcome: 'unavailable',
			stage: 'COMMAND_EVENT_CONTRACT_OVERLAY',
			state: 'failed'
		});
	});

	it('rejects forged artifact closure and command-handler request, id, digest, or selector bindings', async () => {
		const extraArtifactFixture = reportFixture(['bun.lock']);
		try {
			const extraArtifactOutcome = await runCommandEventContractOverlayReportWithDependencies(
				request(),
				{ repositoryRoot: extraArtifactFixture.root },
				dependencies({
					async captureHandler(predecessorRequest) {
						return {
							artifactSet: extraArtifactFixture.arrowArtifactSet,
							commandHandlerGraph: extraArtifactFixture.commandHandlerGraph,
							diagnostics: [],
							frozenSubject: extraArtifactFixture.subject,
							observation: extraArtifactFixture.inputs.arrowObservation,
							outcome: 'captured',
							predecessorStageOutcomes: predecessorStageOutcomes(),
							repositoryRoot: extraArtifactFixture.root,
							request: predecessorRequest as CommandHandlerGraphReportRequest,
							semanticSnapshot: extraArtifactFixture.snapshot
						};
					}
				})
			);
			expect(extraArtifactOutcome).toMatchObject({
				code: 'PREDECESSOR_VALIDATION_FAILED',
				stage: 'PREDECESSOR_PIPELINE'
			});
		} finally {
			extraArtifactFixture.base.cleanup();
		}

		const graphMutations: Array<(graph: CommandHandlerGraphSnapshot) => void> = [
			(graph) => {
				(graph as unknown as { id: string }).id = 'command-handler-graph:forged';
			},
			(graph) => {
				(graph as unknown as { graphInputDigest: string }).graphInputDigest = '0'.repeat(64);
			},
			(graph) => {
				(graph as unknown as { commandRegistry: Record<string, unknown> }).commandRegistry = {
					...graph.commandRegistry,
					declarationId: 'declaration:forged'
				};
			}
		];
		for (const mutate of graphMutations) {
			const forgedGraph = structuredClone(
				fixture.commandHandlerGraph
			) as CommandHandlerGraphSnapshot;
			mutate(forgedGraph);
			const forged = await runCommandEventContractOverlayReportWithDependencies(
				request(),
				{ repositoryRoot: fixture.root },
				dependencies({
					async captureHandler(predecessorRequest) {
						return {
							artifactSet: fixture.arrowArtifactSet,
							commandHandlerGraph: forgedGraph,
							diagnostics: [],
							frozenSubject: fixture.subject,
							observation: fixture.inputs.arrowObservation,
							outcome: 'captured',
							predecessorStageOutcomes: predecessorStageOutcomes(),
							repositoryRoot: fixture.root,
							request: predecessorRequest as CommandHandlerGraphReportRequest,
							semanticSnapshot: fixture.snapshot
						};
					}
				})
			);
			expect(forged).toMatchObject({
				code: 'PREDECESSOR_VALIDATION_FAILED',
				stage: 'PREDECESSOR_PIPELINE'
			});
		}
		const forgedRequest = await runCommandEventContractOverlayReportWithDependencies(
			request(),
			{ repositoryRoot: fixture.root },
			dependencies({
				async captureHandler(predecessorRequest) {
					const admitted = predecessorRequest as CommandHandlerGraphReportRequest;
					return {
						artifactSet: fixture.arrowArtifactSet,
						commandHandlerGraph: fixture.commandHandlerGraph,
						diagnostics: [],
						frozenSubject: fixture.subject,
						observation: fixture.inputs.arrowObservation,
						outcome: 'captured',
						predecessorStageOutcomes: predecessorStageOutcomes(),
						repositoryRoot: fixture.root,
						request: {
							...admitted,
							subjectProjectConfigPaths: [...admitted.subjectProjectConfigPaths].reverse()
						} as CommandHandlerGraphReportRequest,
						semanticSnapshot: fixture.snapshot
					};
				}
			})
		);
		expect(forgedRequest).toMatchObject({
			code: 'PREDECESSOR_VALIDATION_FAILED',
			stage: 'PREDECESSOR_PIPELINE'
		});
	});

	it('rejects self-consistent observations with forged executor-source or budget bindings', async () => {
		const variants = [
			{
				budgets: fixture.inputs.arrowObservation.budgets,
				executor: {
					...fixture.inputs.arrowObservation.executor,
					retainedVerifierCanonicalPathKey: 'forged/executor-source.ts',
					retainedVerifierSha256: 'f'.repeat(64)
				}
			},
			{
				budgets: {
					...fixture.inputs.arrowObservation.budgets,
					maxDeclaredArrowOccurrences:
						fixture.inputs.arrowObservation.budgets.maxDeclaredArrowOccurrences + 1
				},
				executor: fixture.inputs.arrowObservation.executor
			}
		];
		for (const variant of variants) {
			const forgedObservation = normalizeArrowCommandCensusObservation({
				artifactSet: fixture.arrowArtifactSet,
				evidence: fixture.inputs.arrowObservation.rawEvidence,
				executor: variant.executor,
				request: {
					artifactSetId: fixture.arrowArtifactSet.id,
					budgets: variant.budgets,
					operationVersion: ARROW_COMMAND_CENSUS_OPERATION_VERSION,
					schemaVersion: ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION,
					subjectId: fixture.subject.descriptor.subjectId
				}
			}).observation;
			const graphRequest: BuildCommandHandlerGraphRequest = {
				...fixture.commandHandlerRequest,
				arrowObservationId: forgedObservation.id
			};
			const graphOutcome = buildCommandHandlerGraph(
				graphRequest,
				fixture.snapshot,
				forgedObservation,
				fixture.subject
			);
			expect(graphOutcome.outcome).toBe('partial');
			if (graphOutcome.outcome !== 'partial') throw new Error(JSON.stringify(graphOutcome));
			const outcome = await runCommandEventContractOverlayReportWithDependencies(
				request(),
				{ repositoryRoot: fixture.root },
				dependencies({
					async captureHandler(predecessorRequest) {
						return {
							artifactSet: fixture.arrowArtifactSet,
							commandHandlerGraph: graphOutcome.graph,
							diagnostics: [],
							frozenSubject: fixture.subject,
							observation: forgedObservation,
							outcome: 'captured',
							predecessorStageOutcomes: predecessorStageOutcomes(),
							repositoryRoot: fixture.root,
							request: predecessorRequest as CommandHandlerGraphReportRequest,
							semanticSnapshot: fixture.snapshot
						};
					}
				})
			);
			expect(outcome).toMatchObject({
				code: 'PREDECESSOR_VALIDATION_FAILED',
				outcome: 'unavailable',
				stage: 'PREDECESSOR_PIPELINE',
				state: 'failed'
			});
		}
	});

	it('counts the terminal LF exactly and refuses one byte below the complete report', async () => {
		const withMax = (maxResultBytes: number) => {
			const baseRequest = request();
			return runCommandEventContractOverlayReportWithDependencies(
				{
					...baseRequest,
					budgets: { ...baseRequest.budgets, maxResultBytes }
				},
				{ repositoryRoot: fixture.root },
				dependencies()
			);
		};
		let exact = COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SAFETY_CEILINGS.maxResultBytes;
		for (let iteration = 0; iteration < 4; iteration += 1) {
			const candidate = await withMax(exact);
			expect(candidate.outcome).toBe('partial');
			const bytes = canonicalSemanticJsonWitness(candidate).bytes + 1;
			if (bytes === exact) break;
			exact = bytes;
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

	it('maps builder unavailability without promoting its authority', async () => {
		const outcome = await runCommandEventContractOverlayReportWithDependencies(
			request(),
			{ repositoryRoot: fixture.root },
			dependencies({
				buildOverlay() {
					return {
						diagnostics: [
							{
								code: 'UNSUPPORTED_VOCAB',
								message: 'Synthetic unsupported vocab.',
								path: COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH,
								phase: 'PARSE'
							}
						],
						outcome: 'unavailable'
					};
				}
			})
		);
		expect(outcome).toMatchObject({
			code: 'COMMAND_EVENT_CONTRACT_OVERLAY_UNAVAILABLE',
			outcome: 'unavailable',
			stage: 'COMMAND_EVENT_CONTRACT_OVERLAY',
			state: 'incompatible'
		});
		expect(outcome.diagnostics).toContainEqual(
			expect.objectContaining({
				code: 'UNSUPPORTED_VOCAB',
				source: 'COMMAND_EVENT_CONTRACT_OVERLAY'
			})
		);
	});

	it('is deterministic and contains throwing or rejecting progress callbacks', async () => {
		const first = await runCommandEventContractOverlayReportWithDependencies(
			request(),
			{ repositoryRoot: fixture.root },
			dependencies()
		);
		const second = await runCommandEventContractOverlayReportWithDependencies(
			request(),
			{ repositoryRoot: fixture.root },
			dependencies()
		);
		expect(canonicalSemanticJson(second)).toBe(canonicalSemanticJson(first));
		const throwing = await runCommandEventContractOverlayReportWithDependencies(
			request(),
			{
				onProgress() {
					throw new Error('synthetic telemetry failure');
				},
				repositoryRoot: fixture.root
			},
			dependencies()
		);
		expect(throwing.outcome).toBe('partial');
		const rejecting = await runCommandEventContractOverlayReportWithDependencies(
			request(),
			{
				onProgress() {
					return Promise.reject(new Error('synthetic telemetry rejection'));
				},
				repositoryRoot: fixture.root
			},
			dependencies()
		);
		expect(rejecting.outcome).toBe('partial');
		await Promise.resolve();
	});

	it('orders buffered builder telemetry before stage completion and drops late emissions', async () => {
		const progress: CommandEventContractOverlayReportProgressEvent[] = [];
		const outcome = await runCommandEventContractOverlayReportWithDependencies(
			request(),
			{ onProgress: (event) => void progress.push(event), repositoryRoot: fixture.root },
			dependencies({
				buildOverlay(inputs, options) {
					const built = buildCommandEventContractOverlay(inputs);
					queueMicrotask(() => {
						queueMicrotask(() => {
							options?.onProgress?.({
								counts: {},
								detailCode: 'LATE_SYNTHETIC_EVENT',
								phase: 'REQUEST_BIND',
								schemaVersion: COMMAND_EVENT_CONTRACT_OVERLAY_PROGRESS_SCHEMA_VERSION,
								sequence: 999,
								state: 'COMPLETED'
							});
						});
					});
					return built;
				}
			})
		);
		expect(outcome.outcome).toBe('partial');
		await Promise.resolve();
		await Promise.resolve();
		expect(progress.some((event) => event.detailCode === 'LATE_SYNTHETIC_EVENT')).toBe(false);
		expect(progress.at(-1)).toMatchObject({ phase: 'RESULT', state: 'COMPLETED' });
	});
});
