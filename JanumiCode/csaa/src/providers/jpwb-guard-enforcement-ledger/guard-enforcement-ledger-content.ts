import type {
	GuardEnforcementLedgerArrowId,
	GuardEnforcementLedgerArtifactSetBinding,
	GuardEnforcementLedgerArtifactSetId,
	GuardEnforcementLedgerGuardId,
	GuardEnforcementLedgerObservation,
	GuardEnforcementLedgerObservationId,
	GuardEnforcementLedgerRawOutputId,
	GuardEnforcementLedgerRawOutputIdentity
} from '../../contracts/guard-enforcement-ledger.js';
import { sha256 } from '../../inventory/canonical.js';
import { canonicalSemanticJson, canonicalSemanticJsonWitness } from '../../semantic/canonical.js';

const GUARD_ENFORCEMENT_LEDGER_ID_ALGORITHM_VERSION = '1';

function identity<Kind extends string>(prefix: string, domain: string, preimage: unknown): Kind {
	return `${prefix}-${sha256(
		`${domain}\0${GUARD_ENFORCEMENT_LEDGER_ID_ALGORITHM_VERSION}\0${canonicalSemanticJson(preimage)}`
	)}` as Kind;
}

export type GuardEnforcementLedgerArtifactSetContent = Omit<
	GuardEnforcementLedgerArtifactSetBinding,
	'contentDigest'
>;
export type GuardEnforcementLedgerObservationContent = Omit<
	GuardEnforcementLedgerObservation,
	'contentDigest'
>;

export function guardEnforcementLedgerArtifactSetContentDigest(
	artifactSet: GuardEnforcementLedgerArtifactSetBinding | GuardEnforcementLedgerArtifactSetContent
): string {
	const { contentDigest: _contentDigest, ...content } =
		artifactSet as GuardEnforcementLedgerArtifactSetBinding;
	return canonicalSemanticJsonWitness(content).sha256;
}

export function guardEnforcementLedgerObservationContentDigest(
	observation: GuardEnforcementLedgerObservation | GuardEnforcementLedgerObservationContent
): string {
	const { contentDigest: _contentDigest, ...content } =
		observation as GuardEnforcementLedgerObservation;
	return canonicalSemanticJsonWitness(content).sha256;
}

export interface GuardEnforcementLedgerArtifactSetIdentityInput {
	readonly artifactContentDigest: string;
	readonly method: string;
	readonly operationVersion: string;
	readonly schemaVersion: string;
	readonly subjectId: string;
}

export function guardEnforcementLedgerArtifactSetId(
	input: GuardEnforcementLedgerArtifactSetIdentityInput
): GuardEnforcementLedgerArtifactSetId {
	return identity<GuardEnforcementLedgerArtifactSetId>(
		'artifact-set:guard-enforcement-ledger',
		'JAN-CSAA-JPWB-GUARD-ENFORCEMENT-LEDGER-ARTIFACT-SET',
		input
	);
}

export interface GuardEnforcementLedgerObservationIdentityInput {
	readonly artifactSetId: GuardEnforcementLedgerArtifactSetId;
	readonly canonicalProfile: string;
	readonly executor: GuardEnforcementLedgerObservation['executor'];
	readonly method: string;
	readonly operationVersion: string;
	readonly rawOutputId: GuardEnforcementLedgerRawOutputId;
	readonly schemaVersion: string;
	readonly subjectId: string;
}

export function guardEnforcementLedgerObservationId(
	input: GuardEnforcementLedgerObservationIdentityInput
): GuardEnforcementLedgerObservationId {
	return identity<GuardEnforcementLedgerObservationId>(
		'observation:guard-enforcement-ledger',
		'JAN-CSAA-JPWB-GUARD-ENFORCEMENT-LEDGER-OBSERVATION',
		input
	);
}

export interface GuardEnforcementLedgerRawOutputIdentityInput {
	readonly bytes: number;
	readonly evidenceContentDigest: string;
	readonly schemaVersion: GuardEnforcementLedgerRawOutputIdentity['schemaVersion'];
	readonly sha256: string;
}

export function guardEnforcementLedgerRawOutputId(
	input: GuardEnforcementLedgerRawOutputIdentityInput
): GuardEnforcementLedgerRawOutputId {
	return identity<GuardEnforcementLedgerRawOutputId>(
		'raw-output:guard-enforcement-ledger',
		'JAN-CSAA-JPWB-GUARD-ENFORCEMENT-LEDGER-RAW-OUTPUT',
		input
	);
}

export function guardEnforcementLedgerGuardId(
	observationId: GuardEnforcementLedgerObservationId,
	guardText: string
): GuardEnforcementLedgerGuardId {
	return identity<GuardEnforcementLedgerGuardId>(
		'guard:guard-enforcement-ledger',
		'JAN-CSAA-JPWB-GUARD-ENFORCEMENT-LEDGER-GUARD',
		{ guardText, observationId }
	);
}

export function guardEnforcementLedgerArrowId(
	observationId: GuardEnforcementLedgerObservationId,
	ordinal: number,
	arrow: {
		readonly from: string;
		readonly guard: string;
		readonly machine: string;
		readonly to: string;
	}
): GuardEnforcementLedgerArrowId {
	return identity<GuardEnforcementLedgerArrowId>(
		'arrow:guard-enforcement-ledger',
		'JAN-CSAA-JPWB-GUARD-ENFORCEMENT-LEDGER-ARROW',
		{ arrow, observationId, ordinal }
	);
}
