import type { CommandHandlerGraphSnapshot } from '../contracts/command-handler-graph.js';
import {
	COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_LOGICAL_PATH,
	COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_METHOD_NAME,
	COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_PROJECT_CONFIG_PATH,
	COMMAND_DISPATCH_TOPOLOGY_OPERATION_VERSION,
	COMMAND_DISPATCH_TOPOLOGY_REQUEST_SCHEMA_VERSION,
	type BuildCommandDispatchTopologyRequest,
	type CommandDispatchTopologyCommandBusSelector
} from '../contracts/command-dispatch-topology.js';
import type { SemanticDeclarationRecord } from '../contracts/semantic.js';
import { buildCommandHandlerGraph } from './build-command-handler-graph.js';
import {
	createCommandHandlerGraphFixture,
	createCommandDispatchReportHandlerGraphFixture,
	type CommandHandlerGraphFixture
} from './command-handler-graph-fixture.test-support.js';
import { validateCommandHandlerGraph } from './validate-command-handler-graph.js';

export interface CommandDispatchTopologyFixture extends CommandHandlerGraphFixture {
	readonly commandBusSelector: CommandDispatchTopologyCommandBusSelector;
	readonly commandHandlerGraph: CommandHandlerGraphSnapshot;
	readonly dispatchRequest: BuildCommandDispatchTopologyRequest;
}

function exactOne<T>(values: readonly T[], description: string): T {
	if (values.length !== 1)
		throw new Error(`Expected exactly one ${description}; found ${values.length}.`);
	return values[0]!;
}

function commandBusMethodDeclaration(
	fixture: CommandHandlerGraphFixture
): SemanticDeclarationRecord {
	const project = exactOne(
		fixture.snapshot.projects.filter(
			(candidate) =>
				candidate.configPath === COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_PROJECT_CONFIG_PATH
		),
		`semantic project for ${COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_PROJECT_CONFIG_PATH}`
	);
	const source = exactOne(
		fixture.snapshot.sources.filter(
			(candidate) =>
				candidate.projectId === project.id &&
				candidate.logicalPath === COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_LOGICAL_PATH
		),
		`semantic source for ${COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_LOGICAL_PATH}`
	);
	return exactOne(
		fixture.snapshot.declarations.filter(
			(candidate) =>
				candidate.sourceId === source.id &&
				candidate.name === COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_METHOD_NAME
		),
		`${COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_METHOD_NAME} declaration`
	);
}

function commandBusSelector(
	fixture: CommandHandlerGraphFixture
): CommandDispatchTopologyCommandBusSelector {
	const declaration = commandBusMethodDeclaration(fixture);
	const source = exactOne(
		fixture.snapshot.sources.filter((candidate) => candidate.id === declaration.sourceId),
		'selected command-bus source'
	);
	return {
		contentSha256: source.contentSha256,
		declarationId: declaration.id,
		logicalPath: COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_LOGICAL_PATH,
		methodName: COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_METHOD_NAME,
		programId: source.programId,
		projectConfigPath: COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_PROJECT_CONFIG_PATH,
		projectId: source.projectId,
		sourceId: source.id
	};
}

function dispatchRequest(
	fixture: CommandHandlerGraphFixture,
	commandHandlerGraph: CommandHandlerGraphSnapshot,
	selector: CommandDispatchTopologyCommandBusSelector
): BuildCommandDispatchTopologyRequest {
	return {
		budgets: {
			maxAstNodes: 100_000,
			maxDiagnostics: 1_000,
			maxEdges: 1_000,
			maxHandlerTargets: 1_000,
			maxNodes: 1_000,
			maxSourceBytes: 4 * 1024 * 1024
		},
		commandBus: selector,
		commandHandlerGraphId: commandHandlerGraph.id,
		operationVersion: COMMAND_DISPATCH_TOPOLOGY_OPERATION_VERSION,
		schemaVersion: COMMAND_DISPATCH_TOPOLOGY_REQUEST_SCHEMA_VERSION,
		semanticSnapshotId: fixture.snapshot.id,
		subjectId: fixture.subject.descriptor.subjectId
	};
}

/**
 * Real compiler-backed overlay fixture. The predecessor graph is independently built and
 * validated; the retained command-dispatch census is frozen as an artifact and never executed.
 */
function createFixture(fixture: CommandHandlerGraphFixture): CommandDispatchTopologyFixture {
	try {
		const outcome = buildCommandHandlerGraph(
			fixture.graphRequest,
			fixture.snapshot,
			fixture.observation,
			fixture.subject
		);
		if (outcome.outcome !== 'partial')
			throw new Error(`Predecessor graph construction failed: ${JSON.stringify(outcome)}`);
		const commandHandlerGraph = outcome.graph;
		const validation = validateCommandHandlerGraph(
			commandHandlerGraph,
			fixture.snapshot,
			fixture.observation,
			fixture.subject
		);
		if (validation.state !== 'VALID')
			throw new Error(`Predecessor graph validation failed: ${JSON.stringify(validation)}`);
		const selector = commandBusSelector(fixture);
		return {
			...fixture,
			commandBusSelector: selector,
			commandHandlerGraph,
			dispatchRequest: dispatchRequest(fixture, commandHandlerGraph, selector)
		};
	} catch (error) {
		fixture.cleanup();
		throw error;
	}
}

export function createCommandDispatchTopologyFixture(): CommandDispatchTopologyFixture {
	return createFixture(createCommandHandlerGraphFixture());
}

/** Exact facade closure while retaining the same compiler-backed dispatch evidence. */
export function createCommandDispatchTopologyReportFixture(): CommandDispatchTopologyFixture {
	return createFixture(createCommandDispatchReportHandlerGraphFixture());
}
