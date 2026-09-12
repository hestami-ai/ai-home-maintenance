import type { ArrowCommandCensusObservation } from '../contracts/arrow-command-census.js';
import type {
	CommandHandlerGraphId,
	CommandHandlerGraphSnapshot
} from '../contracts/command-handler-graph.js';
import {
	COMMAND_DISPATCH_TOPOLOGY_AUTHORITY_TRANSFER,
	COMMAND_DISPATCH_TOPOLOGY_CANONICAL_PROFILE,
	COMMAND_DISPATCH_TOPOLOGY_DERIVATION_CAPABILITY,
	COMMAND_DISPATCH_TOPOLOGY_GATE_EFFECT,
	COMMAND_DISPATCH_TOPOLOGY_INFERENCE_CAPABILITY,
	COMMAND_DISPATCH_TOPOLOGY_METHOD,
	COMMAND_DISPATCH_TOPOLOGY_OPERATION_VERSION,
	COMMAND_DISPATCH_TOPOLOGY_ORACLE_CHANGE,
	COMMAND_DISPATCH_TOPOLOGY_REPLACEMENT_EQUIVALENCE,
	COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_EXECUTION,
	COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_INTEGRATION,
	COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_PATH,
	COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_VERIFIER_AUTHORITY,
	COMMAND_DISPATCH_TOPOLOGY_SCHEMA_VERSION,
	type BuildCommandDispatchTopologyRequest,
	type CommandDispatchTopologyEdge,
	type CommandDispatchTopologyEdgeId,
	type CommandDispatchTopologyGraphId,
	type CommandDispatchTopologyLayerId,
	type CommandDispatchTopologyNodeId,
	type CommandDispatchTopologySnapshot,
	type RetainedCommandDispatchCensusReference
} from '../contracts/command-dispatch-topology.js';
import type {
	SemanticDeclarationId,
	SemanticSnapshotId,
	StaticSemanticSnapshot
} from '../contracts/semantic.js';
import type { FrozenSubject } from '../contracts/subject.js';
import { sha256 } from '../inventory/canonical.js';
import { canonicalSemanticJson, canonicalSemanticJsonWitness } from '../semantic/canonical.js';

const ID_ALGORITHM_VERSION = '1';

function identity<Kind extends string>(prefix: string, domain: string, preimage: unknown): Kind {
	return `${prefix}-${sha256(
		`${domain}\0${ID_ALGORITHM_VERSION}\0${canonicalSemanticJson(preimage)}`
	)}` as Kind;
}

/**
 * Project the retained verifier reference without executing, importing, or interpreting it.
 * Exact-one selection is part of the input identity and therefore fails closed.
 */
export function commandDispatchTopologyRetainedCensusReference(
	subject: FrozenSubject
): RetainedCommandDispatchCensusReference {
	const artifacts = subject.artifacts.filter(
		(artifact) => artifact.path === COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_PATH
	);
	if (artifacts.length !== 1)
		throw new TypeError(
			`Expected exactly one retained command-dispatch census artifact; found ${artifacts.length}.`
		);
	return {
		artifactBytes: artifacts[0]!.bytes,
		artifactContentSha256: artifacts[0]!.sha256,
		artifactPath: COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_PATH,
		authorityTransfer: COMMAND_DISPATCH_TOPOLOGY_AUTHORITY_TRANSFER,
		execution: COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_EXECUTION,
		gateEffect: COMMAND_DISPATCH_TOPOLOGY_GATE_EFFECT,
		integration: COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_INTEGRATION,
		oracleChange: COMMAND_DISPATCH_TOPOLOGY_ORACLE_CHANGE,
		replacementEquivalence: COMMAND_DISPATCH_TOPOLOGY_REPLACEMENT_EQUIVALENCE,
		verifierAuthority: COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_VERIFIER_AUTHORITY
	};
}

/**
 * Bind only the normalized semantic populations the dispatch classifier may consume.
 * The upstream command-handler populations remain content-bound through their graph
 * digests and are deliberately not copied into this overlay input projection.
 */
export function commandDispatchTopologyInputDigest(
	request: BuildCommandDispatchTopologyRequest,
	snapshot: StaticSemanticSnapshot,
	commandHandlerGraph: CommandHandlerGraphSnapshot,
	arrowObservation: ArrowCommandCensusObservation,
	subject: FrozenSubject
): string {
	return canonicalSemanticJsonWitness({
		arrowObservation: {
			artifactSet: {
				artifactSetDigest: arrowObservation.artifactSet.artifactSetDigest,
				contentDigest: arrowObservation.artifactSet.contentDigest,
				id: arrowObservation.artifactSet.id,
				method: arrowObservation.artifactSet.method,
				schemaVersion: arrowObservation.artifactSet.schemaVersion,
				subjectId: arrowObservation.artifactSet.subjectId
			},
			authorityTransfer: arrowObservation.authorityTransfer,
			canonicalProfile: arrowObservation.canonicalProfile,
			contentDigest: arrowObservation.contentDigest,
			declaredArrowIds: arrowObservation.declaredArrows.map((arrow) => arrow.id),
			declaredSiteIds: arrowObservation.declaredSites.map((site) => site.id),
			fullJanCsaa007Conformance: arrowObservation.fullJanCsaa007Conformance,
			fullJanCsaa008Conformance: arrowObservation.fullJanCsaa008Conformance,
			gateEffect: arrowObservation.gateEffect,
			id: arrowObservation.id,
			integrationStrategy: arrowObservation.integrationStrategy,
			method: arrowObservation.method,
			operationVersion: arrowObservation.operationVersion,
			oracleChange: arrowObservation.oracleChange,
			replacementEquivalence: arrowObservation.replacementEquivalence,
			schemaVersion: arrowObservation.schemaVersion,
			subjectId: arrowObservation.subjectId,
			verifierAuthority: arrowObservation.verifierAuthority
		},
		commandHandlerGraph: {
			contentDigest: commandHandlerGraph.contentDigest,
			graphInputDigest: commandHandlerGraph.graphInputDigest,
			id: commandHandlerGraph.id,
			schemaVersion: commandHandlerGraph.schemaVersion,
			semanticSnapshotId: commandHandlerGraph.semanticSnapshotId,
			subjectId: commandHandlerGraph.subjectId
		},
		request: {
			budgets: request.budgets,
			commandBus: request.commandBus,
			commandHandlerGraphId: request.commandHandlerGraphId,
			operationVersion: request.operationVersion,
			schemaVersion: request.schemaVersion,
			semanticSnapshotId: request.semanticSnapshotId,
			subjectId: request.subjectId
		},
		retainedCommandDispatchCensus: commandDispatchTopologyRetainedCensusReference(subject),
		semanticSnapshot: {
			aliases: snapshot.aliases,
			assignments: snapshot.assignments,
			astNodes: snapshot.astNodes,
			astTraversalProfile: snapshot.astTraversalProfile,
			canonicalProfile: snapshot.canonicalProfile,
			capabilities: snapshot.capabilities,
			contextDigest: snapshot.contextDigest,
			declarationCandidates: snapshot.declarationCandidates,
			declarations: snapshot.declarations,
			expectedEmpty: snapshot.expectedEmpty,
			extractionVersion: snapshot.extractionVersion,
			health: snapshot.health,
			id: snapshot.id,
			invocations: snapshot.invocations,
			literals: snapshot.literals,
			operationVersion: snapshot.operationVersion,
			programs: snapshot.programs,
			projects: snapshot.projects,
			provenances: snapshot.provenances,
			provider: snapshot.provider,
			references: snapshot.references,
			requestedCapabilities: snapshot.requestedCapabilities,
			schemaVersion: snapshot.schemaVersion,
			scopes: snapshot.scopes,
			sources: snapshot.sources,
			subjectId: snapshot.subjectId,
			symbols: snapshot.symbols
		},
		subject: {
			fileManifestDigest: subject.descriptor.fileManifestDigest,
			schemaVersion: subject.descriptor.schemaVersion,
			subjectId: subject.descriptor.subjectId
		}
	}).sha256;
}

export interface CommandDispatchTopologyGraphIdentityInput {
	readonly canonicalProfile: typeof COMMAND_DISPATCH_TOPOLOGY_CANONICAL_PROFILE;
	readonly commandHandlerGraphId: CommandHandlerGraphId;
	readonly graphInputDigest: string;
	readonly method: typeof COMMAND_DISPATCH_TOPOLOGY_METHOD;
	readonly operationVersion: typeof COMMAND_DISPATCH_TOPOLOGY_OPERATION_VERSION;
	readonly schemaVersion: typeof COMMAND_DISPATCH_TOPOLOGY_SCHEMA_VERSION;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
}

export function commandDispatchTopologyGraphId(
	input: CommandDispatchTopologyGraphIdentityInput
): CommandDispatchTopologyGraphId {
	return identity<CommandDispatchTopologyGraphId>(
		'graph:command-dispatch-topology',
		'JAN-CSAA-COMMAND-DISPATCH-TOPOLOGY-GRAPH',
		input
	);
}

export function commandDispatchTopologyDerivationLayerId(
	graphId: CommandDispatchTopologyGraphId
): CommandDispatchTopologyLayerId {
	return identity<CommandDispatchTopologyLayerId>(
		'graph-layer:command-dispatch-topology',
		'JAN-CSAA-COMMAND-DISPATCH-TOPOLOGY-LAYER',
		{
			capability: COMMAND_DISPATCH_TOPOLOGY_DERIVATION_CAPABILITY,
			graphId,
			kind: 'JPWB_COMMAND_DISPATCH_DERIVATION',
			ordinal: 0
		}
	);
}

export function commandDispatchTopologyInferenceLayerId(
	graphId: CommandDispatchTopologyGraphId
): CommandDispatchTopologyLayerId {
	return identity<CommandDispatchTopologyLayerId>(
		'graph-layer:command-dispatch-topology',
		'JAN-CSAA-COMMAND-DISPATCH-TOPOLOGY-LAYER',
		{
			capability: COMMAND_DISPATCH_TOPOLOGY_INFERENCE_CAPABILITY,
			graphId,
			kind: 'JPWB_COMMAND_DISPATCH_HANDLER_TARGET_INFERENCE',
			ordinal: 1
		}
	);
}

export function commandDispatchPipelineNodeId(
	graphId: CommandDispatchTopologyGraphId,
	commandBusDeclarationId: SemanticDeclarationId
): CommandDispatchTopologyNodeId {
	return identity<CommandDispatchTopologyNodeId>(
		'graph-node:command-dispatch-pipeline',
		'JAN-CSAA-COMMAND-DISPATCH-TOPOLOGY-PIPELINE-NODE',
		{ commandBusDeclarationId, graphId }
	);
}

export function commandDispatchTopologyEdgeId(input: {
	readonly graphId: CommandDispatchTopologyGraphId;
	readonly inferenceBasis: CommandDispatchTopologyEdge['inferenceBasis'];
	readonly registeredCommandNames: CommandDispatchTopologyEdge['registeredCommandNames'];
	readonly relationCode: CommandDispatchTopologyEdge['relationCode'];
	readonly relationKind: CommandDispatchTopologyEdge['relationKind'];
	readonly source: CommandDispatchTopologyEdge['source'];
	readonly target: CommandDispatchTopologyEdge['target'];
}): CommandDispatchTopologyEdgeId {
	return identity<CommandDispatchTopologyEdgeId>(
		'graph-edge:command-dispatch-topology',
		'JAN-CSAA-COMMAND-DISPATCH-TOPOLOGY-EDGE',
		input
	);
}

export type CommandDispatchTopologyContent = Omit<CommandDispatchTopologySnapshot, 'contentDigest'>;

export function commandDispatchTopologyContentDigest(
	graph: CommandDispatchTopologySnapshot | CommandDispatchTopologyContent
): string {
	const { contentDigest: _contentDigest, ...content } = graph as CommandDispatchTopologySnapshot;
	return canonicalSemanticJsonWitness(content).sha256;
}
