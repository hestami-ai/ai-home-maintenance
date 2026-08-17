import type {
	ProjectSubjectRecord,
	ResolveSubjectRequest,
	SubjectCompleteness,
	SubjectDiagnostic,
	SubjectResolutionOutcome
} from '../contracts/subject.js';
import { canonicalJson, compareText } from '../inventory/canonical.js';
import { CaptureFailure, captureSubject } from './capture.js';
import type { SubjectCapture } from './capture-model.js';
import { reconcileConfigurationClosure } from './artifacts.js';
import { reconcileGeneratedContext } from './generated-context.js';
import { buildFrozenSubject } from './manifest.js';
import { canonicalPathKey } from './paths.js';
import { discoverProjects, ProjectDiscoveryFailure } from './projects.js';
import { discoverWorkspaces, WorkspaceDiscoveryFailure } from './workspaces.js';

export interface SubjectResolutionHooks {
	readonly afterCapture?: (attempt: number) => void;
	readonly beforeLiveRecheck?: (attempt: number) => void;
}

interface InternalResolutionOptions {
	readonly hooks?: SubjectResolutionHooks;
	readonly skipLiveRecheck?: boolean;
}

function captureSignature(capture: SubjectCapture): string {
	return canonicalJson({
		artifacts: capture.artifacts.map(({ bytes, path, primaryClass, sha256 }) => ({
			bytes,
			path,
			primaryClass,
			sha256
		})),
		directories: capture.directoryPaths,
		excluded: capture.excludedArtifacts.map(
			({ path, physicalFileCount, policyId, primaryClass }) => ({
				path,
				physicalFileCount,
				policyId,
				primaryClass
			})
		)
	});
}

function changedDiagnostic(): SubjectDiagnostic {
	return {
		code: 'SUBJECT_CHANGED_DURING_RESOLUTION',
		message: 'Repository membership or bytes changed during subject resolution.',
		path: null,
		phase: 'RECHECK',
		severity: 'ERROR'
	};
}

function unexpectedDiagnostic(error: unknown, rootLocator: string): SubjectDiagnostic {
	const raw = error instanceof Error ? error.message : String(error);
	return {
		code: 'READ_FAILED',
		message: raw
			.replaceAll(rootLocator, '<runtime>')
			.replaceAll(rootLocator.replaceAll('\\', '/'), '<runtime>')
			.replaceAll('\\', '/'),
		path: null,
		phase: 'RESOLVE',
		severity: 'ERROR'
	};
}

function canonicalizeAdditionalArtifacts(
	request: ResolveSubjectRequest,
	capture: SubjectCapture
): ResolveSubjectRequest {
	if (request.scope.kind !== 'EXPLICIT_PROJECTS') return request;
	const requested = request.scope.additionalArtifacts ?? [];
	if (requested.length === 0) {
		if (request.scope.additionalArtifacts === undefined) return request;
		return {
			...request,
			scope: { kind: 'EXPLICIT_PROJECTS', projects: [...request.scope.projects] }
		};
	}
	const artifactByCanonicalPath = new Map(
		capture.artifacts.map((artifact) => [artifact.canonicalPathKey, artifact] as const)
	);
	const additionalArtifacts = requested
		.map((requestedPath) => {
			const artifact = artifactByCanonicalPath.get(canonicalPathKey(requestedPath));
			if (artifact === undefined || !capture.bytesByPath.has(artifact.path))
				throw new CaptureFailure(
					{
						code: 'ADDITIONAL_ARTIFACT_REQUIRED_MISSING',
						message: 'Requested additional evidence was absent or excluded by the subject request.',
						path: requestedPath,
						phase: 'CAPTURE',
						severity: 'ERROR'
					},
					'not-found'
				);
			return artifact.path;
		})
		.sort(compareText);
	return {
		...request,
		scope: {
			additionalArtifacts,
			kind: 'EXPLICIT_PROJECTS',
			projects: [...request.scope.projects]
		}
	};
}

function requestWithRemainingBudget(
	request: ResolveSubjectRequest,
	deadline: number
): ResolveSubjectRequest {
	const remaining = deadline - Date.now();
	if (remaining <= 0)
		throw new CaptureFailure(
			{
				code: 'BUDGET_EXCEEDED',
				message: 'Subject resolution exceeded its duration budget.',
				path: null,
				phase: 'RESOLVE',
				severity: 'ERROR'
			},
			'unavailable'
		);
	return { ...request, budgets: { ...request.budgets, maxDurationMs: Math.max(1, remaining) } };
}

function isUnexpectedlyEmptySubject(
	projects: readonly ProjectSubjectRecord[],
	request: ResolveSubjectRequest
): boolean {
	return projects.length === 0 && request.expectEmpty !== true;
}

function emptySubjectOutcome(): SubjectResolutionOutcome {
	return {
		diagnostics: [
			{
				code: 'EMPTY_SUBJECT',
				message: 'No TypeScript project was resolved for the requested subject.',
				path: null,
				phase: 'RESOLVE',
				severity: 'ERROR'
			}
		],
		outcome: 'incompatible'
	};
}

function liveRecheckDetectedChange(
	initialCapture: SubjectCapture,
	options: InternalResolutionOptions,
	remainingRequest: () => ResolveSubjectRequest
): boolean {
	if (options.skipLiveRecheck === true) return false;
	const currentCapture = captureSubject(remainingRequest());
	return captureSignature(initialCapture) !== captureSignature(currentCapture);
}

function resolutionCompleteness(
	projects: readonly ProjectSubjectRecord[],
	diagnostics: readonly SubjectDiagnostic[]
): SubjectCompleteness {
	if (projects.some((project) => project.status === 'PARTIAL')) return 'PARTIAL';
	if (diagnostics.some((item) => item.severity !== 'INFO')) return 'PARTIAL';
	return 'COMPLETE';
}

function isRetryableResolutionFailure(error: unknown): boolean {
	if (error instanceof CaptureFailure)
		return error.diagnostic.code === 'SUBJECT_CHANGED_DURING_RESOLUTION';
	if (error instanceof ProjectDiscoveryFailure)
		return error.diagnostic.code === 'SUBJECT_CHANGED_DURING_RESOLUTION';
	return false;
}

function workspaceFailureCode(
	outcome: WorkspaceDiscoveryFailure['outcome']
): SubjectDiagnostic['code'] {
	if (outcome === 'ambiguous') return 'PROJECT_AMBIGUOUS';
	if (outcome === 'not-found') return 'CONFIG_REQUIRED_MISSING';
	return 'CONFIG_MALFORMED';
}

function resolutionFailureOutcome(error: unknown, rootLocator: string): SubjectResolutionOutcome {
	if (error instanceof CaptureFailure)
		return { diagnostics: [error.diagnostic], outcome: error.outcome };
	if (error instanceof ProjectDiscoveryFailure)
		return { diagnostics: [error.diagnostic], outcome: error.outcome };
	if (error instanceof WorkspaceDiscoveryFailure)
		return {
			diagnostics: [
				{
					code: workspaceFailureCode(error.outcome),
					message: error.message,
					path: null,
					phase: 'RESOLVE',
					severity: 'ERROR'
				}
			],
			outcome: error.outcome
		};
	return {
		diagnostics: [unexpectedDiagnostic(error, rootLocator)],
		outcome: 'unavailable'
	};
}

export function resolveSubject(
	request: ResolveSubjectRequest,
	hooks?: SubjectResolutionHooks
): SubjectResolutionOutcome {
	return resolveSubjectInternal(request, { hooks });
}

export function resolveSubjectInternal(
	request: ResolveSubjectRequest,
	options: InternalResolutionOptions = {}
): SubjectResolutionOutcome {
	const deadline = Date.now() + request.budgets.maxDurationMs;
	const remainingRequest = (): ResolveSubjectRequest =>
		requestWithRemainingBudget(request, deadline);
	for (let attempt = 1; attempt <= 2; attempt += 1) {
		try {
			const initialCapture = captureSubject(remainingRequest());
			const resolvedRequest = canonicalizeAdditionalArtifacts(request, initialCapture);
			options.hooks?.afterCapture?.(attempt);
			remainingRequest();
			const workspaceDiscovery = discoverWorkspaces(initialCapture);
			const projectDiscovery = discoverProjects(
				initialCapture,
				resolvedRequest,
				workspaceDiscovery.workspaces
			);
			remainingRequest();
			if (isUnexpectedlyEmptySubject(projectDiscovery.projects, resolvedRequest)) {
				return emptySubjectOutcome();
			}
			const closureReconciled = reconcileConfigurationClosure(
				initialCapture,
				projectDiscovery.projects
			);
			const generated = reconcileGeneratedContext(
				closureReconciled,
				projectDiscovery.projects,
				resolvedRequest
			);
			options.hooks?.beforeLiveRecheck?.(attempt);
			if (liveRecheckDetectedChange(initialCapture, options, remainingRequest)) {
				if (attempt < 2) continue;
				return { diagnostics: [changedDiagnostic()], outcome: 'unavailable' };
			}
			const diagnostics = [
				...workspaceDiscovery.diagnostics,
				...projectDiscovery.diagnostics,
				...generated.diagnostics
			];
			remainingRequest();
			const subject = buildFrozenSubject({
				capture: generated.capture,
				diagnostics,
				generatedContexts: generated.contexts,
				projects: projectDiscovery.projects,
				request: resolvedRequest,
				workspaces: workspaceDiscovery.workspaces
			});
			const completeness = resolutionCompleteness(projectDiscovery.projects, diagnostics);
			return { completeness, diagnostics, outcome: 'resolved', subject };
		} catch (error) {
			if (isRetryableResolutionFailure(error) && attempt < 2) continue;
			return resolutionFailureOutcome(error, request.rootLocator);
		}
	}
	return { diagnostics: [changedDiagnostic()], outcome: 'unavailable' };
}
