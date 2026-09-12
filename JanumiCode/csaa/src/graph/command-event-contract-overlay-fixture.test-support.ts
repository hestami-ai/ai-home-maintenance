import {
	COMMAND_EVENT_CONTRACT_OVERLAY_OPERATION_VERSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_PROJECT_CONFIG_PATH,
	COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH,
	COMMAND_EVENT_CONTRACT_OVERLAY_REQUEST_SCHEMA_VERSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH,
	COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH,
	type BuildCommandEventContractOverlayRequest,
	type CommandEventContractArtifactSelector,
	type CommandEventContractOverlayBuildInputs,
	type CommandEventContractOverlayCoverage,
	type CommandEventContractRegistrySelector
} from '../contracts/command-event-contract-overlay.js';
import type {
	BuildCommandHandlerGraphRequest,
	CommandHandlerGraphSnapshot
} from '../contracts/command-handler-graph.js';
import type { StaticSemanticSnapshot } from '../contracts/semantic.js';
import type { FrozenSubject } from '../contracts/subject.js';
import { buildCommandHandlerGraph } from './build-command-handler-graph.js';
import {
	createEventContractCommandHandlerGraphFixture,
	createEventContractCommandHandlerGraphFixtureWithRegistrySourceTransform,
	createTwoCommandEventContractCommandHandlerGraphFixture,
	createUnresolvedEventContractCommandHandlerGraphFixture,
	type EventContractRegistrySourceTransform,
	type CommandHandlerGraphFixture
} from './command-handler-graph-fixture.test-support.js';
import { validateCommandHandlerGraph } from './validate-command-handler-graph.js';

export const COMMAND_EVENT_CONTRACT_OVERLAY_FIXTURE_EXPECTED_COUNTS = Object.freeze({
	additionalDeclaredLinks: 1,
	boundContributions: 3,
	boundDistinctEvents: 2,
	boundRepeatedContributions: 1,
	commandDeclaredDistinctEvents: 2,
	commandDeclaredLinks: 2,
	commands: 1,
	commandsWithoutTransitionBinding: 0,
	declaredNeitherBoundNorPinned: 1,
	eventContracts: 4,
	frontiers: 2,
	generatedBoundSetDifferences: 0,
	missingEventContracts: 0,
	pinnedEmissions: 3,
	pinnedEmittedNotBound: 1,
	primaryDeclaredLinks: 1,
	reconciles: true,
	retainedBoundNotPinnedEmitted: 0
} as const satisfies CommandEventContractOverlayCoverage);

function eventRegistrySelector(
	snapshot: StaticSemanticSnapshot
): CommandEventContractRegistrySelector {
	const projects = snapshot.projects.filter(
		(project) => project.configPath === COMMAND_EVENT_CONTRACT_OVERLAY_PROJECT_CONFIG_PATH
	);
	if (projects.length !== 1)
		throw new Error(`Expected one contracts project; found ${projects.length}.`);
	const project = projects[0]!;
	const sources = snapshot.sources.filter(
		(source) =>
			source.analysisDisposition === 'DEEP_INDEXED' &&
			source.logicalPath === COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH &&
			source.projectId === project.id
	);
	if (sources.length !== 1)
		throw new Error(`Expected one generated registry source; found ${sources.length}.`);
	const source = sources[0]!;
	const declarations = snapshot.declarations.filter(
		(declaration) =>
			declaration.sourceId === source.id &&
			declaration.name === 'EVENTS' &&
			declaration.kindName === 'VariableDeclaration' &&
			declaration.nodeId !== null
	);
	if (declarations.length !== 1)
		throw new Error(`Expected one EVENTS declaration; found ${declarations.length}.`);
	return {
		contentSha256: source.contentSha256,
		declarationId: declarations[0]!.id,
		exportName: 'EVENTS',
		logicalPath: COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH,
		programId: source.programId,
		projectConfigPath: COMMAND_EVENT_CONTRACT_OVERLAY_PROJECT_CONFIG_PATH,
		projectId: source.projectId,
		sourceId: source.id
	};
}

function commandRegistrySelector(
	request: BuildCommandHandlerGraphRequest
): CommandEventContractRegistrySelector {
	const selector = request.commandRegistry;
	if (
		selector.exportName !== 'COMMANDS' ||
		selector.logicalPath !== COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH ||
		selector.projectConfigPath !== COMMAND_EVENT_CONTRACT_OVERLAY_PROJECT_CONFIG_PATH
	)
		throw new Error('Command-handler fixture selected an unexpected command registry.');
	return {
		contentSha256: selector.contentSha256,
		declarationId: selector.declarationId,
		exportName: 'COMMANDS',
		logicalPath: COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH,
		programId: selector.programId,
		projectConfigPath: COMMAND_EVENT_CONTRACT_OVERLAY_PROJECT_CONFIG_PATH,
		projectId: selector.projectId,
		sourceId: selector.sourceId
	};
}

function artifactSelector(
	subject: FrozenSubject,
	artifactPath: CommandEventContractArtifactSelector['artifactPath']
): CommandEventContractArtifactSelector {
	const artifacts = subject.artifacts.filter((artifact) => artifact.path === artifactPath);
	if (artifacts.length !== 1)
		throw new Error(`Expected one frozen ${artifactPath} artifact; found ${artifacts.length}.`);
	const artifact = artifacts[0]!;
	return {
		artifactBytes: artifact.bytes,
		artifactContentSha256: artifact.sha256,
		artifactPath
	};
}

function buildValidatedCommandHandlerGraph(
	fixture: CommandHandlerGraphFixture
): CommandHandlerGraphSnapshot {
	const outcome = buildCommandHandlerGraph(
		fixture.graphRequest,
		fixture.snapshot,
		fixture.observation,
		fixture.subject
	);
	if (outcome.outcome !== 'partial')
		throw new Error(`Command-handler fixture build failed: ${JSON.stringify(outcome)}`);
	const validation = validateCommandHandlerGraph(
		outcome.graph,
		fixture.snapshot,
		fixture.observation,
		fixture.subject,
		{
			maxIssues: 1_000,
			maxRecords: 100_000,
			maxStringCharacters: 10_000_000
		}
	);
	if (validation.state !== 'VALID')
		throw new Error(`Command-handler fixture validation failed: ${JSON.stringify(validation)}`);
	return outcome.graph;
}

function overlayRequest(
	fixture: CommandHandlerGraphFixture,
	commandHandlerGraph: CommandHandlerGraphSnapshot
): BuildCommandEventContractOverlayRequest {
	return {
		arrowObservationId: fixture.observation.id,
		budgets: {
			maxAstNodes: 100_000,
			maxBoundContributions: 100,
			maxCommands: 100,
			maxDeclaredLinks: 100,
			maxDiagnostics: 1_000,
			maxEventContracts: 100,
			maxFrontiers: 100,
			maxPinnedEmissions: 100,
			maxSourceBytes: 4 * 1024 * 1024
		},
		commandHandlerGraphId: commandHandlerGraph.id,
		commandRegistry: commandRegistrySelector(fixture.graphRequest),
		eventRegistry: eventRegistrySelector(fixture.snapshot),
		operationVersion: COMMAND_EVENT_CONTRACT_OVERLAY_OPERATION_VERSION,
		retainedCensusArtifact: artifactSelector(
			fixture.subject,
			COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH
		),
		schemaVersion: COMMAND_EVENT_CONTRACT_OVERLAY_REQUEST_SCHEMA_VERSION,
		semanticSnapshotId: fixture.snapshot.id,
		subjectId: fixture.subject.descriptor.subjectId,
		vocabArtifact: artifactSelector(fixture.subject, COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH)
	};
}

export interface CommandEventContractOverlayFixture {
	readonly cleanup: CommandHandlerGraphFixture['cleanup'];
	readonly commandHandlerFixture: CommandHandlerGraphFixture;
	readonly commandHandlerGraph: CommandHandlerGraphSnapshot;
	readonly expectedCoverage: typeof COMMAND_EVENT_CONTRACT_OVERLAY_FIXTURE_EXPECTED_COUNTS;
	readonly graphRequest: CommandHandlerGraphFixture['graphRequest'];
	readonly inputs: CommandEventContractOverlayBuildInputs;
	readonly observation: CommandHandlerGraphFixture['observation'];
	readonly request: BuildCommandEventContractOverlayRequest;
	readonly root: CommandHandlerGraphFixture['root'];
	readonly snapshot: CommandHandlerGraphFixture['snapshot'];
	readonly subject: CommandHandlerGraphFixture['subject'];
}

/**
 * Builds one exact compiler-backed predecessor chain without executing either retained census.
 * The small subject contains primary, additional, pinned-only, and declared-only event partitions.
 */
function createOverlayFixture(
	commandHandlerFixture: CommandHandlerGraphFixture
): CommandEventContractOverlayFixture {
	try {
		const commandHandlerGraph = buildValidatedCommandHandlerGraph(commandHandlerFixture);
		const request = overlayRequest(commandHandlerFixture, commandHandlerGraph);
		return {
			cleanup: commandHandlerFixture.cleanup,
			commandHandlerFixture,
			commandHandlerGraph,
			expectedCoverage: COMMAND_EVENT_CONTRACT_OVERLAY_FIXTURE_EXPECTED_COUNTS,
			graphRequest: commandHandlerFixture.graphRequest,
			inputs: {
				arrowObservation: commandHandlerFixture.observation,
				commandHandlerGraph,
				commandHandlerRequest: commandHandlerFixture.graphRequest,
				request,
				semanticSnapshot: commandHandlerFixture.snapshot,
				subject: commandHandlerFixture.subject
			},
			observation: commandHandlerFixture.observation,
			request,
			root: commandHandlerFixture.root,
			snapshot: commandHandlerFixture.snapshot,
			subject: commandHandlerFixture.subject
		};
	} catch (error) {
		commandHandlerFixture.cleanup();
		throw error;
	}
}

export function createCommandEventContractOverlayFixture(): CommandEventContractOverlayFixture {
	return createOverlayFixture(createEventContractCommandHandlerGraphFixture());
}

/** Rebuilds the complete compiler-backed predecessor chain after transforming messages.ts. */
export function createCommandEventContractOverlayFixtureWithRegistrySourceTransform(
	transform: EventContractRegistrySourceTransform
): CommandEventContractOverlayFixture {
	return createOverlayFixture(
		createEventContractCommandHandlerGraphFixtureWithRegistrySourceTransform(transform)
	);
}

/** Rebuilds the compiler-backed predecessor with an explicitly unresolved handler target. */
export function createUnresolvedHandlerCommandEventContractOverlayFixture(): CommandEventContractOverlayFixture {
	return createOverlayFixture(createUnresolvedEventContractCommandHandlerGraphFixture());
}

/** Rebuilds the compiler-backed predecessor with two command contracts. */
export function createTwoCommandEventContractOverlayFixture(): CommandEventContractOverlayFixture {
	return createOverlayFixture(createTwoCommandEventContractCommandHandlerGraphFixture());
}
