import {
	GUARD_CLASSIFICATION_OVERLAY_CANONICAL_PROFILE,
	GUARD_CLASSIFICATION_OVERLAY_DERIVATION_CAPABILITY,
	GUARD_CLASSIFICATION_OVERLAY_INFERENCE_CAPABILITY,
	GUARD_CLASSIFICATION_OVERLAY_METHOD,
	GUARD_CLASSIFICATION_OVERLAY_OPERATION_VERSION,
	GUARD_CLASSIFICATION_OVERLAY_SCHEMA_VERSION,
	type GuardClassificationOverlayAnchorSiteId,
	type GuardClassificationOverlayBuildInputs,
	type GuardClassificationOverlayClassificationId,
	type GuardClassificationOverlayCommandEvidenceLinkId,
	type GuardClassificationOverlayFrontierId,
	type GuardClassificationOverlayFrontierKind,
	type GuardClassificationOverlayHandlerLinkId,
	type GuardClassificationOverlayId,
	type GuardClassificationOverlayLayerId,
	type GuardClassificationOverlayOccurrenceId,
	type GuardClassificationOverlaySnapshot
} from '../contracts/guard-classification-overlay.js';
import type {
	GuardEnforcementLedgerArrowId,
	GuardEnforcementLedgerGuardId
} from '../contracts/guard-enforcement-ledger.js';
import type { SemanticNodeId, SemanticSnapshotId } from '../contracts/semantic.js';
import { sha256 } from '../inventory/canonical.js';
import { canonicalSemanticJson, canonicalSemanticJsonWitness } from '../semantic/canonical.js';

const ID_ALGORITHM_VERSION = '1';

function identity<Kind extends string>(prefix: string, domain: string, preimage: unknown): Kind {
	return `${prefix}-${sha256(
		`${domain}\0${ID_ALGORITHM_VERSION}\0${canonicalSemanticJson(preimage)}`
	)}` as Kind;
}

/** Binds explicit predecessor requests as well as the independently validated predecessor products. */
export function guardClassificationOverlayInputDigest(
	inputs: GuardClassificationOverlayBuildInputs
): string {
	return canonicalSemanticJsonWitness({
		arrowObservation: {
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
		guardObservation: {
			artifactSetId: inputs.guardObservation.artifactSet.id,
			contentDigest: inputs.guardObservation.contentDigest,
			id: inputs.guardObservation.id,
			schemaVersion: inputs.guardObservation.schemaVersion,
			subjectId: inputs.guardObservation.subjectId
		},
		request: inputs.request,
		semanticSnapshot: {
			contextDigest: inputs.semanticSnapshot.contextDigest,
			extractionVersion: inputs.semanticSnapshot.extractionVersion,
			id: inputs.semanticSnapshot.id,
			schemaVersion: inputs.semanticSnapshot.schemaVersion,
			subjectId: inputs.semanticSnapshot.subjectId
		},
		stateGraph: {
			contentDigest: inputs.stateGraph.contentDigest,
			graphInputDigest: inputs.stateGraph.graphInputDigest,
			id: inputs.stateGraph.id,
			schemaVersion: inputs.stateGraph.schemaVersion,
			semanticSnapshotId: inputs.stateGraph.semanticSnapshotId,
			subjectId: inputs.stateGraph.subjectId
		},
		stateGraphRequest: inputs.stateGraphRequest,
		stateObservation: {
			contentDigest: inputs.stateObservation.contentDigest,
			id: inputs.stateObservation.id,
			schemaVersion: inputs.stateObservation.schemaVersion,
			subjectId: inputs.stateObservation.subjectId
		},
		subject: {
			fileManifestDigest: inputs.subject.descriptor.fileManifestDigest,
			schemaVersion: inputs.subject.descriptor.schemaVersion,
			subjectId: inputs.subject.descriptor.subjectId
		}
	}).sha256;
}

export function guardClassificationOverlayId(input: {
	readonly inputDigest: string;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
}): GuardClassificationOverlayId {
	return identity<GuardClassificationOverlayId>(
		'overlay:guard-classification',
		'JAN-CSAA-GUARD-CLASSIFICATION-OVERLAY',
		{
			canonicalProfile: GUARD_CLASSIFICATION_OVERLAY_CANONICAL_PROFILE,
			inputDigest: input.inputDigest,
			method: GUARD_CLASSIFICATION_OVERLAY_METHOD,
			operationVersion: GUARD_CLASSIFICATION_OVERLAY_OPERATION_VERSION,
			schemaVersion: GUARD_CLASSIFICATION_OVERLAY_SCHEMA_VERSION,
			semanticSnapshotId: input.semanticSnapshotId,
			subjectId: input.subjectId
		}
	);
}

export function guardClassificationRecordId(
	overlayId: GuardClassificationOverlayId,
	guardId: GuardEnforcementLedgerGuardId
): GuardClassificationOverlayClassificationId {
	return identity<GuardClassificationOverlayClassificationId>(
		'guard-classification',
		'JAN-CSAA-GUARD-CLASSIFICATION-RECORD',
		{ guardId, overlayId }
	);
}

export function guardOccurrenceRecordId(
	overlayId: GuardClassificationOverlayId,
	arrowId: GuardEnforcementLedgerArrowId
): GuardClassificationOverlayOccurrenceId {
	return identity<GuardClassificationOverlayOccurrenceId>(
		'guard-occurrence',
		'JAN-CSAA-GUARD-CLASSIFICATION-OCCURRENCE',
		{ arrowId, overlayId }
	);
}

export function guardCommandEvidenceLinkId(input: {
	readonly commandOccurrenceNodeId: string;
	readonly occurrenceId: GuardClassificationOverlayOccurrenceId;
	readonly overlayId: GuardClassificationOverlayId;
}): GuardClassificationOverlayCommandEvidenceLinkId {
	return identity<GuardClassificationOverlayCommandEvidenceLinkId>(
		'guard-command-evidence',
		'JAN-CSAA-GUARD-COMMAND-EVIDENCE-LINK',
		input
	);
}

export function guardEnforcementAnchorSiteId(input: {
	readonly anchorText: string;
	readonly end: number;
	readonly overlayId: GuardClassificationOverlayId;
	readonly sourceId: string;
	readonly start: number;
}): GuardClassificationOverlayAnchorSiteId {
	return identity<GuardClassificationOverlayAnchorSiteId>(
		'guard-anchor-site',
		'JAN-CSAA-GUARD-ENFORCEMENT-ANCHOR-SITE',
		input
	);
}

export function guardEnforcementHandlerLinkId(input: {
	readonly anchorSiteId: GuardClassificationOverlayAnchorSiteId;
	readonly attribution: 'CANDIDATE' | 'EXACT';
	readonly factoryCallableNodeId?: SemanticNodeId;
	readonly overlayId: GuardClassificationOverlayId;
	readonly targetNodeIds: readonly string[];
}): GuardClassificationOverlayHandlerLinkId {
	return identity<GuardClassificationOverlayHandlerLinkId>(
		'guard-handler-link',
		'JAN-CSAA-GUARD-ENFORCEMENT-HANDLER-LINK',
		input
	);
}

export function guardClassificationFrontierId(input: {
	readonly anchorSiteId: GuardClassificationOverlayAnchorSiteId | null;
	readonly classificationId: GuardClassificationOverlayClassificationId | null;
	readonly frontierKind: GuardClassificationOverlayFrontierKind;
	readonly occurrenceId: GuardClassificationOverlayOccurrenceId | null;
	readonly overlayId: GuardClassificationOverlayId;
}): GuardClassificationOverlayFrontierId {
	return identity<GuardClassificationOverlayFrontierId>(
		'guard-frontier',
		'JAN-CSAA-GUARD-CLASSIFICATION-FRONTIER',
		input
	);
}

export function guardClassificationOverlayLayerId(
	overlayId: GuardClassificationOverlayId,
	kind: 'DERIVATION' | 'INFERENCE'
): GuardClassificationOverlayLayerId {
	return identity<GuardClassificationOverlayLayerId>(
		'guard-overlay-layer',
		'JAN-CSAA-GUARD-CLASSIFICATION-LAYER',
		{
			capability:
				kind === 'DERIVATION'
					? GUARD_CLASSIFICATION_OVERLAY_DERIVATION_CAPABILITY
					: GUARD_CLASSIFICATION_OVERLAY_INFERENCE_CAPABILITY,
			kind,
			overlayId
		}
	);
}

export type GuardClassificationOverlayContent = Omit<
	GuardClassificationOverlaySnapshot,
	'contentDigest'
>;

export function guardClassificationOverlayContentDigest(
	overlay: GuardClassificationOverlaySnapshot | GuardClassificationOverlayContent
): string {
	const { contentDigest: _contentDigest, ...content } =
		overlay as GuardClassificationOverlaySnapshot;
	return canonicalSemanticJsonWitness(content).sha256;
}
