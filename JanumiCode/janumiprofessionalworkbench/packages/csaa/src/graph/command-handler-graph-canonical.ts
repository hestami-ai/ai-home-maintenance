import type {
	ArrowCommandCensusDeclaredArrowId,
	ArrowCommandCensusDeclaredSiteId,
	ArrowCommandCensusObservation
} from '../contracts/arrow-command-census.js';
import type {
	BuildCommandHandlerGraphRequest,
	CommandHandlerGraphEdge,
	CommandHandlerGraphEdgeId,
	CommandHandlerGraphId,
	CommandHandlerGraphLayer,
	CommandHandlerGraphLayerId,
	CommandHandlerGraphNodeId,
	CommandHandlerGraphSnapshot
} from '../contracts/command-handler-graph.js';
import type {
	SemanticNodeId,
	SemanticSymbolId,
	StaticSemanticSnapshot
} from '../contracts/semantic.js';
import { sha256 } from '../inventory/canonical.js';
import { canonicalSemanticJson, canonicalSemanticJsonWitness } from '../semantic/canonical.js';

const ID_ALGORITHM_VERSION = '1';

function identity<Kind extends string>(prefix: string, domain: string, preimage: unknown): Kind {
	return `${prefix}-${sha256(
		`${domain}\0${ID_ALGORITHM_VERSION}\0${canonicalSemanticJson(preimage)}`
	)}` as Kind;
}

export function commandHandlerGraphInputDigest(
	request: BuildCommandHandlerGraphRequest,
	snapshot: StaticSemanticSnapshot,
	observation: ArrowCommandCensusObservation
): string {
	return canonicalSemanticJsonWitness({
		arrowObservation: {
			artifactSet: observation.artifactSet,
			authorityTransfer: observation.authorityTransfer,
			canonicalProfile: observation.canonicalProfile,
			contentDigest: observation.contentDigest,
			coverage: observation.coverage,
			declaredArrows: observation.declaredArrows,
			declaredSites: observation.declaredSites,
			epistemic: observation.epistemic,
			fullJanCsaa007Conformance: observation.fullJanCsaa007Conformance,
			fullJanCsaa008Conformance: observation.fullJanCsaa008Conformance,
			gateEffect: observation.gateEffect,
			id: observation.id,
			integrationStrategy: observation.integrationStrategy,
			limitations: observation.limitations,
			method: observation.method,
			operationVersion: observation.operationVersion,
			oracleChange: observation.oracleChange,
			replacementEquivalence: observation.replacementEquivalence,
			schemaVersion: observation.schemaVersion,
			subjectId: observation.subjectId,
			verifierAuthority: observation.verifierAuthority
		},
		request: {
			arrowObservationId: request.arrowObservationId,
			budgets: request.budgets,
			commandRegistry: request.commandRegistry,
			handlerRegistry: request.handlerRegistry,
			operationVersion: request.operationVersion,
			schemaVersion: request.schemaVersion,
			semanticSnapshotId: request.semanticSnapshotId,
			subjectId: request.subjectId
		},
		semanticSnapshot: {
			aliases: snapshot.aliases,
			assignments: snapshot.assignments,
			astNodes: snapshot.astNodes,
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
		}
	}).sha256;
}

export function commandHandlerGraphId(input: {
	readonly arrowObservationId: string;
	readonly canonicalProfile: string;
	readonly graphInputDigest: string;
	readonly method: string;
	readonly operationVersion: string;
	readonly schemaVersion: string;
	readonly semanticSnapshotId: string;
	readonly subjectId: string;
}): CommandHandlerGraphId {
	return identity<CommandHandlerGraphId>(
		'graph:command-handler',
		'JAN-CSAA-COMMAND-HANDLER-GRAPH',
		input
	);
}

function commandHandlerGraphLayerId(
	graphId: CommandHandlerGraphId,
	input: {
		readonly capability: CommandHandlerGraphLayer['capability'];
		readonly kind: CommandHandlerGraphLayer['kind'];
		readonly ordinal: CommandHandlerGraphLayer['ordinal'];
	}
): CommandHandlerGraphLayerId {
	return identity<CommandHandlerGraphLayerId>(
		'graph-layer:command-handler',
		'JAN-CSAA-COMMAND-HANDLER-GRAPH-LAYER',
		{ graphId, ...input }
	);
}

export function commandHandlerDerivationLayerId(
	graphId: CommandHandlerGraphId
): CommandHandlerGraphLayerId {
	return commandHandlerGraphLayerId(graphId, {
		capability: 'JAN-CSAA-CAP-027',
		kind: 'JPWB_COMMAND_HANDLER_DERIVATION',
		ordinal: 0
	});
}

export function commandHandlerInferenceLayerId(
	graphId: CommandHandlerGraphId
): CommandHandlerGraphLayerId {
	return commandHandlerGraphLayerId(graphId, {
		capability: 'JAN-CSAA-CAP-028',
		kind: 'JPWB_COMMAND_HANDLER_INFERENCE',
		ordinal: 1
	});
}

export function commandRegistryEntryNodeId(
	graphId: CommandHandlerGraphId,
	propertyNodeId: SemanticNodeId
): CommandHandlerGraphNodeId {
	return identity<CommandHandlerGraphNodeId>(
		'graph-node:command-registry-entry',
		'JAN-CSAA-COMMAND-HANDLER-COMMAND-REGISTRY-ENTRY',
		{ graphId, propertyNodeId }
	);
}

export function handlerRegistrationNodeId(
	graphId: CommandHandlerGraphId,
	propertyNodeId: SemanticNodeId
): CommandHandlerGraphNodeId {
	return identity<CommandHandlerGraphNodeId>(
		'graph-node:handler-registration',
		'JAN-CSAA-COMMAND-HANDLER-REGISTRATION',
		{ graphId, propertyNodeId }
	);
}

export function handlerTargetNodeId(
	graphId: CommandHandlerGraphId,
	input: {
		readonly nodeId: SemanticNodeId;
		readonly symbolId: SemanticSymbolId;
	}
): CommandHandlerGraphNodeId {
	return identity<CommandHandlerGraphNodeId>(
		'graph-node:handler-target',
		'JAN-CSAA-COMMAND-HANDLER-TARGET',
		{ graphId, ...input }
	);
}

export function commandArrowSiteNodeId(
	graphId: CommandHandlerGraphId,
	observationSiteId: ArrowCommandCensusDeclaredSiteId
): CommandHandlerGraphNodeId {
	return identity<CommandHandlerGraphNodeId>(
		'graph-node:command-arrow-site',
		'JAN-CSAA-COMMAND-HANDLER-ARROW-SITE',
		{ graphId, observationSiteId }
	);
}

export function commandArrowOccurrenceNodeId(
	graphId: CommandHandlerGraphId,
	observationArrowId: ArrowCommandCensusDeclaredArrowId
): CommandHandlerGraphNodeId {
	return identity<CommandHandlerGraphNodeId>(
		'graph-node:command-arrow-occurrence',
		'JAN-CSAA-COMMAND-HANDLER-ARROW-OCCURRENCE',
		{ graphId, observationArrowId }
	);
}

export function commandHandlerFrontierNodeId(
	graphId: CommandHandlerGraphId,
	input:
		| {
				readonly commandNodeId: CommandHandlerGraphNodeId;
				readonly frontierKind:
					'COMMAND_WITHOUT_DECLARED_ARROW_EVIDENCE' | 'MISSING_HANDLER_REGISTRATION';
		  }
		| {
				readonly frontierKind:
					| 'FACTORY_HANDLER_TARGET_NOT_CONFIRMED'
					| 'UNDECLARED_HANDLER_REGISTRATION'
					| 'UNRESOLVED_HANDLER_TARGET';
				readonly registrationNodeId: CommandHandlerGraphNodeId;
		  }
		| {
				readonly frontierKind:
					'FACTORY_SITE_ATTRIBUTION_AMBIGUOUS' | 'SITE_OWNER_NOT_REGISTERED_HANDLER';
				readonly siteNodeId: CommandHandlerGraphNodeId;
		  }
): CommandHandlerGraphNodeId {
	return identity<CommandHandlerGraphNodeId>(
		'graph-node:command-handler-frontier',
		'JAN-CSAA-COMMAND-HANDLER-FRONTIER',
		{ graphId, ...input }
	);
}

export function commandHandlerGraphEdgeId(input: {
	readonly attribution: CommandHandlerGraphEdge['attribution'];
	readonly graphId: CommandHandlerGraphId;
	readonly inferenceBasis: CommandHandlerGraphEdge['inferenceBasis'];
	readonly relationCode: CommandHandlerGraphEdge['relationCode'];
	readonly relationKind: CommandHandlerGraphEdge['relationKind'];
	readonly source: CommandHandlerGraphEdge['source'];
	readonly target: CommandHandlerGraphEdge['target'];
}): CommandHandlerGraphEdgeId {
	return identity<CommandHandlerGraphEdgeId>(
		'graph-edge:command-handler',
		'JAN-CSAA-COMMAND-HANDLER-EDGE',
		input
	);
}

export type CommandHandlerGraphContent = Omit<CommandHandlerGraphSnapshot, 'contentDigest'>;

export function commandHandlerGraphContentDigest(
	graph: CommandHandlerGraphSnapshot | CommandHandlerGraphContent
): string {
	const { contentDigest: _contentDigest, ...content } = graph as CommandHandlerGraphSnapshot;
	return canonicalSemanticJsonWitness(content).sha256;
}

export function layerIdentityInput(layer: CommandHandlerGraphLayer): unknown {
	return {
		capability: layer.capability,
		graphId: layer.graphId,
		kind: layer.kind,
		ordinal: layer.ordinal
	};
}
