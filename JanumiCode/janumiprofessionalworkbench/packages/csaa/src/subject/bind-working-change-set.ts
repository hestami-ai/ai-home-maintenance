import { createHash } from 'node:crypto';
import { closeSync, fstatSync, lstatSync, openSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	WORKING_CHANGE_SET_METHOD,
	WORKING_CHANGE_SET_SCHEMA_VERSION,
	type ExcludedWorkingState,
	type FrozenWorkingChangeSet,
	type WorkingChangeEntry,
	type WorkingChangeKind,
	type WorkingFileState
} from '../contracts/working-change-set.js';
import type { CapturedArtifactRecord, FrozenSubject } from '../contracts/subject.js';
import { canonicalJson, compareText, sha256 } from '../inventory/canonical.js';
import { classifyArtifact } from './artifacts.js';
import { readFrozenSubjectArtifact } from './frozen-store.js';
import { WorkingChangeSetIncompatibleError } from './working-change-set-error.js';
import {
	readObservedGitBlob,
	observeRawByteComparisonPolicy,
	type GitIndexEntry,
	type GitTreeEntry,
	type GitWorkingObservation
} from './observe-working-change-set.js';

interface CandidateEntry {
	readonly entry: WorkingChangeEntry;
	readonly untracked: boolean;
}

function deepFreeze<Value>(value: Value, seen = new WeakSet<object>()): Value {
	if (value === null || typeof value !== 'object' || seen.has(value as object)) return value;
	seen.add(value as object);
	for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child, seen);
	return Object.freeze(value);
}

function gitBlobOid(bytes: Uint8Array, objectFormat: 'sha1' | 'sha256'): string {
	return createHash(objectFormat).update(`blob ${bytes.byteLength}\0`).update(bytes).digest('hex');
}

function modeFromStatus(
	observation: GitWorkingObservation,
	path: string,
	mode: number | bigint
): WorkingFileState['mode'] {
	if (!observation.fileMode)
		return (
			observation.index.find((entry) => entry.path === path)?.mode ??
			observation.baseTree.find((entry) => entry.path === path)?.mode ??
			'100644'
		);
	return (Number(mode) & 0o111) === 0 ? '100644' : '100755';
}

function currentMode(observation: GitWorkingObservation, path: string): WorkingFileState['mode'] {
	const status = lstatSync(resolve(observation.subjectRoot, ...path.split('/')));
	if (!status.isFile() || status.isSymbolicLink())
		throw new WorkingChangeSetIncompatibleError('Selected working artifact is not a regular file.');
	return modeFromStatus(observation, path, status.mode);
}

function stableWorkingArtifact(
	observation: GitWorkingObservation,
	path: string,
	expectedBytes: number,
	afterRead?: () => void
): { readonly bytes: Buffer; readonly mode: WorkingFileState['mode'] } | null {
	const absolute = resolve(observation.subjectRoot, ...path.split('/'));
	const pathBefore = lstatSync(absolute, { bigint: true });
	if (!pathBefore.isFile() || pathBefore.isSymbolicLink())
		throw new WorkingChangeSetIncompatibleError('Selected working artifact is not a regular file.');
	const descriptor = openSync(absolute, 'r');
	try {
		const openedBefore = fstatSync(descriptor, { bigint: true });
		if (!openedBefore.isFile())
			throw new WorkingChangeSetIncompatibleError(
				'Selected working artifact changed type during final reconciliation.'
			);
		if (openedBefore.size !== BigInt(expectedBytes)) return null;
		const bytes = readFileSync(descriptor);
		afterRead?.();
		const openedAfter = fstatSync(descriptor, { bigint: true });
		const pathAfter = lstatSync(absolute, { bigint: true });
		if (!pathAfter.isFile() || pathAfter.isSymbolicLink())
			throw new WorkingChangeSetIncompatibleError(
				'Selected working artifact changed type during final reconciliation.'
			);
		if (
			openedBefore.dev !== openedAfter.dev ||
			openedBefore.ino !== openedAfter.ino ||
			openedBefore.size !== openedAfter.size ||
			openedBefore.mtimeNs !== openedAfter.mtimeNs ||
			pathBefore.dev !== pathAfter.dev ||
			pathBefore.ino !== pathAfter.ino ||
			pathBefore.size !== pathAfter.size ||
			pathBefore.mtimeNs !== pathAfter.mtimeNs ||
			pathAfter.dev !== openedAfter.dev ||
			pathAfter.ino !== openedAfter.ino
		)
			return null;
		return { bytes, mode: modeFromStatus(observation, path, pathAfter.mode) };
	} finally {
		closeSync(descriptor);
	}
}

function worktreeStateDigest(
	observation: GitWorkingObservation,
	changeSetDigest: string,
	excludedLocalStateManifestDigest: string,
	git: FrozenWorkingChangeSet['git'],
	subjectId: string
): string {
	return sha256(
		`JAN-CSAA-WORKTREE-STATE\0${canonicalJson({
			baseRevision: observation.baseRevision,
			baseTreeDigest: observation.baseTreeDigest,
			changeSetDigest,
			checkoutId: observation.checkoutId,
			excludedLocalStateManifestDigest,
			git,
			repositoryPrefix: observation.repositoryPrefix,
			subjectId
		})}`
	);
}

function workingStateFromArtifact(
	observation: GitWorkingObservation,
	subject: FrozenSubject,
	artifact: CapturedArtifactRecord
): WorkingFileState {
	const bytes = readFrozenSubjectArtifact(subject, artifact.path);
	if (bytes === undefined)
		throw new Error('FrozenSubject byte capability is unavailable for WCS binding.');
	if (sha256(bytes) !== artifact.sha256)
		throw new Error('FrozenSubject artifact bytes do not reconcile during WCS binding.');
	return {
		artifactClass: artifact.primaryClass,
		gitBlobOid: gitBlobOid(bytes, observation.objectFormat),
		mode: currentMode(observation, artifact.path),
		path: artifact.path,
		sha256: artifact.sha256
	};
}

function baseState(
	observation: GitWorkingObservation,
	entry: GitTreeEntry,
	digestCache: Map<string, string>
): WorkingFileState {
	let contentDigest = digestCache.get(entry.oid);
	if (contentDigest === undefined) {
		const bytes = readObservedGitBlob(observation, entry.oid);
		if (gitBlobOid(bytes, observation.objectFormat) !== entry.oid)
			throw new Error('Git base blob bytes do not reconcile with their object identity.');
		contentDigest = sha256(bytes);
		digestCache.set(entry.oid, contentDigest);
	}
	return {
		artifactClass: classifyArtifact(entry.path).primaryClass,
		gitBlobOid: entry.oid,
		mode: entry.mode,
		path: entry.path,
		sha256: contentDigest
	};
}

function entryId(
	kind: WorkingChangeKind,
	before: WorkingFileState | null,
	after: WorkingFileState | null,
	provenance: readonly string[]
): string {
	return sha256(
		`JAN-CSAA-WORKING-CHANGE-ENTRY\0${canonicalJson({ after, before, kind, provenance })}`
	);
}

function changeEntry(
	kind: WorkingChangeKind,
	before: WorkingFileState | null,
	after: WorkingFileState | null,
	provenance: readonly string[]
): WorkingChangeEntry {
	return { after, before, id: entryId(kind, before, after, provenance), kind, provenance };
}

function changeKey(entry: WorkingChangeEntry): string {
	return [
		entry.kind,
		entry.before?.path ?? '',
		entry.after?.path ?? '',
		entry.before?.sha256 ?? '',
		entry.after?.sha256 ?? ''
	].join('\0');
}

function sortEntries(entries: readonly WorkingChangeEntry[]): WorkingChangeEntry[] {
	const sorted = [...entries].sort((left, right) => compareText(changeKey(left), changeKey(right)));
	for (let index = 1; index < sorted.length; index += 1)
		if (changeKey(sorted[index - 1]!) === changeKey(sorted[index]!))
			throw new Error('Working Change Set contains a duplicate canonical entry.');
	return sorted;
}

function exactContentModeKey(state: WorkingFileState): string {
	return `${state.gitBlobOid}\0${state.mode}`;
}

function pairExactRenames(
	candidates: readonly CandidateEntry[],
	retainedSourceKeys: ReadonlySet<string>
): CandidateEntry[] {
	const additions = new Map<string, CandidateEntry[]>();
	const deletions = new Map<string, CandidateEntry[]>();
	for (const candidate of candidates) {
		if (candidate.entry.kind === 'ADD' && candidate.entry.after !== null) {
			const key = exactContentModeKey(candidate.entry.after);
			additions.set(key, [...(additions.get(key) ?? []), candidate]);
		}
		if (candidate.entry.kind === 'DELETE' && candidate.entry.before !== null) {
			const key = exactContentModeKey(candidate.entry.before);
			deletions.set(key, [...(deletions.get(key) ?? []), candidate]);
		}
	}
	const removed = new Set<string>();
	const paired: CandidateEntry[] = [];
	for (const [key, addPopulation] of additions) {
		const deletePopulation = deletions.get(key) ?? [];
		if (addPopulation.length !== 1 || deletePopulation.length !== 1 || retainedSourceKeys.has(key))
			continue;
		const addition = addPopulation[0]!;
		const deletion = deletePopulation[0]!;
		removed.add(addition.entry.id);
		removed.add(deletion.entry.id);
		paired.push({
			entry: changeEntry('RENAME', deletion.entry.before, addition.entry.after, [
				'git-base-tree',
				'frozen-subject-bytes',
				'exact-unique-raw-blob-and-mode-pairing'
			]),
			untracked: addition.untracked
		});
		if (deletion.entry.before?.artifactClass !== addition.entry.after?.artifactClass)
			paired.push({
				entry: changeEntry('ARTIFACT_KIND_CHANGE', deletion.entry.before, addition.entry.after, [
					'subject-artifact-classification',
					'exact-rename-pair'
				]),
				untracked: addition.untracked
			});
	}
	return [...candidates.filter((candidate) => !removed.has(candidate.entry.id)), ...paired];
}

function pairExactCopies(
	candidates: readonly CandidateEntry[],
	baseByPath: ReadonlyMap<string, GitTreeEntry>,
	currentByPath: ReadonlyMap<string, WorkingFileState>,
	observation: GitWorkingObservation,
	digestCache: Map<string, string>
): CandidateEntry[] {
	const retainedByKey = new Map<string, GitTreeEntry[]>();
	for (const base of baseByPath.values()) {
		const current = currentByPath.get(base.path);
		if (current === undefined || current.gitBlobOid !== base.oid || current.mode !== base.mode)
			continue;
		const key = `${base.oid}\0${base.mode}`;
		retainedByKey.set(key, [...(retainedByKey.get(key) ?? []), base]);
	}
	const deletedKeys = new Set(
		candidates
			.filter((candidate) => candidate.entry.kind === 'DELETE' && candidate.entry.before !== null)
			.map((candidate) => exactContentModeKey(candidate.entry.before!))
	);
	const paired: CandidateEntry[] = [];
	for (const candidate of candidates) {
		if (candidate.entry.kind !== 'ADD' || candidate.entry.after === null) {
			paired.push(candidate);
			continue;
		}
		const key = exactContentModeKey(candidate.entry.after);
		const sources = retainedByKey.get(exactContentModeKey(candidate.entry.after)) ?? [];
		if (sources.length !== 1 || deletedKeys.has(key)) {
			paired.push(candidate);
			continue;
		}
		const before = baseState(observation, sources[0]!, digestCache);
		paired.push({
			entry: changeEntry('COPY', before, candidate.entry.after, [
				'git-base-tree',
				'frozen-subject-bytes',
				'exact-unique-retained-source-raw-blob-and-mode-pairing'
			]),
			untracked: candidate.untracked
		});
		if (before.artifactClass !== candidate.entry.after.artifactClass)
			paired.push({
				entry: changeEntry('ARTIFACT_KIND_CHANGE', before, candidate.entry.after, [
					'subject-artifact-classification',
					'exact-copy-pair'
				]),
				untracked: candidate.untracked
			});
	}
	return paired;
}

function pathWithinExplicitPerimeter(subject: FrozenSubject, path: string): boolean {
	if (subject.request.scope.kind === 'REPOSITORY') return true;
	for (const configPath of subject.request.scope.projects) {
		const slash = configPath.lastIndexOf('/');
		const root = slash < 0 ? '' : configPath.slice(0, slash);
		if (root === '' || path === root || path.startsWith(`${root}/`)) return true;
	}
	return (subject.request.scope.additionalArtifacts ?? []).includes(path);
}

function excludedSubjectPath(subject: FrozenSubject, path: string): boolean {
	if (!pathWithinExplicitPerimeter(subject, path)) return true;
	return subject.excludedArtifacts.some(
		(excluded) => path === excluded.path || path.startsWith(`${excluded.path.replace(/\/$/u, '')}/`)
	);
}

function excludedState(
	kind: ExcludedWorkingState['kind'],
	path: string | null,
	reason: string,
	detail: unknown
): ExcludedWorkingState {
	return {
		detailDigest: sha256(canonicalJson(detail)),
		kind,
		path,
		pathDigest: sha256(`JAN-CSAA-WORKING-EXCLUDED-PATH\0${path ?? '<redacted>'}`),
		reason
	};
}

function excludedStateKey(state: ExcludedWorkingState): string {
	return `${state.kind}\0${state.path ?? ''}\0${state.detailDigest}`;
}

function rootPathInsideSubject(path: string, prefix: string): string | null {
	if (prefix === '') return path;
	const marker = `${prefix}/`;
	return path.startsWith(marker) ? path.slice(marker.length) : null;
}

function currentIndexDifference(
	index: GitIndexEntry | undefined,
	current: WorkingFileState | undefined
): boolean {
	if (index === undefined) return current !== undefined;
	if (current === undefined) return true;
	return index.oid !== current.gitBlobOid || index.mode !== current.mode;
}

export function bindWorkingChangeSet(
	subject: FrozenSubject,
	observation: GitWorkingObservation
): FrozenWorkingChangeSet {
	const rawByteComparison = observeRawByteComparisonPolicy(
		observation,
		subject.artifacts.map((artifact) => artifact.path)
	);
	const baseByPath = new Map(observation.baseTree.map((entry) => [entry.path, entry]));
	const indexByPath = new Map(observation.index.map((entry) => [entry.path, entry]));
	const currentArtifacts = new Map(subject.artifacts.map((artifact) => [artifact.path, artifact]));
	const currentByPath = new Map<string, WorkingFileState>();
	for (const artifact of currentArtifacts.values())
		currentByPath.set(artifact.path, workingStateFromArtifact(observation, subject, artifact));
	const digestCache = new Map<string, string>();
	const candidates: CandidateEntry[] = [];
	for (const [path, current] of currentByPath) {
		const base = baseByPath.get(path);
		if (base === undefined) {
			candidates.push({
				entry: changeEntry('ADD', null, current, ['frozen-subject-bytes', 'git-base-absence']),
				untracked: !indexByPath.has(path)
			});
			continue;
		}
		const baseArtifactClass = classifyArtifact(path).primaryClass;
		if (
			base.oid === current.gitBlobOid &&
			base.mode === current.mode &&
			baseArtifactClass === current.artifactClass
		)
			continue;
		const before = baseState(observation, base, digestCache);
		if (before.gitBlobOid !== current.gitBlobOid)
			candidates.push({
				entry: changeEntry('MODIFY', before, current, ['git-base-blob', 'frozen-subject-bytes']),
				untracked: false
			});
		if (before.mode !== current.mode)
			candidates.push({
				entry: changeEntry('MODE_CHANGE', before, current, [
					'git-base-mode',
					'working-filesystem-mode'
				]),
				untracked: false
			});
		if (before.artifactClass !== current.artifactClass)
			candidates.push({
				entry: changeEntry('ARTIFACT_KIND_CHANGE', before, current, [
					'base-path-classification',
					'frozen-subject-classification'
				]),
				untracked: false
			});
	}
	for (const [path, base] of baseByPath) {
		if (currentByPath.has(path) || excludedSubjectPath(subject, path)) continue;
		candidates.push({
			entry: changeEntry('DELETE', baseState(observation, base, digestCache), null, [
				'git-base-blob',
				'frozen-subject-path-absence'
			]),
			untracked: false
		});
	}
	const retainedSourceKeys = new Set<string>();
	for (const base of baseByPath.values()) {
		const current = currentByPath.get(base.path);
		if (current !== undefined && current.gitBlobOid === base.oid && current.mode === base.mode)
			retainedSourceKeys.add(exactContentModeKey(current));
	}
	const renamed = pairExactRenames(candidates, retainedSourceKeys);
	const paired = pairExactCopies(renamed, baseByPath, currentByPath, observation, digestCache);
	const entries = sortEntries(
		paired.filter((candidate) => !candidate.untracked).map(({ entry }) => entry)
	);
	const includedUntrackedEntries = sortEntries(
		paired.filter((candidate) => candidate.untracked).map(({ entry }) => entry)
	);
	const exclusions: ExcludedWorkingState[] = subject.excludedArtifacts.map((excluded) =>
		excludedState(
			excluded.policyId.startsWith('jan-csaa-exclude-output/1:')
				? 'DECLARED_OUTPUT'
				: 'SUBJECT_POLICY_EXCLUSION',
			excluded.path,
			excluded.reason,
			excluded
		)
	);
	for (const status of observation.statusRecords) {
		for (const rootPath of [status.path, status.originalPath].filter(
			(path): path is string => path !== null
		)) {
			if (rootPathInsideSubject(rootPath, observation.repositoryPrefix) !== null) continue;
			exclusions.push(
				excludedState(
					'OUTSIDE_SUBJECT_PERIMETER',
					null,
					'Git local state is outside the selected subject root.',
					{ kind: status.kind, pathDigest: sha256(rootPath) }
				)
			);
		}
	}
	const indexPaths = new Set([
		...baseByPath.keys(),
		...currentByPath.keys(),
		...indexByPath.keys()
	]);
	for (const path of [...indexPaths].sort(compareText)) {
		if (excludedSubjectPath(subject, path)) continue;
		const index = indexByPath.get(path);
		const current = currentByPath.get(path);
		if (!currentIndexDifference(index, current)) continue;
		exclusions.push(
			excludedState(
				'INDEX_DIFFERS_FROM_ANALYZED_BYTES',
				path,
				'The Git index state differs from the analyzed working-tree bytes.',
				{
					currentMode: current?.mode ?? null,
					currentOid: current?.gitBlobOid ?? null,
					indexMode: index?.mode ?? null,
					indexOid: index?.oid ?? null
				}
			)
		);
	}
	const excludedLocalState = [
		...new Map(exclusions.map((state) => [excludedStateKey(state), state])).values()
	].sort((left, right) => compareText(excludedStateKey(left), excludedStateKey(right)));
	const changeSetDigest = sha256(
		`JAN-CSAA-WORKING-CHANGE-SET\0${canonicalJson({
			baseRevision: observation.baseRevision,
			entries,
			includedUntrackedEntries,
			method: WORKING_CHANGE_SET_METHOD,
			schemaVersion: WORKING_CHANGE_SET_SCHEMA_VERSION
		})}`
	);
	const excludedLocalStateManifestDigest = sha256(canonicalJson(excludedLocalState));
	const result: FrozenWorkingChangeSet = {
		baseRevision: observation.baseRevision,
		changeSetDigest,
		checkoutId: observation.checkoutId,
		dirtyState: entries.length > 0 || includedUntrackedEntries.length > 0 ? 'DIRTY' : 'CLEAN',
		entries,
		excludedLocalState,
		excludedLocalStateManifestDigest,
		git: {
			objectFormat: observation.objectFormat,
			providerId: 'git',
			providerVersion: observation.gitVersion,
			rawByteComparison
		},
		includedUntrackedEntries,
		method: WORKING_CHANGE_SET_METHOD,
		observationCutoff: {
			end: 'FINAL_GIT_OBSERVATION_AFTER_FROZEN_SUBJECT_BINDING',
			start: 'INITIAL_GIT_OBSERVATION_BEFORE_FROZEN_SUBJECT_RESOLUTION'
		},
		population: {
			changedEntries: entries.length,
			excludedLocalState: excludedLocalState.length,
			includedUntrackedEntries: includedUntrackedEntries.length,
			reconciles: true
		},
		repositoryPrefix: observation.repositoryPrefix,
		schemaVersion: WORKING_CHANGE_SET_SCHEMA_VERSION,
		worktreeStateDigest: worktreeStateDigest(
			observation,
			changeSetDigest,
			excludedLocalStateManifestDigest,
			{
				objectFormat: observation.objectFormat,
				providerId: 'git',
				providerVersion: observation.gitVersion,
				rawByteComparison
			},
			subject.descriptor.subjectId
		)
	};
	return deepFreeze(result);
}

export function bindWorkingChangeSetSubjectIdentity(
	changeSet: FrozenWorkingChangeSet,
	observation: GitWorkingObservation,
	subjectId: string
): FrozenWorkingChangeSet {
	return deepFreeze({
		...changeSet,
		worktreeStateDigest: worktreeStateDigest(
			observation,
			changeSet.changeSetDigest,
			changeSet.excludedLocalStateManifestDigest,
			changeSet.git,
			subjectId
		)
	});
}

export function frozenWorkingArtifactsMatch(
	subject: FrozenSubject,
	changeSet: FrozenWorkingChangeSet,
	observation: GitWorkingObservation,
	afterRead?: (path: string) => void
): boolean {
	const expectedModes = new Map<string, WorkingFileState['mode']>(
		observation.baseTree.map((entry) => [entry.path, entry.mode])
	);
	for (const entry of [...changeSet.entries, ...changeSet.includedUntrackedEntries]) {
		if (entry.after === null) expectedModes.delete(entry.before!.path);
		else expectedModes.set(entry.after.path, entry.after.mode);
	}
	for (const artifact of subject.artifacts) {
		let current: { readonly bytes: Buffer; readonly mode: WorkingFileState['mode'] } | null;
		try {
			current = stableWorkingArtifact(observation, artifact.path, artifact.bytes, () =>
				afterRead?.(artifact.path)
			);
		} catch (error) {
			if (
				error !== null &&
				typeof error === 'object' &&
				'code' in error &&
				(error as NodeJS.ErrnoException).code === 'ENOENT'
			)
				return false;
			throw error;
		}
		if (
			current === null ||
			sha256(current.bytes) !== artifact.sha256 ||
			current.mode !== expectedModes.get(artifact.path)
		)
			return false;
	}
	return true;
}
