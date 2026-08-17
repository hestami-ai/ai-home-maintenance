import type {
	FrozenSubject,
	FrozenSubjectFreshness,
	ResolveSubjectRequest,
	SubjectDiagnostic
} from '../contracts/subject.js';
import { resolveSubjectInternal } from './resolve-subject.js';

function changedPaths(previous: FrozenSubject, current: FrozenSubject): string[] {
	const prior = new Map(previous.artifacts.map((artifact) => [artifact.path, artifact.sha256]));
	const next = new Map(current.artifacts.map((artifact) => [artifact.path, artifact.sha256]));
	return [...new Set([...prior.keys(), ...next.keys()])]
		.filter((path) => prior.get(path) !== next.get(path))
		.sort((a, b) => Number(a > b) - Number(a < b));
}

export function verifyFrozenSubject(
	subject: FrozenSubject,
	options: { readonly rootLocator: string }
): FrozenSubjectFreshness {
	const request = { ...subject.request, rootLocator: options.rootLocator } as ResolveSubjectRequest;
	const current = resolveSubjectInternal(request);
	if (current.outcome !== 'resolved') {
		return { changedPaths: [], diagnostics: current.diagnostics, state: 'UNAVAILABLE' };
	}
	if (current.subject.descriptor.subjectId === subject.descriptor.subjectId)
		return { changedPaths: [], diagnostics: [], state: 'CURRENT' };
	const diagnostics: SubjectDiagnostic[] = [
		{
			code: 'SUBJECT_CHANGED_DURING_RESOLUTION',
			message: 'The frozen subject no longer matches current repository membership and bytes.',
			path: null,
			phase: 'FRESHNESS',
			severity: 'WARNING'
		}
	];
	return { changedPaths: changedPaths(subject, current.subject), diagnostics, state: 'STALE' };
}
