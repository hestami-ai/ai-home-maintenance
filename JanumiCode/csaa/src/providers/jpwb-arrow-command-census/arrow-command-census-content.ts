import type {
	ArrowCommandCensusArtifactSetBinding,
	ArrowCommandCensusArtifactSetId,
	ArrowCommandCensusDeclaredArrowId,
	ArrowCommandCensusDeclaredSiteId,
	ArrowCommandCensusObservation,
	ArrowCommandCensusObservationId,
	ArrowCommandCensusRawDeclaredArrow,
	ArrowCommandCensusRawOutputId,
	ArrowCommandCensusRawOutputIdentity,
	ArrowCommandCensusSourceSite
} from '../../contracts/arrow-command-census.js';
import { sha256 } from '../../inventory/canonical.js';
import { canonicalSemanticJson, canonicalSemanticJsonWitness } from '../../semantic/canonical.js';

const ARROW_COMMAND_CENSUS_ID_ALGORITHM_VERSION = '1';

function identity<Kind extends string>(prefix: string, domain: string, preimage: unknown): Kind {
	return `${prefix}-${sha256(
		`${domain}\0${ARROW_COMMAND_CENSUS_ID_ALGORITHM_VERSION}\0${canonicalSemanticJson(preimage)}`
	)}` as Kind;
}

export type ArrowCommandCensusArtifactSetContent = Omit<
	ArrowCommandCensusArtifactSetBinding,
	'contentDigest'
>;
export type ArrowCommandCensusObservationContent = Omit<
	ArrowCommandCensusObservation,
	'contentDigest'
>;

export function arrowCommandCensusArtifactSetContentDigest(
	artifactSet: ArrowCommandCensusArtifactSetBinding | ArrowCommandCensusArtifactSetContent
): string {
	const { contentDigest: _contentDigest, ...content } =
		artifactSet as ArrowCommandCensusArtifactSetBinding;
	return canonicalSemanticJsonWitness(content).sha256;
}

export function arrowCommandCensusObservationContentDigest(
	observation: ArrowCommandCensusObservation | ArrowCommandCensusObservationContent
): string {
	const { contentDigest: _contentDigest, ...content } =
		observation as ArrowCommandCensusObservation;
	return canonicalSemanticJsonWitness(content).sha256;
}

export interface ArrowCommandCensusArtifactSetIdentityInput {
	readonly artifactSetDigest: string;
	readonly method: string;
	readonly schemaVersion: string;
	readonly subjectId: string;
}

export function arrowCommandCensusArtifactSetId(
	input: ArrowCommandCensusArtifactSetIdentityInput
): ArrowCommandCensusArtifactSetId {
	return identity<ArrowCommandCensusArtifactSetId>(
		'artifact-set:arrow-command-census',
		'JAN-CSAA-JPWB-ARROW-COMMAND-CENSUS-ARTIFACT-SET',
		input
	);
}

export function arrowCommandCensusArtifactSetDigest(
	artifacts: ArrowCommandCensusArtifactSetBinding['artifacts']
): string {
	return canonicalSemanticJsonWitness(artifacts).sha256;
}

export interface ArrowCommandCensusObservationIdentityInput {
	readonly artifactSetId: ArrowCommandCensusArtifactSetId;
	readonly artifactSetDigest: string;
	readonly canonicalProfile: string;
	readonly executor: ArrowCommandCensusObservation['executor'];
	readonly method: string;
	readonly operationVersion: string;
	readonly rawOutputId: ArrowCommandCensusRawOutputId;
	readonly schemaVersion: string;
	readonly subjectId: string;
}

export function arrowCommandCensusObservationId(
	input: ArrowCommandCensusObservationIdentityInput
): ArrowCommandCensusObservationId {
	return identity<ArrowCommandCensusObservationId>(
		'observation:arrow-command-census',
		'JAN-CSAA-JPWB-ARROW-COMMAND-CENSUS-OBSERVATION',
		input
	);
}

export interface ArrowCommandCensusRawOutputIdentityInput {
	readonly bytes: number;
	readonly encoding: ArrowCommandCensusRawOutputIdentity['encoding'];
	readonly exitCode: ArrowCommandCensusRawOutputIdentity['exitCode'];
	readonly format: ArrowCommandCensusRawOutputIdentity['format'];
	readonly schemaVersion: ArrowCommandCensusRawOutputIdentity['schemaVersion'];
	readonly sha256: string;
}

export function arrowCommandCensusRawOutputId(
	input: ArrowCommandCensusRawOutputIdentityInput
): ArrowCommandCensusRawOutputId {
	return identity<ArrowCommandCensusRawOutputId>(
		'raw-output:arrow-command-census',
		'JAN-CSAA-JPWB-ARROW-COMMAND-CENSUS-RAW-OUTPUT',
		input
	);
}

export function arrowCommandCensusDeclaredSiteId(
	observationId: ArrowCommandCensusObservationId,
	source: ArrowCommandCensusSourceSite
): ArrowCommandCensusDeclaredSiteId {
	return identity<ArrowCommandCensusDeclaredSiteId>(
		'arrow-command-site',
		'JAN-CSAA-JPWB-ARROW-COMMAND-CENSUS-DECLARED-SITE',
		{ observationId, source }
	);
}

export function arrowCommandCensusDeclaredArrowId(
	observationId: ArrowCommandCensusObservationId,
	siteId: ArrowCommandCensusDeclaredSiteId,
	ordinalAtSite: number,
	arrow: ArrowCommandCensusRawDeclaredArrow
): ArrowCommandCensusDeclaredArrowId {
	return identity<ArrowCommandCensusDeclaredArrowId>(
		'arrow-command-declaration',
		'JAN-CSAA-JPWB-ARROW-COMMAND-CENSUS-DECLARED-ARROW',
		{
			from: arrow.from,
			machine: arrow.machine,
			observationId,
			ordinalAtSite,
			siteId,
			to: arrow.to
		}
	);
}
