import {
	SUBJECT_ID_ALGORITHM_VERSION,
	SUBJECT_SCHEMA_VERSION,
	type SubjectDescriptor,
	type SubjectKind
} from '../contracts/subject.js';
import { canonicalJson, sha256 } from '../inventory/canonical.js';

export interface SubjectIdentityCoordinates {
	readonly configurationDigest: string;
	readonly exclusionPolicyIds: readonly string[];
	readonly fileManifestDigest: string;
	readonly parentRevision: string | null;
	readonly perimeter: readonly string[];
	readonly revision: string | null;
	readonly schemaVersion: typeof SUBJECT_SCHEMA_VERSION;
	readonly subjectKind: SubjectKind;
}

export function subjectIdentityCoordinates(
	descriptor: Pick<
		SubjectDescriptor,
		| 'configurationDigest'
		| 'exclusionPolicyIds'
		| 'fileManifestDigest'
		| 'parentRevision'
		| 'perimeter'
		| 'revision'
		| 'schemaVersion'
		| 'subjectKind'
	>
): SubjectIdentityCoordinates {
	return {
		schemaVersion: descriptor.schemaVersion,
		subjectKind: descriptor.subjectKind,
		revision: descriptor.revision,
		parentRevision: descriptor.parentRevision,
		perimeter: [...descriptor.perimeter],
		fileManifestDigest: descriptor.fileManifestDigest,
		configurationDigest: descriptor.configurationDigest,
		exclusionPolicyIds: [...descriptor.exclusionPolicyIds]
	};
}

export function computeSubjectId(coordinates: SubjectIdentityCoordinates): string {
	return sha256(`JAN-CSAA-SUBJECT\0${SUBJECT_ID_ALGORITHM_VERSION}\0${canonicalJson(coordinates)}`);
}
