import {
	CONDITIONAL_EXPORT_RESOLUTION_CANONICAL_PROFILE,
	CONDITIONAL_EXPORT_RESOLUTION_METHOD,
	CONDITIONAL_EXPORT_RESOLUTION_OPERATION_VERSION,
	CONDITIONAL_EXPORT_RESOLUTION_SCHEMA_VERSION,
	type ConditionalExportBranchId,
	type ConditionalExportDecisionId,
	type ConditionalExportFrontierId,
	type ConditionalExportManifestSourceSpan,
	type ConditionalExportResolutionBuildInputs,
	type ConditionalExportResolutionCanonicalBinding,
	type ConditionalExportResolutionId,
	type ConditionalExportResolutionSnapshot
} from '../contracts/conditional-export-resolution.js';
import { sha256 } from '../inventory/canonical.js';
import { canonicalSemanticJson, canonicalSemanticJsonWitness } from '../semantic/canonical.js';

const ID_ALGORITHM_VERSION = '1';

function identity<Kind extends string>(prefix: string, domain: string, preimage: unknown): Kind {
	return `${prefix}-${sha256(
		`${domain}\0${ID_ALGORITHM_VERSION}\0${canonicalSemanticJson(preimage)}`
	)}` as Kind;
}

/**
 * This digest deliberately binds compact, independently validated predecessor
 * references plus the exact selected consumer and manifest witnesses. It never
 * serializes the complete FrozenSubject, StaticSemanticSnapshot, or CAP-010 graph.
 */
export function conditionalExportResolutionInputDigest(
	inputs: ConditionalExportResolutionBuildInputs,
	binding: ConditionalExportResolutionCanonicalBinding
): string {
	return canonicalSemanticJsonWitness({
		consumerEnvironment: binding.consumerEnvironment,
		frozenSubject: {
			fileManifestDigest: inputs.frozenSubject.descriptor.fileManifestDigest,
			policyVersion: inputs.frozenSubject.descriptor.policyVersion,
			schemaVersion: inputs.frozenSubject.descriptor.schemaVersion,
			subjectId: inputs.frozenSubject.descriptor.subjectId
		},
		manifestWitness: binding.manifestWitness,
		projectContextGraph: {
			canonicalProfile: inputs.projectContextGraph.canonicalProfile,
			contentDigest: inputs.projectContextGraph.contentDigest,
			id: inputs.projectContextGraph.id,
			inputDigest: inputs.projectContextGraph.inputDigest,
			method: inputs.projectContextGraph.method,
			operationVersion: inputs.projectContextGraph.operationVersion,
			schemaVersion: inputs.projectContextGraph.schemaVersion,
			semanticSnapshotId: inputs.projectContextGraph.semanticSnapshotId,
			subjectId: inputs.projectContextGraph.subjectId
		},
		request: inputs.request,
		semanticSnapshot: {
			extractionVersion: inputs.semanticSnapshot.extractionVersion,
			id: inputs.semanticSnapshot.id,
			operationVersion: inputs.semanticSnapshot.operationVersion,
			provider: inputs.semanticSnapshot.provider,
			schemaVersion: inputs.semanticSnapshot.schemaVersion,
			subjectId: inputs.semanticSnapshot.subjectId
		}
	}).sha256;
}

export function conditionalExportResolutionId(input: {
	readonly inputDigest: string;
	readonly semanticSnapshotId: string;
	readonly subjectId: string;
}): ConditionalExportResolutionId {
	return identity<ConditionalExportResolutionId>(
		'conditional-export-resolution',
		'JAN-CSAA-CONDITIONAL-EXPORT-RESOLUTION',
		{
			canonicalProfile: CONDITIONAL_EXPORT_RESOLUTION_CANONICAL_PROFILE,
			inputDigest: input.inputDigest,
			method: CONDITIONAL_EXPORT_RESOLUTION_METHOD,
			operationVersion: CONDITIONAL_EXPORT_RESOLUTION_OPERATION_VERSION,
			schemaVersion: CONDITIONAL_EXPORT_RESOLUTION_SCHEMA_VERSION,
			semanticSnapshotId: input.semanticSnapshotId,
			subjectId: input.subjectId
		}
	);
}

export interface ConditionalExportBranchIdentityInput {
	readonly conditionPath: readonly string[];
	readonly declarationOrdinal: number;
	readonly keySpan: ConditionalExportManifestSourceSpan;
	readonly ordinal: number;
	readonly valueKind: 'CONDITION_OBJECT' | 'NULL' | 'STRING';
	readonly valueSpan: ConditionalExportManifestSourceSpan;
}

export function conditionalExportBranchId(
	resolutionId: ConditionalExportResolutionId,
	input: ConditionalExportBranchIdentityInput
): ConditionalExportBranchId {
	return identity<ConditionalExportBranchId>(
		'conditional-export-branch',
		'JAN-CSAA-CONDITIONAL-EXPORT-BRANCH',
		{ resolutionId, ...input }
	);
}

export function conditionalExportDecisionId(
	resolutionId: ConditionalExportResolutionId
): ConditionalExportDecisionId {
	return identity<ConditionalExportDecisionId>(
		'conditional-export-decision',
		'JAN-CSAA-CONDITIONAL-EXPORT-DECISION',
		{ kind: 'EXACT_EXPORT_CONDITION_DECISION', resolutionId }
	);
}

export interface ConditionalExportFrontierIdentityInput {
	readonly declarationOrdinal: number;
	readonly declarationPath: readonly string[];
	readonly ordinal: number;
	readonly reason:
		| 'EXPORT_ARRAY_FALLBACK_UNSUPPORTED'
		| 'EXPORT_PATTERN_KEY_UNSUPPORTED'
		| 'EXPORTS_ROOT_CONDITION_MAP_UNSUPPORTED'
		| 'PACKAGE_IMPORTS_MAP_UNSUPPORTED'
		| 'UNSUPPORTED_EXPORT_TARGET_SYNTAX'
		| 'UNSUPPORTED_EXPORT_VALUE_KIND';
	readonly sourceSpan: ConditionalExportManifestSourceSpan;
}

export function conditionalExportFrontierId(
	resolutionId: ConditionalExportResolutionId,
	input: ConditionalExportFrontierIdentityInput
): ConditionalExportFrontierId {
	return identity<ConditionalExportFrontierId>(
		'conditional-export-frontier',
		'JAN-CSAA-CONDITIONAL-EXPORT-FRONTIER',
		{ resolutionId, ...input }
	);
}

export type ConditionalExportResolutionContent = Omit<
	ConditionalExportResolutionSnapshot,
	'contentDigest'
>;

export function conditionalExportResolutionContentDigest(
	resolution: ConditionalExportResolutionSnapshot | ConditionalExportResolutionContent
): string {
	const { contentDigest: _contentDigest, ...content } =
		resolution as ConditionalExportResolutionSnapshot;
	return canonicalSemanticJsonWitness(content).sha256;
}
