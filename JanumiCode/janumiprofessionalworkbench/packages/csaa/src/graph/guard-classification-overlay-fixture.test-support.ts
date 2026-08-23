import {
	GUARD_ENFORCEMENT_LEDGER_ADAPTER_ID,
	GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH,
	GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_OPERATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_DATA_PATH,
	GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_RETAINED_VERIFIER_PATHS,
	type GuardEnforcementLedgerArtifactSetBinding,
	type GuardEnforcementLedgerExecutorIdentity,
	type GuardEnforcementLedgerObservation,
	type GuardEnforcementLedgerRawEvidence,
	type ObserveGuardEnforcementLedgerRequest
} from '../contracts/guard-enforcement-ledger.js';
import {
	ARROW_COMMAND_CENSUS_ARTIFACT_SET_OPERATION_VERSION,
	ARROW_COMMAND_CENSUS_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
	ARROW_COMMAND_CENSUS_OPERATION_VERSION,
	ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION,
	type ArrowCommandCensusArtifactSetBinding,
	type ArrowCommandCensusObservation
} from '../contracts/arrow-command-census.js';
import type {
	BuildCommandHandlerGraphRequest,
	CommandHandlerGraphSnapshot
} from '../contracts/command-handler-graph.js';
import {
	GUARD_CLASSIFICATION_OVERLAY_OPERATION_VERSION,
	GUARD_CLASSIFICATION_OVERLAY_REQUEST_SCHEMA_VERSION,
	type BuildGuardClassificationOverlayRequest,
	type GuardClassificationOverlayBuildInputs
} from '../contracts/guard-classification-overlay.js';
import {
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_REQUEST_SCHEMA_VERSION,
	type StaticSemanticSnapshot
} from '../contracts/semantic.js';
import {
	STATE_MACHINE_GRAPH_OPERATION_VERSION,
	STATE_MACHINE_GRAPH_REQUEST_SCHEMA_VERSION,
	STATE_MACHINE_TOPOLOGY_OBSERVATION_OPERATION_VERSION,
	STATE_MACHINE_TOPOLOGY_OBSERVATION_REQUEST_SCHEMA_VERSION,
	type BuildStateMachineGraphRequest,
	type BuildStateMachineTopologyObservationRequest,
	type StateMachineGraphSnapshot,
	type StateMachineTopologyObservation
} from '../contracts/state-machine-graph.js';
import {
	SUBJECT_POLICY_VERSION,
	SUBJECT_REQUEST_SCHEMA_VERSION,
	type FrozenSubject
} from '../contracts/subject.js';
import {
	ARROW_COMMAND_CENSUS_RETAINED_VERIFIER_PATHS,
	buildArrowCommandCensusArtifactSet,
	validateArrowCommandCensusArtifactSet
} from '../providers/jpwb-arrow-command-census/artifact-set.js';
import { normalizeArrowCommandCensusObservation } from '../providers/jpwb-arrow-command-census/normalize-arrow-command-census.js';
import { validateArrowCommandCensusObservation } from '../providers/jpwb-arrow-command-census/validate-arrow-command-census.js';
import {
	buildGuardEnforcementLedgerArtifactSet,
	validateGuardEnforcementLedgerArtifactSet
} from '../providers/jpwb-guard-enforcement-ledger/artifact-set.js';
import { normalizeGuardEnforcementLedgerObservation } from '../providers/jpwb-guard-enforcement-ledger/normalize-guard-enforcement-ledger.js';
import { validateGuardEnforcementLedgerObservation } from '../providers/jpwb-guard-enforcement-ledger/validate-guard-enforcement-ledger.js';
import { GUARD_ENFORCEMENT_LEDGER_WORKER_RESULT_SCHEMA_VERSION } from '../providers/jpwb-guard-enforcement-ledger/worker.js';
import { observeStateMachineTopology } from '../providers/jpwb-state-machines/observe-state-machines.js';
import { buildStaticSemanticSnapshot } from '../semantic/build-static-semantic-snapshot.js';
import { resolveSubject } from '../subject/resolve-subject.js';
import {
	buildCommandHandlerGraph,
	selectJpwbCommandHandlerRegistries
} from './build-command-handler-graph.js';
import { buildStateMachineGraph } from './build-state-machine-graph.js';
import {
	createCommandHandlerGraphFixture,
	createCommandDispatchReportHandlerGraphFixture,
	createFactoryCommandHandlerGraphFixture,
	createInitializerFactoryCommandHandlerGraphFixture,
	createNestedDirectCommandHandlerGraphFixture,
	createTableCommandHandlerGraphFixture,
	type CommandHandlerGraphFixture
} from './command-handler-graph-fixture.test-support.js';

const STATE_SOURCE_PATH = 'packages/rph-domain/src/transitions.data.ts';
const STATE_PROJECT_PATH = 'packages/rph-domain/tsconfig.json';
const FIXTURE_SHA = 'b'.repeat(64);
const GUARD_TEXT = 'operator is authorized';
const REPORT_PROJECTS = [
	'packages/rph-application/tsconfig.json',
	'packages/rph-assurance/tsconfig.json',
	'packages/rph-contracts/tsconfig.json',
	'packages/rph-domain/tsconfig.json',
	'packages/rph-persistence/tsconfig.json',
	'packages/rph-ports/tsconfig.json',
	'packages/rph-projections/tsconfig.json'
] as const;
const DIRECT_ENFORCING_ANCHOR =
	"return advanceStatus({ machine: 'Work.status', target: 'STARTED' });";
const FACTORY_ENFORCING_ANCHOR = 'export function makeWorkHandler() {';
const INITIALIZER_FACTORY_ENFORCING_ANCHOR = '() => {\n\treturn () => {';
const HELPER_ENFORCING_ANCHOR = 'return value;';
const NESTED_DIRECT_ENFORCING_ANCHOR = "return 'authorized';";

function guardArtifactSet(subject: FrozenSubject): GuardEnforcementLedgerArtifactSetBinding {
	const totalBytes = subject.artifacts.reduce((sum, artifact) => sum + artifact.bytes, 0);
	const outcome = buildGuardEnforcementLedgerArtifactSet(
		{
			budgets: {
				maxArtifacts: subject.artifacts.length + 1,
				maxDiagnostics: 1_000,
				maxTotalBytes: totalBytes + 1
			},
			operationVersion: GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_OPERATION_VERSION,
			schemaVersion: GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
			subjectId: subject.descriptor.subjectId
		},
		{ subject }
	);
	if (outcome.outcome !== 'complete')
		throw new Error(`Guard artifact-set fixture failed: ${JSON.stringify(outcome)}`);
	const validation = validateGuardEnforcementLedgerArtifactSet(outcome.artifactSet, subject);
	if (validation.state !== 'VALID')
		throw new Error(`Guard artifact-set fixture is invalid: ${JSON.stringify(validation)}`);
	return outcome.artifactSet;
}

function guardExecutor(
	artifactSet: GuardEnforcementLedgerArtifactSetBinding
): GuardEnforcementLedgerExecutorIdentity {
	const analyzer = artifactSet.artifacts.find(
		(artifact) => artifact.path === GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH
	)!;
	const data = artifactSet.artifacts.find(
		(artifact) => artifact.path === GUARD_ENFORCEMENT_LEDGER_DATA_PATH
	)!;
	return {
		adapterId: GUARD_ENFORCEMENT_LEDGER_ADAPTER_ID,
		adapterVersion: GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
		executableBytes: 1,
		executableSha256: FIXTURE_SHA,
		externalModules: [
			{ bytes: 1, contentDigest: FIXTURE_SHA, files: 1, name: 'typescript', version: '5.9.3' },
			{ bytes: 1, contentDigest: FIXTURE_SHA, files: 1, name: 'ulid', version: '2.4.0' },
			{ bytes: 1, contentDigest: FIXTURE_SHA, files: 1, name: 'zod', version: '4.4.3' }
		],
		retainedAnalyzerCanonicalPathKey: analyzer.canonicalPathKey,
		retainedAnalyzerSha256: analyzer.sha256,
		retainedDataCanonicalPathKey: data.canonicalPathKey,
		retainedDataSha256: data.sha256,
		runtime: 'bun',
		runtimeVersion: '1.3.14',
		worker: { bytes: 1, sha256: FIXTURE_SHA }
	};
}

function guardEvidence(enforcingAnchor: string): GuardEnforcementLedgerRawEvidence {
	return {
		analyzerPath: GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH,
		audit: {
			arrowCount: 1,
			counts: [{ count: 1, disposition: 'ENFORCED' }],
			enforcedAnchorBroken: [],
			enforcedWithoutSite: [],
			stale: [],
			textCount: 1,
			unclassified: []
		},
		dataPath: GUARD_ENFORCEMENT_LEDGER_DATA_PATH,
		guardTexts: [GUARD_TEXT],
		guardedArrows: [{ from: 'PROPOSED', guard: GUARD_TEXT, machine: 'Work.status', to: 'STARTED' }],
		ledgerRows: [
			{
				disposition: 'ENFORCED',
				enforcingAnchor,
				enforcingSite: 'packages/rph-application/src/handlers/work.ts:999',
				evidence: 'The direct fixture handler contains the retained refusing anchor.',
				guardText: GUARD_TEXT
			}
		],
		runtime: { bunVersion: '1.3.14' },
		schemaVersion: GUARD_ENFORCEMENT_LEDGER_WORKER_RESULT_SCHEMA_VERSION
	};
}

function guardObservation(
	artifactSet: GuardEnforcementLedgerArtifactSetBinding,
	subject: FrozenSubject,
	enforcingAnchor: string
): GuardEnforcementLedgerObservation {
	const request: ObserveGuardEnforcementLedgerRequest = {
		artifactSetId: artifactSet.id,
		budgets: {
			maxArtifacts: 1_000,
			maxAuditEntries: 100,
			maxDiagnostics: 100,
			maxExecutorDurationMs: 30_000,
			maxExternalModuleBytes: 1_000_000,
			maxExternalModuleFiles: 1_000,
			maxGuardedArrows: 100,
			maxGuardTexts: 100,
			maxLedgerRows: 100,
			maxMaterializedBytes: 8 * 1024 * 1024,
			maxOutputStringCharacters: 100_000,
			maxRawArrayEntries: 1_000,
			maxRawJsonDepth: 20,
			maxStderrBytes: 10_000,
			maxStdoutBytes: 1_000_000
		},
		operationVersion: GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
		schemaVersion: GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
		subjectId: subject.descriptor.subjectId
	};
	const observation = normalizeGuardEnforcementLedgerObservation({
		artifactSet,
		evidence: guardEvidence(enforcingAnchor),
		executor: guardExecutor(artifactSet),
		request,
		transportOutputBytes: new Uint8Array([1])
	});
	const validation = validateGuardEnforcementLedgerObservation(observation, subject);
	if (validation.state !== 'VALID')
		throw new Error(`Guard observation fixture is invalid: ${JSON.stringify(validation)}`);
	return observation;
}

function stateObservation(subject: FrozenSubject): {
	readonly observation: StateMachineTopologyObservation;
	readonly request: BuildStateMachineTopologyObservationRequest;
} {
	const artifact = subject.artifacts.find((item) => item.path === STATE_SOURCE_PATH)!;
	const request: BuildStateMachineTopologyObservationRequest = {
		artifact: {
			bytes: artifact.bytes,
			canonicalPathKey: artifact.canonicalPathKey,
			disposition: 'ANALYZED',
			path: artifact.path,
			primaryClass: artifact.primaryClass,
			roles: artifact.roles,
			sha256: artifact.sha256
		},
		budgets: {
			maxAstNodes: artifact.bytes * 2,
			maxCrossAxisRules: artifact.bytes,
			maxDiagnostics: artifact.bytes,
			maxMachines: artifact.bytes,
			maxSourceBytes: artifact.bytes,
			maxStates: artifact.bytes,
			maxTextCharacters: artifact.bytes * 2,
			maxTransitions: artifact.bytes
		},
		operationVersion: STATE_MACHINE_TOPOLOGY_OBSERVATION_OPERATION_VERSION,
		schemaVersion: STATE_MACHINE_TOPOLOGY_OBSERVATION_REQUEST_SCHEMA_VERSION,
		subjectId: subject.descriptor.subjectId
	};
	const outcome = observeStateMachineTopology(request, { subject });
	if (outcome.outcome !== 'complete')
		throw new Error(`State observation fixture failed: ${JSON.stringify(outcome)}`);
	return { observation: outcome.observation, request };
}

function stateGraph(
	snapshot: StaticSemanticSnapshot,
	observation: StateMachineTopologyObservation
): { readonly graph: StateMachineGraphSnapshot; readonly request: BuildStateMachineGraphRequest } {
	const projectIds = new Set(
		snapshot.projects
			.filter((project) => project.configPath === STATE_PROJECT_PATH)
			.map((project) => project.id)
	);
	const sources = snapshot.sources.filter(
		(source) => source.logicalPath === STATE_SOURCE_PATH && projectIds.has(source.projectId)
	);
	if (sources.length !== 1) throw new Error(`Expected one state source; found ${sources.length}.`);
	const source = sources[0]!;
	const request: BuildStateMachineGraphRequest = {
		budgets: { maxEdges: 1_000, maxNodes: 1_000 },
		observationId: observation.id,
		operationVersion: STATE_MACHINE_GRAPH_OPERATION_VERSION,
		schemaVersion: STATE_MACHINE_GRAPH_REQUEST_SCHEMA_VERSION,
		semanticSnapshotId: snapshot.id,
		source: {
			logicalPath: source.logicalPath,
			programId: source.programId,
			projectId: source.projectId,
			semanticSourceId: source.id
		},
		subjectId: snapshot.subjectId
	};
	const outcome = buildStateMachineGraph(request, snapshot, observation);
	if (outcome.outcome !== 'partial')
		throw new Error(`State graph fixture failed: ${JSON.stringify(outcome)}`);
	return { graph: outcome.graph, request };
}

function commandHandlerGraph(fixture: CommandHandlerGraphFixture): CommandHandlerGraphSnapshot {
	const outcome = buildCommandHandlerGraph(
		fixture.graphRequest,
		fixture.snapshot,
		fixture.observation,
		fixture.subject
	);
	if (outcome.outcome !== 'partial')
		throw new Error(`Command-handler graph fixture failed: ${JSON.stringify(outcome)}`);
	return outcome.graph;
}

export interface GuardClassificationOverlayPredecessorFixture {
	readonly arrowArtifactSet?: ArrowCommandCensusArtifactSetBinding;
	readonly arrowObservation: ArrowCommandCensusObservation;
	readonly cleanup: () => void;
	readonly commandHandlerGraph: CommandHandlerGraphSnapshot;
	readonly commandHandlerRequest: BuildCommandHandlerGraphRequest;
	readonly guardArtifactSet: GuardEnforcementLedgerArtifactSetBinding;
	readonly guardObservation: GuardEnforcementLedgerObservation;
	readonly inputs: GuardClassificationOverlayBuildInputs;
	readonly request: BuildGuardClassificationOverlayRequest;
	readonly root: string;
	readonly snapshot: StaticSemanticSnapshot;
	readonly stateGraph: StateMachineGraphSnapshot;
	readonly stateGraphRequest: BuildStateMachineGraphRequest;
	readonly stateObservation: StateMachineTopologyObservation;
	readonly stateObservationRequest: BuildStateMachineTopologyObservationRequest;
	readonly subject: FrozenSubject;
}

function reportArrowArtifactSet(subject: FrozenSubject): ArrowCommandCensusArtifactSetBinding {
	const totalBytes = subject.artifacts.reduce((sum, artifact) => sum + artifact.bytes, 0);
	const outcome = buildArrowCommandCensusArtifactSet(
		{
			budgets: {
				maxArtifacts: subject.artifacts.length + 1,
				maxDiagnostics: 1_000,
				maxTotalBytes: totalBytes + 1
			},
			operationVersion: ARROW_COMMAND_CENSUS_ARTIFACT_SET_OPERATION_VERSION,
			schemaVersion: ARROW_COMMAND_CENSUS_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
			subjectId: subject.descriptor.subjectId
		},
		{ subject }
	);
	if (outcome.outcome !== 'complete')
		throw new Error(`Report arrow artifact-set fixture failed: ${JSON.stringify(outcome)}`);
	const validation = validateArrowCommandCensusArtifactSet(outcome.artifactSet, subject);
	if (validation.state !== 'VALID')
		throw new Error(`Report arrow artifact-set fixture is invalid: ${JSON.stringify(validation)}`);
	return outcome.artifactSet;
}

/** Exact seven-project report closure with retained arrow and guard artifacts on one FrozenSubject. */
export function createGuardClassificationOverlayReportPredecessorFixture(): GuardClassificationOverlayPredecessorFixture {
	const base = createCommandDispatchReportHandlerGraphFixture();
	try {
		const subjectOutcome = resolveSubject({
			budgets: base.subject.request.budgets,
			expectEmpty: false,
			filters: { exclude: [], include: [] },
			operationVersion: 'guard-classification-overlay-report-fixture/1.0.0',
			outputs: [],
			policyVersion: SUBJECT_POLICY_VERSION,
			rootLocator: base.root,
			schemaVersion: SUBJECT_REQUEST_SCHEMA_VERSION,
			scope: {
				additionalArtifacts: [
					...ARROW_COMMAND_CENSUS_RETAINED_VERIFIER_PATHS,
					...GUARD_ENFORCEMENT_LEDGER_RETAINED_VERIFIER_PATHS
				],
				kind: 'EXPLICIT_PROJECTS',
				projects: REPORT_PROJECTS
			},
			subjectKind: 'WORKTREE'
		});
		if (subjectOutcome.outcome !== 'resolved')
			throw new Error(`Report subject fixture failed: ${JSON.stringify(subjectOutcome)}`);
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
			throw new Error(`Report semantic fixture failed: ${JSON.stringify(semanticOutcome)}`);
		const snapshot = semanticOutcome.snapshot;
		const arrowArtifactSet = reportArrowArtifactSet(subject);
		const arrowObservation = normalizeArrowCommandCensusObservation({
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
		const arrowValidation = validateArrowCommandCensusObservation(arrowObservation, subject);
		if (arrowValidation.state !== 'VALID')
			throw new Error(
				`Report arrow observation fixture is invalid: ${JSON.stringify(arrowValidation)}`
			);
		const registries = selectJpwbCommandHandlerRegistries(snapshot);
		const graphRequest: BuildCommandHandlerGraphRequest = {
			arrowObservationId: arrowObservation.id,
			budgets: base.graphRequest.budgets,
			commandRegistry: registries.commandRegistry,
			handlerRegistry: registries.handlerRegistry,
			operationVersion: base.graphRequest.operationVersion,
			schemaVersion: base.graphRequest.schemaVersion,
			semanticSnapshotId: snapshot.id,
			subjectId: subject.descriptor.subjectId
		};
		return {
			...createOverlayFixture(
				{
					arrowArtifactSet,
					cleanup: base.cleanup,
					graphRequest,
					observation: arrowObservation,
					root: base.root,
					snapshot,
					subject
				},
				DIRECT_ENFORCING_ANCHOR
			),
			arrowArtifactSet
		};
	} catch (error) {
		base.cleanup();
		throw error;
	}
}

function createOverlayFixture(
	fixture: CommandHandlerGraphFixture,
	enforcingAnchor: string
): GuardClassificationOverlayPredecessorFixture {
	try {
		const artifactSet = guardArtifactSet(fixture.subject);
		const guard = guardObservation(artifactSet, fixture.subject, enforcingAnchor);
		const state = stateObservation(fixture.subject);
		const projectedState = stateGraph(fixture.snapshot, state.observation);
		const handlerGraph = commandHandlerGraph(fixture);
		const request: BuildGuardClassificationOverlayRequest = {
			arrowObservationId: fixture.observation.id,
			budgets: {
				maxAnchorSites: 100,
				maxAstNodes: 100_000,
				maxCommandEvidenceLinks: 1_000,
				maxDiagnostics: 1_000,
				maxFrontiers: 1_000,
				maxGuardOccurrences: 1_000,
				maxGuardRecords: 1_000,
				maxHandlerLinks: 1_000,
				maxSourceBytes: 16 * 1024 * 1024,
				maxStateEvidenceRefs: 1_000
			},
			commandHandlerGraphId: handlerGraph.id,
			guardObservationId: guard.id,
			operationVersion: GUARD_CLASSIFICATION_OVERLAY_OPERATION_VERSION,
			schemaVersion: GUARD_CLASSIFICATION_OVERLAY_REQUEST_SCHEMA_VERSION,
			semanticSnapshotId: fixture.snapshot.id,
			stateGraphId: projectedState.graph.id,
			stateObservationId: state.observation.id,
			subjectId: fixture.subject.descriptor.subjectId
		};
		const inputs: GuardClassificationOverlayBuildInputs = {
			arrowObservation: fixture.observation,
			commandHandlerGraph: handlerGraph,
			commandHandlerRequest: fixture.graphRequest,
			guardObservation: guard,
			request,
			semanticSnapshot: fixture.snapshot,
			stateGraph: projectedState.graph,
			stateGraphRequest: projectedState.request,
			stateObservation: state.observation,
			subject: fixture.subject
		};
		return {
			arrowObservation: fixture.observation,
			cleanup: fixture.cleanup,
			commandHandlerGraph: handlerGraph,
			commandHandlerRequest: fixture.graphRequest,
			guardArtifactSet: artifactSet,
			guardObservation: guard,
			inputs,
			request,
			root: fixture.root,
			snapshot: fixture.snapshot,
			stateGraph: projectedState.graph,
			stateGraphRequest: projectedState.request,
			stateObservation: state.observation,
			stateObservationRequest: state.request,
			subject: fixture.subject
		};
	} catch (error) {
		fixture.cleanup();
		throw error;
	}
}

/** Builds every validated predecessor on one FrozenSubject without executing retained modules. */
export function createGuardClassificationOverlayPredecessorFixture(): GuardClassificationOverlayPredecessorFixture {
	return createOverlayFixture(createCommandHandlerGraphFixture(), DIRECT_ENFORCING_ANCHOR);
}

/** Correlates the citation to the resolved factory callable and keeps result targets candidate-only. */
export function createFactoryGuardClassificationOverlayPredecessorFixture(): GuardClassificationOverlayPredecessorFixture {
	return createOverlayFixture(createFactoryCommandHandlerGraphFixture(), FACTORY_ENFORCING_ANCHOR);
}

/** Resolves a factory callable declared as a const initializer while keeping its result candidate-only. */
export function createInitializerFactoryGuardClassificationOverlayPredecessorFixture(): GuardClassificationOverlayPredecessorFixture {
	return createOverlayFixture(
		createInitializerFactoryCommandHandlerGraphFixture(),
		INITIALIZER_FACTORY_ENFORCING_ANCHOR
	);
}

/** Correlates a nested callback citation to its enclosing direct registered handler. */
export function createNestedDirectGuardClassificationOverlayPredecessorFixture(): GuardClassificationOverlayPredecessorFixture {
	return createOverlayFixture(
		createNestedDirectCommandHandlerGraphFixture(),
		NESTED_DIRECT_ENFORCING_ANCHOR
	);
}

/** Correlates a nested returned-handler citation to its enclosing shared factory callable. */
export function createNestedFactoryGuardClassificationOverlayPredecessorFixture(): GuardClassificationOverlayPredecessorFixture {
	return createOverlayFixture(createFactoryCommandHandlerGraphFixture(), DIRECT_ENFORCING_ANCHOR);
}

/** Cites a separate helper callable that is not lexically contained by a registered handler. */
export function createHelperGuardClassificationOverlayPredecessorFixture(): GuardClassificationOverlayPredecessorFixture {
	return createOverlayFixture(createCommandHandlerGraphFixture(), HELPER_ENFORCING_ANCHOR);
}

/** Exercises table-locator command evidence against the same direct-handler citation. */
export function createTableGuardClassificationOverlayPredecessorFixture(): GuardClassificationOverlayPredecessorFixture {
	return createOverlayFixture(createTableCommandHandlerGraphFixture(), DIRECT_ENFORCING_ANCHOR);
}
