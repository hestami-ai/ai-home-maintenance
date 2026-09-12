import type { ArtifactPrimaryClass } from './artifact-class.js';

export const WORKING_CHANGE_SET_SCHEMA_VERSION = 'jan-csaa-working-change-set/1.0.0' as const;
export const WORKING_CHANGE_SET_METHOD = 'git-raw-base-to-frozen-subject/1.0.0' as const;

export type WorkingChangeKind =
	'ADD' | 'MODIFY' | 'DELETE' | 'RENAME' | 'COPY' | 'MODE_CHANGE' | 'ARTIFACT_KIND_CHANGE';

export interface WorkingFileState {
	readonly artifactClass: ArtifactPrimaryClass;
	readonly gitBlobOid: string;
	readonly mode: '100644' | '100755';
	readonly path: string;
	readonly sha256: string;
}

export interface WorkingChangeEntry {
	readonly after: WorkingFileState | null;
	readonly before: WorkingFileState | null;
	readonly id: string;
	readonly kind: WorkingChangeKind;
	readonly provenance: readonly string[];
}

export type ExcludedWorkingStateKind =
	| 'DECLARED_OUTPUT'
	| 'SUBJECT_POLICY_EXCLUSION'
	| 'OUTSIDE_SUBJECT_PERIMETER'
	| 'INDEX_DIFFERS_FROM_ANALYZED_BYTES';

export interface ExcludedWorkingState {
	readonly detailDigest: string;
	readonly kind: ExcludedWorkingStateKind;
	readonly path: string | null;
	readonly pathDigest: string;
	readonly reason: string;
}

export interface WorkingChangeSetPopulation {
	readonly changedEntries: number;
	readonly excludedLocalState: number;
	readonly includedUntrackedEntries: number;
	readonly reconciles: true;
}

export interface FrozenWorkingChangeSet {
	readonly baseRevision: string;
	readonly changeSetDigest: string;
	readonly checkoutId: string;
	readonly dirtyState: 'CLEAN' | 'DIRTY';
	readonly entries: readonly WorkingChangeEntry[];
	readonly excludedLocalState: readonly ExcludedWorkingState[];
	readonly excludedLocalStateManifestDigest: string;
	readonly git: {
		readonly objectFormat: 'sha1' | 'sha256';
		readonly providerId: 'git';
		readonly providerVersion: string;
		readonly rawByteComparison: {
			readonly attributeManifestDigest: string;
			readonly coreAutoCrlf: 'false' | 'input' | 'unset';
			readonly method: 'git-check-attr-transform-refusal/1.0.0';
			readonly state: 'RAW_WORKTREE_BYTES_COMPARABLE';
		};
	};
	readonly includedUntrackedEntries: readonly WorkingChangeEntry[];
	readonly method: typeof WORKING_CHANGE_SET_METHOD;
	readonly observationCutoff: {
		readonly end: 'FINAL_GIT_OBSERVATION_AFTER_FROZEN_SUBJECT_BINDING';
		readonly start: 'INITIAL_GIT_OBSERVATION_BEFORE_FROZEN_SUBJECT_RESOLUTION';
	};
	readonly population: WorkingChangeSetPopulation;
	readonly repositoryPrefix: string;
	readonly schemaVersion: typeof WORKING_CHANGE_SET_SCHEMA_VERSION;
	readonly worktreeStateDigest: string;
}
