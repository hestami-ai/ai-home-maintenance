import {
	COMMAND_EVENT_CONTRACT_OVERLAY_AUTHORITY_TRANSFER,
	COMMAND_EVENT_CONTRACT_OVERLAY_CANONICAL_PROFILE,
	COMMAND_EVENT_CONTRACT_OVERLAY_DERIVATION_CAPABILITY,
	COMMAND_EVENT_CONTRACT_OVERLAY_GATE_EFFECT,
	COMMAND_EVENT_CONTRACT_OVERLAY_INFERENCE_CAPABILITY,
	COMMAND_EVENT_CONTRACT_OVERLAY_METHOD,
	COMMAND_EVENT_CONTRACT_OVERLAY_OPERATION_VERSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_ORACLE_CHANGE,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPLACEMENT_EQUIVALENCE,
	COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_AUTHORITY,
	COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_EXECUTION,
	COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_INTEGRATION,
	COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH,
	COMMAND_EVENT_CONTRACT_OVERLAY_SCHEMA_VERSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH,
	type CommandEventContractArtifactSelector,
	type CommandEventContractBoundContributionId,
	type CommandEventContractCommandId,
	type CommandEventContractDeclaredLinkId,
	type CommandEventContractEventId,
	type CommandEventContractFrontierId,
	type CommandEventContractFrontierKind,
	type CommandEventContractLayerId,
	type CommandEventContractOverlayBuildInputs,
	type CommandEventContractOverlayId,
	type CommandEventContractOverlaySnapshot,
	type CommandEventContractPinnedEmissionId,
	type RetainedEventSurfaceCensusReference
} from '../contracts/command-event-contract-overlay.js';
import type { SemanticSnapshotId, StaticSemanticSnapshot } from '../contracts/semantic.js';
import type { FrozenSubject } from '../contracts/subject.js';
import { sha256 } from '../inventory/canonical.js';
import { canonicalSemanticJson, canonicalSemanticJsonWitness } from '../semantic/canonical.js';

const ID_ALGORITHM_VERSION = '1';

function identity<Kind extends string>(prefix: string, domain: string, preimage: unknown): Kind {
	return `${prefix}-${sha256(
		`${domain}\0${ID_ALGORITHM_VERSION}\0${canonicalSemanticJson(preimage)}`
	)}` as Kind;
}

function exactArtifactSelector(
	subject: FrozenSubject,
	path:
		| typeof COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH
		| typeof COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH
): CommandEventContractArtifactSelector {
	const artifacts = subject.artifacts.filter((artifact) => artifact.path === path);
	if (artifacts.length !== 1)
		throw new TypeError(`Expected exactly one ${path} artifact; found ${artifacts.length}.`);
	return {
		artifactBytes: artifacts[0]!.bytes,
		artifactContentSha256: artifacts[0]!.sha256,
		artifactPath: path
	};
}

export function commandEventContractRetainedCensusArtifactSelector(
	subject: FrozenSubject
): CommandEventContractArtifactSelector & {
	readonly artifactPath: typeof COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH;
} {
	return exactArtifactSelector(
		subject,
		COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH
	) as CommandEventContractArtifactSelector & {
		readonly artifactPath: typeof COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH;
	};
}

export function commandEventContractVocabArtifactSelector(
	subject: FrozenSubject
): CommandEventContractArtifactSelector & {
	readonly artifactPath: typeof COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH;
} {
	return exactArtifactSelector(
		subject,
		COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH
	) as CommandEventContractArtifactSelector & {
		readonly artifactPath: typeof COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH;
	};
}

export function commandEventContractRetainedCensusReference(
	subject: FrozenSubject
): RetainedEventSurfaceCensusReference {
	return {
		...commandEventContractRetainedCensusArtifactSelector(subject),
		authorityTransfer: COMMAND_EVENT_CONTRACT_OVERLAY_AUTHORITY_TRANSFER,
		execution: COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_EXECUTION,
		gateEffect: COMMAND_EVENT_CONTRACT_OVERLAY_GATE_EFFECT,
		integration: COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_INTEGRATION,
		oracleChange: COMMAND_EVENT_CONTRACT_OVERLAY_ORACLE_CHANGE,
		replacementEquivalence: COMMAND_EVENT_CONTRACT_OVERLAY_REPLACEMENT_EQUIVALENCE,
		verifierAuthority: COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_AUTHORITY
	};
}

function selectedSemanticFacts(
	snapshot: StaticSemanticSnapshot,
	sourceId: CommandEventContractOverlayBuildInputs['request']['eventRegistry']['sourceId']
): unknown {
	const nodeIds = new Set(
		snapshot.astNodes.filter((node) => node.sourceId === sourceId).map((node) => node.id)
	);
	const declarationIds = new Set(
		snapshot.declarations
			.filter((declaration) => declaration.sourceId === sourceId)
			.map((declaration) => declaration.id)
	);
	const symbolIds = new Set(
		snapshot.declarations
			.filter((declaration) => declaration.sourceId === sourceId)
			.flatMap((declaration) => (declaration.symbolId === null ? [] : [declaration.symbolId]))
	);
	for (const reference of snapshot.references)
		if (reference.sourceId === sourceId && reference.resolvedSymbolId !== null)
			symbolIds.add(reference.resolvedSymbolId);
	return {
		assignments: snapshot.assignments.filter(
			(assignment) =>
				nodeIds.has(assignment.nodeId) ||
				nodeIds.has(assignment.targetNodeId) ||
				(assignment.valueNodeId !== null && nodeIds.has(assignment.valueNodeId))
		),
		astNodes: snapshot.astNodes.filter((node) => node.sourceId === sourceId),
		declarationCandidates: snapshot.declarationCandidates.filter(
			(candidate) => candidate.sourceId === sourceId
		),
		declarations: snapshot.declarations.filter((declaration) => declaration.sourceId === sourceId),
		literals: snapshot.literals.filter((literal) => literal.sourceId === sourceId),
		references: snapshot.references.filter((reference) => reference.sourceId === sourceId),
		source: snapshot.sources.filter((source) => source.id === sourceId),
		symbols: snapshot.symbols.filter(
			(symbol) =>
				symbolIds.has(symbol.id) ||
				symbol.declarationIds.some((declarationId) => declarationIds.has(declarationId))
		)
	};
}

/** Binds only the selected generated-registry semantic facts and explicit predecessors. */
export function commandEventContractOverlayInputDigest(
	inputs: CommandEventContractOverlayBuildInputs
): string {
	return canonicalSemanticJsonWitness({
		arrowObservation: {
			artifactSetContentDigest: inputs.arrowObservation.artifactSet.contentDigest,
			artifactSetId: inputs.arrowObservation.artifactSet.id,
			contentDigest: inputs.arrowObservation.contentDigest,
			id: inputs.arrowObservation.id,
			schemaVersion: inputs.arrowObservation.schemaVersion,
			subjectId: inputs.arrowObservation.subjectId
		},
		commandHandlerGraph: {
			contentDigest: inputs.commandHandlerGraph.contentDigest,
			graphInputDigest: inputs.commandHandlerGraph.graphInputDigest,
			id: inputs.commandHandlerGraph.id,
			schemaVersion: inputs.commandHandlerGraph.schemaVersion,
			semanticSnapshotId: inputs.commandHandlerGraph.semanticSnapshotId,
			subjectId: inputs.commandHandlerGraph.subjectId
		},
		commandHandlerRequest: inputs.commandHandlerRequest,
		request: inputs.request,
		semanticSnapshot: {
			capabilities: inputs.semanticSnapshot.capabilities,
			contextDigest: inputs.semanticSnapshot.contextDigest,
			extractionVersion: inputs.semanticSnapshot.extractionVersion,
			id: inputs.semanticSnapshot.id,
			registryFacts: selectedSemanticFacts(
				inputs.semanticSnapshot,
				inputs.request.eventRegistry.sourceId
			),
			schemaVersion: inputs.semanticSnapshot.schemaVersion,
			subjectId: inputs.semanticSnapshot.subjectId
		},
		subject: {
			fileManifestDigest: inputs.subject.descriptor.fileManifestDigest,
			retainedCensus: commandEventContractRetainedCensusReference(inputs.subject),
			schemaVersion: inputs.subject.descriptor.schemaVersion,
			subjectId: inputs.subject.descriptor.subjectId,
			vocabArtifact: commandEventContractVocabArtifactSelector(inputs.subject)
		}
	}).sha256;
}

export function commandEventContractOverlayId(input: {
	readonly inputDigest: string;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
}): CommandEventContractOverlayId {
	return identity<CommandEventContractOverlayId>(
		'overlay:command-event-contract',
		'JAN-CSAA-COMMAND-EVENT-CONTRACT-OVERLAY',
		{
			canonicalProfile: COMMAND_EVENT_CONTRACT_OVERLAY_CANONICAL_PROFILE,
			inputDigest: input.inputDigest,
			method: COMMAND_EVENT_CONTRACT_OVERLAY_METHOD,
			operationVersion: COMMAND_EVENT_CONTRACT_OVERLAY_OPERATION_VERSION,
			schemaVersion: COMMAND_EVENT_CONTRACT_OVERLAY_SCHEMA_VERSION,
			semanticSnapshotId: input.semanticSnapshotId,
			subjectId: input.subjectId
		}
	);
}

export function commandEventContractCommandId(
	overlayId: CommandEventContractOverlayId,
	commandName: string
): CommandEventContractCommandId {
	return identity<CommandEventContractCommandId>(
		'command-event-command',
		'JAN-CSAA-COMMAND-EVENT-CONTRACT-COMMAND',
		{ commandName, overlayId }
	);
}

export function commandEventContractEventId(
	overlayId: CommandEventContractOverlayId,
	eventName: string
): CommandEventContractEventId {
	return identity<CommandEventContractEventId>(
		'command-event-event',
		'JAN-CSAA-COMMAND-EVENT-CONTRACT-EVENT',
		{ eventName, overlayId }
	);
}

export function commandEventContractDeclaredLinkId(input: {
	readonly commandName: string;
	readonly eventName: string;
	readonly ordinal: number;
	readonly overlayId: CommandEventContractOverlayId;
	readonly role: 'ADDITIONAL' | 'PRIMARY';
}): CommandEventContractDeclaredLinkId {
	return identity<CommandEventContractDeclaredLinkId>(
		'command-event-declared-link',
		'JAN-CSAA-COMMAND-EVENT-CONTRACT-DECLARED-LINK',
		input
	);
}

export function commandEventContractBoundContributionId(input: {
	readonly commandName: string;
	readonly eventName: string;
	readonly ordinal: number;
	readonly overlayId: CommandEventContractOverlayId;
	readonly sourceKind: 'COMMAND_PRIMARY' | 'TRANSITION_BINDING';
}): CommandEventContractBoundContributionId {
	return identity<CommandEventContractBoundContributionId>(
		'command-event-bound-contribution',
		'JAN-CSAA-COMMAND-EVENT-CONTRACT-BOUND-CONTRIBUTION',
		input
	);
}

export function commandEventContractPinnedEmissionId(input: {
	readonly eventName: string;
	readonly ordinal: number;
	readonly overlayId: CommandEventContractOverlayId;
}): CommandEventContractPinnedEmissionId {
	return identity<CommandEventContractPinnedEmissionId>(
		'command-event-pinned-emission',
		'JAN-CSAA-COMMAND-EVENT-CONTRACT-PINNED-EMISSION',
		input
	);
}

export function commandEventContractFrontierId(input: {
	readonly commandId: CommandEventContractCommandId | null;
	readonly eventId: CommandEventContractEventId | null;
	readonly eventName: string | null;
	readonly frontierKind: CommandEventContractFrontierKind;
	readonly overlayId: CommandEventContractOverlayId;
}): CommandEventContractFrontierId {
	return identity<CommandEventContractFrontierId>(
		'command-event-frontier',
		'JAN-CSAA-COMMAND-EVENT-CONTRACT-FRONTIER',
		input
	);
}

export function commandEventContractLayerId(
	overlayId: CommandEventContractOverlayId,
	kind: 'DERIVATION' | 'INFERENCE'
): CommandEventContractLayerId {
	return identity<CommandEventContractLayerId>(
		'command-event-layer',
		'JAN-CSAA-COMMAND-EVENT-CONTRACT-LAYER',
		{
			capability:
				kind === 'DERIVATION'
					? COMMAND_EVENT_CONTRACT_OVERLAY_DERIVATION_CAPABILITY
					: COMMAND_EVENT_CONTRACT_OVERLAY_INFERENCE_CAPABILITY,
			kind,
			overlayId
		}
	);
}

export const commandEventContractDerivationLayerId = (
	overlayId: CommandEventContractOverlayId
): CommandEventContractLayerId => commandEventContractLayerId(overlayId, 'DERIVATION');

export const commandEventContractInferenceLayerId = (
	overlayId: CommandEventContractOverlayId
): CommandEventContractLayerId => commandEventContractLayerId(overlayId, 'INFERENCE');

export type CommandEventContractOverlayContent = Omit<
	CommandEventContractOverlaySnapshot,
	'contentDigest'
>;

export function commandEventContractOverlayContentDigest(
	overlay: CommandEventContractOverlaySnapshot | CommandEventContractOverlayContent
): string {
	const { contentDigest: _contentDigest, ...content } =
		overlay as CommandEventContractOverlaySnapshot;
	return canonicalSemanticJsonWitness(content).sha256;
}
