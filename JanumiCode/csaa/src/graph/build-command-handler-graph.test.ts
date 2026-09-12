import { afterEach, describe, expect, it } from 'vitest';

import {
	COMMAND_HANDLER_GRAPH_DERIVATION_CAPABILITY,
	COMMAND_HANDLER_GRAPH_INFERENCE_CAPABILITY,
	type CommandHandlerGraphCoverage,
	type CommandHandlerGraphEdge,
	type CommandHandlerGraphEdgeId,
	type CommandHandlerGraphIndexEntry,
	type CommandHandlerGraphNode,
	type CommandHandlerGraphNodeId,
	type CommandHandlerGraphSnapshot
} from '../contracts/command-handler-graph.js';
import type { StaticSemanticSnapshot } from '../contracts/semantic.js';
import { compareText } from '../inventory/canonical.js';
import {
	buildCommandHandlerGraph,
	COMMAND_HANDLER_GRAPH_PROGRESS_SCHEMA_VERSION,
	type BuildCommandHandlerGraphOptions,
	type CommandHandlerGraphProgressEvent
} from './build-command-handler-graph.js';
import {
	commandHandlerGraphContentDigest,
	commandHandlerGraphEdgeId,
	commandHandlerGraphInputDigest
} from './command-handler-graph-canonical.js';
import {
	createCommandHandlerGraphFixture,
	createEmptyCommandHandlerGraphFixture,
	createFactoryCommandHandlerGraphFixture,
	createSharedDirectCommandHandlerGraphFixture,
	createTableCommandHandlerGraphFixture,
	type CommandHandlerGraphFixture
} from './command-handler-graph-fixture.test-support.js';
import {
	type CommandHandlerGraphValidationIssueCode,
	validateCommandHandlerGraph
} from './validate-command-handler-graph.js';

const cleanups: Array<() => void> = [];

afterEach(() => {
	for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

function fixture(
	variant: 'DIRECT' | 'EMPTY' | 'FACTORY' | 'SHARED_DIRECT' | 'TABLE' = 'DIRECT'
): CommandHandlerGraphFixture {
	const value =
		variant === 'DIRECT'
			? createCommandHandlerGraphFixture()
			: variant === 'FACTORY'
				? createFactoryCommandHandlerGraphFixture()
				: variant === 'TABLE'
					? createTableCommandHandlerGraphFixture()
					: variant === 'SHARED_DIRECT'
						? createSharedDirectCommandHandlerGraphFixture()
						: createEmptyCommandHandlerGraphFixture();
	cleanups.push(value.cleanup);
	return value;
}

function build(
	value: CommandHandlerGraphFixture,
	options?: BuildCommandHandlerGraphOptions
): CommandHandlerGraphSnapshot {
	const outcome = buildCommandHandlerGraph(
		value.graphRequest,
		value.snapshot,
		value.observation,
		value.subject,
		options
	);
	if (outcome.outcome !== 'partial')
		throw new Error(`Fixture graph construction failed: ${JSON.stringify(outcome)}`);
	return outcome.graph;
}

function finalized(
	graph: CommandHandlerGraphSnapshot,
	mutate: (draft: CommandHandlerGraphSnapshot) => void
): CommandHandlerGraphSnapshot {
	const draft = structuredClone(graph) as CommandHandlerGraphSnapshot;
	mutate(draft);
	(draft as { contentDigest: string }).contentDigest = commandHandlerGraphContentDigest(draft);
	return draft;
}

function graphIndexes(
	nodes: readonly CommandHandlerGraphNode[],
	edges: readonly CommandHandlerGraphEdge[],
	direction: 'FORWARD' | 'REVERSE'
): CommandHandlerGraphIndexEntry[] {
	const grouped = new Map<CommandHandlerGraphNodeId, CommandHandlerGraphEdgeId[]>(
		nodes.map((node) => [node.id, []])
	);
	for (const edge of edges) {
		const nodeId = direction === 'FORWARD' ? edge.source.nodeId : edge.target.nodeId;
		const edgeIds = grouped.get(nodeId);
		if (edgeIds === undefined) throw new Error('Mutation repair encountered a dangling endpoint.');
		edgeIds.push(edge.id);
	}
	return [...grouped]
		.map(([nodeId, edgeIds]) => ({ edgeIds: edgeIds.sort(compareText), nodeId }))
		.sort((left, right) => compareText(left.nodeId, right.nodeId));
}

function repairDerivedViews(graph: CommandHandlerGraphSnapshot): void {
	const edges = [...graph.edges].sort((left, right) => compareText(left.id, right.id));
	(graph as unknown as { edges: CommandHandlerGraphEdge[] }).edges = edges;
	(graph as unknown as { forwardIndex: CommandHandlerGraphSnapshot['forwardIndex'] }).forwardIndex =
		graphIndexes(graph.nodes, edges, 'FORWARD');
	(graph as unknown as { reverseIndex: CommandHandlerGraphSnapshot['reverseIndex'] }).reverseIndex =
		graphIndexes(graph.nodes, edges, 'REVERSE');
	for (const layer of graph.layers) {
		const layerNodes = graph.nodes.filter((node) => node.layerId === layer.id);
		const layerEdges = edges.filter((edge) => edge.layerId === layer.id);
		const provenanceIds = [
			...new Set([
				...layerNodes.flatMap((node) => node.provenanceIds),
				...layerEdges.flatMap((edge) => edge.provenanceIds)
			])
		].sort(compareText);
		Object.assign(
			layer as unknown as {
				coverage: CommandHandlerGraphCoverage;
				edgeIds: CommandHandlerGraphEdgeId[];
				nodeIds: CommandHandlerGraphNodeId[];
				provenanceIds: string[];
			},
			{
				coverage: graph.coverage,
				edgeIds: layerEdges.map((edge) => edge.id),
				nodeIds: layerNodes.map((node) => node.id),
				provenanceIds
			}
		);
	}
}

function expectInvalid(
	value: CommandHandlerGraphFixture,
	graph: unknown,
	code: CommandHandlerGraphValidationIssueCode
): void {
	expect(
		validateCommandHandlerGraph(graph, value.snapshot, value.observation, value.subject)
	).toMatchObject({
		issues: expect.arrayContaining([expect.objectContaining({ code })]),
		state: 'INVALID'
	});
}

function withoutSymbolCapability(snapshot: StaticSemanticSnapshot): StaticSemanticSnapshot {
	return {
		...snapshot,
		capabilities: snapshot.capabilities.map((capability) =>
			capability.capability === 'TS_SYMBOL'
				? { ...capability, state: 'UNSUPPORTED' as const }
				: capability
		)
	};
}

describe('buildCommandHandlerGraph', () => {
	it('builds the exact direct-handler fixture and passes public validation', () => {
		const value = fixture();
		const outcome = buildCommandHandlerGraph(
			value.graphRequest,
			value.snapshot,
			value.observation,
			value.subject
		);
		expect(outcome).toMatchObject({
			diagnostics: [{ code: 'GRAPH_PARTIAL', path: null, phase: 'VALIDATE' }],
			outcome: 'partial'
		});
		if (outcome.outcome !== 'partial') throw new Error('Expected a partial graph.');
		const { graph } = outcome;

		expect(graph.commandRegistry).toEqual(value.graphRequest.commandRegistry);
		expect(graph.handlerRegistry).toEqual(value.graphRequest.handlerRegistry);
		expect(graph.graphInputDigest).toBe(
			commandHandlerGraphInputDigest(value.graphRequest, value.snapshot, value.observation)
		);
		expect(graph.contentDigest).toBe(commandHandlerGraphContentDigest(graph));
		expect(graph).toMatchObject({
			authorityTransfer: 'NONE',
			baselineChange: 'NONE',
			capabilities: [
				COMMAND_HANDLER_GRAPH_DERIVATION_CAPABILITY,
				COMMAND_HANDLER_GRAPH_INFERENCE_CAPABILITY
			],
			capabilityStatus: 'PARTIAL',
			commandDispatchCensusIntegration: 'NOT_INTEGRATED',
			fullJanCsaa007Conformance: 'NOT_CLAIMED',
			fullJanCsaa008Conformance: 'NOT_CLAIMED',
			gateEffect: 'NONE',
			graphAuthority: 'NONE',
			health: 'PARTIAL',
			integrationStrategy: 'OVERLAY',
			oracleChange: 'NONE',
			replacementEquivalence: 'NOT_CLAIMED',
			retainedArrowVerifierAuthority: 'RETAINED_DELEGATED',
			runtimeDispatchClosure: 'NOT_CLAIMED',
			runtimePerformability: 'NOT_CLAIMED'
		});
		expect(graph.coverage).toEqual({
			arrowAttributionClosure: 'OPEN',
			candidateEdges: 0,
			commandRegistryClosure: 'CLOSED',
			commandsWithArrowEvidence: 1,
			commandsWithoutArrowEvidence: 0,
			directHandlerArrowSites: 1,
			discoveredArrowOccurrences: 1,
			discoveredArrowSites: 1,
			discoveredCommandRegistryEntries: 1,
			discoveredHandlerRegistryEntries: 1,
			edges: 4,
			exactCommandRegistrations: 1,
			exactEdges: 4,
			factorySharedArrowSites: 0,
			frontierNodes: 0,
			handlerTargets: 1,
			missingHandlerRegistrations: 0,
			reconciles: true,
			representedArrowOccurrences: 1,
			representedArrowSites: 1,
			representedCommandRegistryEntries: 1,
			representedHandlerRegistryEntries: 1,
			tableCommandArrowSites: 0,
			undeclaredHandlerRegistrations: 0
		});
		expect(graph.nodes.map((node) => node.kind).sort(compareText)).toEqual(
			[
				'COMMAND_REGISTRY_ENTRY',
				'DECLARED_ARROW_OCCURRENCE',
				'DECLARED_ARROW_SITE',
				'HANDLER_REGISTRATION',
				'HANDLER_TARGET'
			].sort(compareText)
		);
		expect(graph.edges.map((edge) => edge.relationKind).sort(compareText)).toEqual(
			[
				'ARROW_SITE_TO_OCCURRENCE',
				'COMMAND_REGISTRY_ENTRY_TO_HANDLER_REGISTRATION',
				'HANDLER_REGISTRATION_TO_TARGET',
				'HANDLER_TARGET_TO_ARROW_SITE'
			].sort(compareText)
		);
		expect(graph.edges.every((edge) => edge.attribution === 'EXACT')).toBe(true);
		expect(graph.forwardIndex).toHaveLength(graph.nodes.length);
		expect(graph.reverseIndex).toHaveLength(graph.nodes.length);
		expect(graph.layers).toMatchObject([
			{
				capability: COMMAND_HANDLER_GRAPH_DERIVATION_CAPABILITY,
				edgeIds: graph.edges.map((edge) => edge.id),
				kind: 'JPWB_COMMAND_HANDLER_DERIVATION',
				nodeIds: graph.nodes.map((node) => node.id),
				ordinal: 0
			},
			{
				capability: COMMAND_HANDLER_GRAPH_INFERENCE_CAPABILITY,
				edgeIds: [],
				kind: 'JPWB_COMMAND_HANDLER_INFERENCE',
				nodeIds: [],
				ordinal: 1
			}
		]);
		expect(
			validateCommandHandlerGraph(graph, value.snapshot, value.observation, value.subject)
		).toEqual({ issues: [], state: 'VALID' });
	});

	it('reproduces table-member attribution and shared direct-handler closure', () => {
		const table = fixture('TABLE');
		const tableGraph = build(table);
		const tableSite = tableGraph.nodes.find((node) => node.kind === 'DECLARED_ARROW_SITE');
		expect(tableSite).toMatchObject({
			attribution: 'TABLE_COMMAND',
			observationSource: { line: null, path: null },
			semanticSiteNodeId: expect.any(String),
			sourceId: expect.any(String),
			sourceLocations: [{ end: expect.any(Number), start: expect.any(Number) }]
		});
		expect(
			tableGraph.edges.some(
				(edge) => edge.relationKind === 'COMMAND_REGISTRY_ENTRY_TO_TABLE_ARROW_SITE'
			)
		).toBe(true);
		expect(
			validateCommandHandlerGraph(tableGraph, table.snapshot, table.observation, table.subject)
		).toEqual({ issues: [], state: 'VALID' });

		const shared = fixture('SHARED_DIRECT');
		const sharedGraph = build(shared);
		expect(sharedGraph.coverage).toMatchObject({
			commandsWithArrowEvidence: 2,
			directHandlerArrowSites: 1,
			discoveredCommandRegistryEntries: 2,
			discoveredHandlerRegistryEntries: 2,
			handlerTargets: 1
		});
		expect(
			sharedGraph.edges.filter((edge) => edge.relationKind === 'HANDLER_TARGET_TO_ARROW_SITE')
		).toHaveLength(1);
		expect(
			validateCommandHandlerGraph(sharedGraph, shared.snapshot, shared.observation, shared.subject)
		).toEqual({ issues: [], state: 'VALID' });
	});

	it('rejects empty source registries and ambiguous semantic selector populations', () => {
		const empty = fixture('EMPTY');
		expect(
			buildCommandHandlerGraph(empty.graphRequest, empty.snapshot, empty.observation, empty.subject)
		).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'INPUT_INVALID' })],
			outcome: 'unavailable'
		});

		const value = fixture();
		const graph = build(value);
		const emptyBoundGraph = structuredClone(graph) as CommandHandlerGraphSnapshot;
		Object.assign(
			emptyBoundGraph as unknown as {
				arrowObservationId: typeof empty.observation.id;
				commandRegistry: typeof empty.graphRequest.commandRegistry;
				handlerRegistry: typeof empty.graphRequest.handlerRegistry;
				semanticSnapshotId: typeof empty.snapshot.id;
				subjectId: string;
			},
			{
				arrowObservationId: empty.observation.id,
				commandRegistry: empty.graphRequest.commandRegistry,
				handlerRegistry: empty.graphRequest.handlerRegistry,
				semanticSnapshotId: empty.snapshot.id,
				subjectId: empty.snapshot.subjectId
			}
		);
		expect(
			validateCommandHandlerGraph(emptyBoundGraph, empty.snapshot, empty.observation, empty.subject)
		).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: 'SHAPE_INVALID' })]),
			state: 'INVALID'
		});
		const source = value.snapshot.sources.find(
			(candidate) => candidate.id === value.graphRequest.commandRegistry.sourceId
		);
		if (source === undefined) throw new Error('Expected selected command-registry source.');
		const ambiguousSnapshot = {
			...value.snapshot,
			sources: [
				...value.snapshot.sources,
				{ ...source, id: `${source.id}-duplicate` as typeof source.id }
			]
		};
		expect(
			validateCommandHandlerGraph(graph, ambiguousSnapshot, value.observation, value.subject)
		).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: 'SHAPE_INVALID' })]),
			state: 'INVALID'
		});
	});

	it('is deterministic and keeps progress telemetry out of evidence and outcomes', () => {
		const value = fixture();
		const first = build(value);
		const second = build(value);
		expect(second).toEqual(first);

		const events: CommandHandlerGraphProgressEvent[] = [];
		const observed = build(value, { onProgress: (event) => events.push(event) });
		expect(observed).toEqual(first);
		expect(events).toHaveLength(20);
		expect(events[0]).toMatchObject({ phase: 'REQUEST_BIND', state: 'STARTED' });
		expect(events.at(-1)).toMatchObject({ phase: 'GRAPH_VALIDATE', state: 'COMPLETED' });
		expect(
			events.every((event) => event.schemaVersion === COMMAND_HANDLER_GRAPH_PROGRESS_SCHEMA_VERSION)
		).toBe(true);
		expect(
			events.every((event) => event.durationMs >= 0 && Number.isFinite(event.durationMs))
		).toBe(true);
		expect(events.every((event) => !Number.isNaN(Date.parse(event.timestamp)))).toBe(true);
		expect(events.some((event) => event.state === 'FAILED' || event.state === 'SKIPPED')).toBe(
			false
		);

		const withThrowingSink = build(value, {
			onProgress: () => {
				throw new Error('hostile telemetry sink');
			}
		});
		expect(withThrowingSink).toEqual(first);
	});

	it('admits exact graph-population and consumed-source operation guards', () => {
		const value = fixture();
		const baseline = build(value);
		const consumedSourceIds = new Set(
			baseline.nodes.flatMap((node) =>
				'sourceId' in node && node.sourceId !== null ? [node.sourceId] : []
			)
		);
		const consumedPaths = new Set(
			value.snapshot.sources
				.filter((source) => consumedSourceIds.has(source.id))
				.map((source) => source.logicalPath)
		);
		const consumedSourceBytes = value.subject.artifacts
			.filter((artifact) => consumedPaths.has(artifact.path))
			.reduce((total, artifact) => total + artifact.bytes, 0);
		const outcome = buildCommandHandlerGraph(
			{
				...value.graphRequest,
				budgets: {
					maxAstNodes: value.snapshot.astNodes.length,
					maxCommandRegistryEntries: baseline.coverage.discoveredCommandRegistryEntries,
					maxEdges: baseline.edges.length,
					maxFrontiers: Math.max(1, baseline.coverage.frontierNodes),
					maxHandlerRegistryEntries: baseline.coverage.discoveredHandlerRegistryEntries,
					maxNodes: baseline.nodes.length,
					maxSourceBytes: consumedSourceBytes
				}
			},
			value.snapshot,
			value.observation,
			value.subject
		);
		expect(outcome.outcome, JSON.stringify(outcome)).toBe('partial');
	});

	it('fails closed for malformed requests, stale bindings, selectors, capabilities, and budgets', () => {
		const value = fixture();
		const request = value.graphRequest;
		const expectUnavailable = (requestValue: unknown, code: string): void => {
			expect(
				buildCommandHandlerGraph(requestValue, value.snapshot, value.observation, value.subject)
			).toMatchObject({
				diagnostics: [expect.objectContaining({ code })],
				outcome: 'unavailable'
			});
		};

		for (const invalidRequest of [
			null,
			{ ...request, unexpected: true },
			new Proxy(request, {}),
			{ ...request, budgets: { ...request.budgets, maxNodes: 0 } },
			{ ...request, operationVersion: 'wrong' },
			{ ...request, schemaVersion: 'wrong' },
			{
				...request,
				commandRegistry: { ...request.commandRegistry, exportName: 'HANDLERS' }
			}
		])
			expectUnavailable(invalidRequest, 'REQUEST_INVALID');

		expectUnavailable(
			{ ...request, semanticSnapshotId: `${request.semanticSnapshotId}-stale` },
			'SEMANTIC_SNAPSHOT_ID_MISMATCH'
		);
		expectUnavailable({ ...request, subjectId: 'subject:stale' }, 'SUBJECT_ID_MISMATCH');
		expectUnavailable(
			{
				...request,
				commandRegistry: { ...request.commandRegistry, contentSha256: '0'.repeat(64) }
			},
			'REGISTRY_SELECTOR_MISMATCH'
		);
		expect(
			buildCommandHandlerGraph(
				request,
				withoutSymbolCapability(value.snapshot),
				value.observation,
				value.subject
			)
		).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'SEMANTIC_CAPABILITY_UNAVAILABLE' })],
			outcome: 'unavailable'
		});

		for (const [budget, maximum] of [
			['maxAstNodes', 1],
			['maxEdges', 1],
			['maxNodes', 1],
			['maxSourceBytes', 1]
		] as const)
			expectUnavailable(
				{ ...request, budgets: { ...request.budgets, [budget]: maximum } },
				'BUDGET_EXCEEDED'
			);

		const factory = fixture('FACTORY');
		expect(
			buildCommandHandlerGraph(
				{
					...factory.graphRequest,
					budgets: { ...factory.graphRequest.budgets, maxFrontiers: 1 }
				},
				factory.snapshot,
				factory.observation,
				factory.subject
			)
		).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'BUDGET_EXCEEDED' })],
			outcome: 'unavailable'
		});
	}, 30_000);

	it('rejects stale and independently invalid arrow observations before graph construction', () => {
		const value = fixture();
		expect(
			buildCommandHandlerGraph(
				{ ...value.graphRequest, arrowObservationId: `${value.observation.id}-stale` },
				value.snapshot,
				value.observation,
				value.subject
			)
		).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'ARROW_OBSERVATION_ID_MISMATCH' })],
			outcome: 'unavailable'
		});

		const invalidObservation = structuredClone(value.observation);
		(invalidObservation as { contentDigest: string }).contentDigest = '0'.repeat(64);
		expect(
			buildCommandHandlerGraph(
				value.graphRequest,
				value.snapshot,
				invalidObservation,
				value.subject
			)
		).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'ARROW_OBSERVATION_INVALID' })],
			outcome: 'unavailable'
		});
	});

	it('rejects hostile shapes, reordered or duplicated populations, and endpoint changes', () => {
		const value = fixture();
		const graph = build(value);
		expectInvalid(value, null, 'SHAPE_INVALID');
		expectInvalid(value, new Proxy(graph, {}), 'SHAPE_INVALID');
		expectInvalid(value, { ...graph, unexpected: true }, 'SHAPE_INVALID');

		expectInvalid(
			value,
			finalized(graph, (draft) => {
				(draft as unknown as { nodes: CommandHandlerGraphNode[] }).nodes = [
					...draft.nodes
				].reverse();
			}),
			'ORDER_INVALID'
		);
		expectInvalid(
			value,
			finalized(graph, (draft) => {
				(draft as unknown as { edges: CommandHandlerGraphEdge[] }).edges = [
					...draft.edges
				].reverse();
			}),
			'ORDER_INVALID'
		);
		expectInvalid(
			value,
			finalized(graph, (draft) => {
				const command = draft.nodes.find((node) => node.kind === 'COMMAND_REGISTRY_ENTRY');
				if (command === undefined) throw new Error('Expected command node.');
				(draft as unknown as { nodes: CommandHandlerGraphNode[] }).nodes = [
					...draft.nodes,
					command
				];
			}),
			'DUPLICATE_ID'
		);
		expectInvalid(
			value,
			finalized(graph, (draft) => {
				const edge = draft.edges[0];
				if (edge === undefined) throw new Error('Expected edge.');
				(draft as unknown as { edges: CommandHandlerGraphEdge[] }).edges = [...draft.edges, edge];
			}),
			'ORDER_INVALID'
		);
		expectInvalid(
			value,
			finalized(graph, (draft) => {
				(draft as unknown as { nodes: CommandHandlerGraphNode[] }).nodes = draft.nodes.filter(
					(node) => node.kind !== 'HANDLER_TARGET'
				);
			}),
			'DANGLING_ENDPOINT'
		);

		const swapped = structuredClone(graph) as CommandHandlerGraphSnapshot;
		const commandEdge = swapped.edges.find(
			(edge) => edge.relationKind === 'COMMAND_REGISTRY_ENTRY_TO_HANDLER_REGISTRATION'
		);
		if (commandEdge === undefined) throw new Error('Expected command-registration edge.');
		const source = commandEdge.source;
		const target = commandEdge.target;
		Object.assign(commandEdge as unknown as { source: typeof target; target: typeof source }, {
			source: target,
			target: source
		});
		(commandEdge as { id: CommandHandlerGraphEdgeId }).id = commandHandlerGraphEdgeId({
			attribution: commandEdge.attribution,
			graphId: commandEdge.graphId,
			inferenceBasis: commandEdge.inferenceBasis,
			relationCode: commandEdge.relationCode,
			relationKind: commandEdge.relationKind,
			source: commandEdge.source,
			target: commandEdge.target
		});
		repairDerivedViews(swapped);
		(swapped as { contentDigest: string }).contentDigest =
			commandHandlerGraphContentDigest(swapped);
		expectInvalid(value, swapped, 'REGISTRY_POPULATION_MISMATCH');
	});

	it('rejects dropped edges and independently verifies indexes, layers, coverage, and content', () => {
		const value = fixture();
		const graph = build(value);

		const droppedEdge = structuredClone(graph) as CommandHandlerGraphSnapshot;
		(droppedEdge as unknown as { edges: CommandHandlerGraphEdge[] }).edges =
			droppedEdge.edges.slice(1);
		repairDerivedViews(droppedEdge);
		(droppedEdge as { contentDigest: string }).contentDigest =
			commandHandlerGraphContentDigest(droppedEdge);
		expectInvalid(value, droppedEdge, 'REGISTRY_POPULATION_MISMATCH');

		expectInvalid(
			value,
			finalized(graph, (draft) => {
				(draft as unknown as { forwardIndex: [] }).forwardIndex = [];
			}),
			'INDEX_MISMATCH'
		);
		expectInvalid(
			value,
			finalized(graph, (draft) => {
				(draft.layers[0] as unknown as { nodeIds: [] }).nodeIds = [];
			}),
			'IDENTITY_MISMATCH'
		);
		expectInvalid(
			value,
			finalized(graph, (draft) => {
				(draft.layers[1] as { ordinal: number }).ordinal = 0;
			}),
			'IDENTITY_MISMATCH'
		);
		expectInvalid(
			value,
			finalized(graph, (draft) => {
				(draft as { coverage: CommandHandlerGraphCoverage }).coverage = {
					...draft.coverage,
					exactEdges: draft.coverage.exactEdges - 1
				};
				repairDerivedViews(draft);
			}),
			'COVERAGE_MISMATCH'
		);

		const contentMutation = structuredClone(graph) as CommandHandlerGraphSnapshot;
		(contentMutation as { contentDigest: string }).contentDigest = '0'.repeat(64);
		expectInvalid(value, contentMutation, 'CONTENT_DIGEST_MISMATCH');
		expect(
			validateCommandHandlerGraph(graph, value.snapshot, value.observation, value.subject, {
				maxRecords: 1
			})
		).toMatchObject({
			issues: [expect.objectContaining({ code: 'BUDGET_EXHAUSTED' })],
			state: 'BUDGET_EXHAUSTED'
		});

		const sparse: unknown[] = [];
		sparse.length = 1_000_000_000;
		expect(
			validateCommandHandlerGraph(sparse, value.snapshot, value.observation, value.subject, {
				maxRecords: 10
			})
		).toMatchObject({
			issues: [expect.objectContaining({ code: 'BUDGET_EXHAUSTED' })],
			state: 'BUDGET_EXHAUSTED'
		});
	});

	it('rejects fully erased populations even when every dependent view and digest is repaired', () => {
		const value = fixture();
		const erased = structuredClone(build(value)) as CommandHandlerGraphSnapshot;
		const emptyCoverage: CommandHandlerGraphCoverage = {
			arrowAttributionClosure: 'OPEN',
			candidateEdges: 0,
			commandRegistryClosure: 'CLOSED',
			commandsWithArrowEvidence: 0,
			commandsWithoutArrowEvidence: 0,
			directHandlerArrowSites: 0,
			discoveredArrowOccurrences: 0,
			discoveredArrowSites: 0,
			discoveredCommandRegistryEntries: 0,
			discoveredHandlerRegistryEntries: 0,
			edges: 0,
			exactCommandRegistrations: 0,
			exactEdges: 0,
			factorySharedArrowSites: 0,
			frontierNodes: 0,
			handlerTargets: 0,
			missingHandlerRegistrations: 0,
			reconciles: true,
			representedArrowOccurrences: 0,
			representedArrowSites: 0,
			representedCommandRegistryEntries: 0,
			representedHandlerRegistryEntries: 0,
			tableCommandArrowSites: 0,
			undeclaredHandlerRegistrations: 0
		};
		(erased as unknown as { nodes: [] }).nodes = [];
		(erased as unknown as { edges: [] }).edges = [];
		(erased as unknown as { forwardIndex: [] }).forwardIndex = [];
		(erased as unknown as { reverseIndex: [] }).reverseIndex = [];
		(erased as { coverage: CommandHandlerGraphCoverage }).coverage = emptyCoverage;
		for (const layer of erased.layers)
			Object.assign(
				layer as unknown as {
					coverage: CommandHandlerGraphCoverage;
					edgeIds: [];
					nodeIds: [];
					provenanceIds: [];
				},
				{ coverage: emptyCoverage, edgeIds: [], nodeIds: [], provenanceIds: [] }
			);
		(erased as { contentDigest: string }).contentDigest = commandHandlerGraphContentDigest(erased);

		expectInvalid(value, erased, 'REGISTRY_POPULATION_MISMATCH');
		expectInvalid(value, erased, 'COVERAGE_MISMATCH');
	});

	it('rejects candidate promotion after repairing canonical identity and all derived views', () => {
		const value = fixture('FACTORY');
		const graph = build(value);
		expect(
			validateCommandHandlerGraph(graph, value.snapshot, value.observation, value.subject)
		).toEqual({ issues: [], state: 'VALID' });
		expect(graph.coverage).toMatchObject({
			candidateEdges: 2,
			exactEdges: 2,
			factorySharedArrowSites: 1,
			frontierNodes: 2
		});

		const promoted = structuredClone(graph) as CommandHandlerGraphSnapshot;
		const edge = promoted.edges.find((candidate) => candidate.attribution === 'CANDIDATE');
		if (edge === undefined) throw new Error('Expected a candidate edge.');
		Object.assign(
			edge as unknown as {
				attribution: 'EXACT';
				inferenceBasis: null;
				layerId: CommandHandlerGraphSnapshot['layers'][number]['id'];
			},
			{ attribution: 'EXACT', inferenceBasis: null, layerId: promoted.layers[0].id }
		);
		(edge as { id: CommandHandlerGraphEdgeId }).id = commandHandlerGraphEdgeId({
			attribution: edge.attribution,
			graphId: edge.graphId,
			inferenceBasis: edge.inferenceBasis,
			relationCode: edge.relationCode,
			relationKind: edge.relationKind,
			source: edge.source,
			target: edge.target
		});
		(promoted as { coverage: CommandHandlerGraphCoverage }).coverage = {
			...promoted.coverage,
			candidateEdges: promoted.coverage.candidateEdges - 1,
			exactEdges: promoted.coverage.exactEdges + 1
		};
		repairDerivedViews(promoted);
		(promoted as { contentDigest: string }).contentDigest =
			commandHandlerGraphContentDigest(promoted);

		expect(promoted.contentDigest).toBe(commandHandlerGraphContentDigest(promoted));
		expectInvalid(value, promoted, 'REGISTRY_POPULATION_MISMATCH');
	});
});
