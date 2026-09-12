import type {
	FrozenSubject,
	ResolveSubjectRequest,
	SubjectDiagnostic,
	SubjectResolutionOutcome
} from '../contracts/subject.js';
import { SUBJECT_POLICY_VERSION, SUBJECT_REQUEST_SCHEMA_VERSION } from '../contracts/subject.js';
import { canonicalJson } from '../inventory/canonical.js';
import { isAbsolute } from 'node:path';
import {
	bindWorkingChangeSet,
	bindWorkingChangeSetSubjectIdentity,
	frozenWorkingArtifactsMatch
} from './bind-working-change-set.js';
import { transferFrozenSubjectBytes } from './frozen-store.js';
import {
	createGitObservationBudgetSession,
	observeRawByteComparisonPolicy,
	observeGitWorkingState,
	type GitWorkingObservation
} from './observe-working-change-set.js';
import { resolveSubject } from './resolve-subject.js';
import { computeSubjectId, subjectIdentityCoordinates } from './subject-identity.js';
import { validateRequestPaths } from './policy.js';
import { WorkingChangeSetIncompatibleError } from './working-change-set-error.js';

export interface ResolveWorkingSubjectHooks {
	/** Test-only injection after a selected artifact descriptor read and before path revalidation. */
	readonly afterFinalArtifactRead?: (attempt: number, path: string) => void;
	readonly afterInitialGitObservation?: (attempt: number) => void;
	readonly afterSubjectResolution?: (attempt: number) => void;
	readonly beforeFinalGitObservation?: (attempt: number) => void;
}

function unavailableDiagnostic(error: unknown): SubjectDiagnostic {
	return {
		code: 'WORKING_CHANGE_SET_UNAVAILABLE',
		message: error instanceof Error ? error.message : String(error),
		path: null,
		phase: 'RECHECK',
		severity: 'ERROR'
	};
}

function incompatibleDiagnostic(error: WorkingChangeSetIncompatibleError): SubjectDiagnostic {
	return {
		code: 'WORKING_CHANGE_SET_INCOMPATIBLE',
		message: error.message,
		path: null,
		phase: 'RECHECK',
		severity: 'ERROR'
	};
}

function changedDiagnostic(): SubjectDiagnostic {
	return {
		code: 'WORKING_CHANGE_SET_CHANGED_DURING_RESOLUTION',
		message: 'Git base, index, or local status changed during Working Change Set resolution.',
		path: null,
		phase: 'RECHECK',
		severity: 'ERROR'
	};
}

function observationsMatch(left: GitWorkingObservation, right: GitWorkingObservation): boolean {
	return left.observationDigest === right.observationDigest;
}

function validateWorkingRequest(request: ResolveSubjectRequest): void {
	if (request.schemaVersion !== SUBJECT_REQUEST_SCHEMA_VERSION)
		throw new WorkingChangeSetIncompatibleError(
			'Working Change Set request schema version is unsupported.'
		);
	if (request.policyVersion !== SUBJECT_POLICY_VERSION)
		throw new WorkingChangeSetIncompatibleError(
			'Working Change Set subject policy version is unsupported.'
		);
	if (request.subjectKind !== 'WORKTREE')
		throw new WorkingChangeSetIncompatibleError(
			'Working Change Set resolution requires a WORKTREE subject.'
		);
	if (!isAbsolute(request.rootLocator))
		throw new WorkingChangeSetIncompatibleError(
			'Working Change Set repository root must be absolute.'
		);
	try {
		validateRequestPaths(request);
	} catch (error) {
		throw new WorkingChangeSetIncompatibleError(
			error instanceof Error ? error.message : 'Working Change Set request is invalid.'
		);
	}
}

function bindSubject(subject: FrozenSubject, observation: GitWorkingObservation): FrozenSubject {
	const preliminaryChangeSet = bindWorkingChangeSet(subject, observation);
	const descriptorWithoutIdentity = {
		...subject.descriptor,
		dirtyState: preliminaryChangeSet.dirtyState,
		parentRevision:
			preliminaryChangeSet.dirtyState === 'DIRTY' ? preliminaryChangeSet.baseRevision : null,
		revision: preliminaryChangeSet.dirtyState === 'CLEAN' ? preliminaryChangeSet.baseRevision : null
	};
	const descriptor = Object.freeze({
		...descriptorWithoutIdentity,
		subjectId: computeSubjectId(subjectIdentityCoordinates(descriptorWithoutIdentity))
	});
	const workingChangeSet = bindWorkingChangeSetSubjectIdentity(
		preliminaryChangeSet,
		observation,
		descriptor.subjectId
	);
	const bound: FrozenSubject = Object.freeze({ ...subject, descriptor, workingChangeSet });
	transferFrozenSubjectBytes(subject, bound);
	return bound;
}

export function resolveWorkingSubject(
	request: ResolveSubjectRequest,
	hooks: ResolveWorkingSubjectHooks = {}
): SubjectResolutionOutcome {
	try {
		validateWorkingRequest(request);
	} catch (error) {
		if (error instanceof WorkingChangeSetIncompatibleError)
			return { diagnostics: [incompatibleDiagnostic(error)], outcome: 'incompatible' };
		return { diagnostics: [unavailableDiagnostic(error)], outcome: 'unavailable' };
	}
	const deadlineMs = Date.now() + request.budgets.maxDurationMs;
	const gitBudget = createGitObservationBudgetSession(request.budgets);
	const remainingRequest = (): ResolveSubjectRequest => {
		const remaining = deadlineMs - Date.now();
		if (remaining <= 0)
			throw new Error('Working Change Set resolution exceeded its duration budget.');
		return { ...request, budgets: { ...request.budgets, maxDurationMs: remaining } };
	};
	for (let attempt = 1; attempt <= 2; attempt += 1) {
		try {
			const currentRequest = remainingRequest();
			const initialGit = observeGitWorkingState(
				currentRequest.rootLocator,
				currentRequest.budgets,
				gitBudget
			);
			hooks.afterInitialGitObservation?.(attempt);
			const resolved = resolveSubject(remainingRequest());
			if (resolved.outcome !== 'resolved') return resolved;
			hooks.afterSubjectResolution?.(attempt);
			const bound = bindSubject(resolved.subject, initialGit);
			hooks.beforeFinalGitObservation?.(attempt);
			const finalRequest = remainingRequest();
			const finalGit = observeGitWorkingState(
				finalRequest.rootLocator,
				finalRequest.budgets,
				gitBudget
			);
			if (!observationsMatch(initialGit, finalGit)) {
				if (attempt < 2) continue;
				return { diagnostics: [changedDiagnostic()], outcome: 'unavailable' };
			}
			if (
				!frozenWorkingArtifactsMatch(bound, bound.workingChangeSet!, finalGit, (path) =>
					hooks.afterFinalArtifactRead?.(attempt, path)
				)
			) {
				if (attempt < 2) continue;
				return { diagnostics: [changedDiagnostic()], outcome: 'unavailable' };
			}
			const finalRawByteComparison = observeRawByteComparisonPolicy(
				finalGit,
				bound.artifacts.map((artifact) => artifact.path)
			);
			if (
				canonicalJson(finalRawByteComparison) !==
				canonicalJson(bound.workingChangeSet!.git.rawByteComparison)
			) {
				if (attempt < 2) continue;
				return { diagnostics: [changedDiagnostic()], outcome: 'unavailable' };
			}
			if (
				bound.workingChangeSet === null ||
				bound.workingChangeSet.git.objectFormat !== finalGit.objectFormat ||
				bound.workingChangeSet.git.providerId !== 'git' ||
				bound.workingChangeSet.git.providerVersion !== finalGit.gitVersion
			)
				throw new Error('Bound Working Change Set does not reconcile with final Git identity.');
			return { ...resolved, subject: bound };
		} catch (error) {
			if (error instanceof WorkingChangeSetIncompatibleError)
				return { diagnostics: [incompatibleDiagnostic(error)], outcome: 'incompatible' };
			return { diagnostics: [unavailableDiagnostic(error)], outcome: 'unavailable' };
		}
	}
	return { diagnostics: [changedDiagnostic()], outcome: 'unavailable' };
}
