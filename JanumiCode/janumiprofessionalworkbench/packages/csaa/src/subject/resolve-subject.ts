import type {
	ResolveSubjectRequest,
	SubjectDiagnostic,
	SubjectResolutionOutcome
} from '../contracts/subject.js';
import { canonicalJson } from '../inventory/canonical.js';
import { CaptureFailure, captureSubject } from './capture.js';
import type { SubjectCapture } from './capture-model.js';
import { reconcileConfigurationClosure } from './artifacts.js';
import { reconcileGeneratedContext } from './generated-context.js';
import { buildFrozenSubject } from './manifest.js';
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
		artifacts: capture.artifacts.map(({ bytes, path, primaryClass, sha256 }) => ({ bytes, path, primaryClass, sha256 })),
		directories: capture.directoryPaths,
		excluded: capture.excludedArtifacts.map(({ path, physicalFileCount, policyId, primaryClass }) => ({ path, physicalFileCount, policyId, primaryClass }))
	});
}

function changedDiagnostic(): SubjectDiagnostic {
	return { code: 'SUBJECT_CHANGED_DURING_RESOLUTION', message: 'Repository membership or bytes changed during subject resolution.', path: null, phase: 'RECHECK', severity: 'ERROR' };
}

function unexpectedDiagnostic(error: unknown, rootLocator: string): SubjectDiagnostic {
	const raw = error instanceof Error ? error.message : String(error);
	return { code: 'READ_FAILED', message: raw.replaceAll(rootLocator, '<runtime>').replaceAll(rootLocator.replaceAll('\\', '/'), '<runtime>').replaceAll('\\', '/'), path: null, phase: 'RESOLVE', severity: 'ERROR' };
}

export function resolveSubject(request: ResolveSubjectRequest, hooks?: SubjectResolutionHooks): SubjectResolutionOutcome {
	return resolveSubjectInternal(request, { hooks });
}

export function resolveSubjectInternal(request: ResolveSubjectRequest, options: InternalResolutionOptions = {}): SubjectResolutionOutcome {
	const deadline = Date.now() + request.budgets.maxDurationMs;
	const remainingRequest = (): ResolveSubjectRequest => {
		const remaining = deadline - Date.now();
		if (remaining <= 0) throw new CaptureFailure({ code: 'BUDGET_EXCEEDED', message: 'Subject resolution exceeded its duration budget.', path: null, phase: 'RESOLVE', severity: 'ERROR' }, 'unavailable');
		return { ...request, budgets: { ...request.budgets, maxDurationMs: Math.max(1, remaining) } };
	};
	for (let attempt = 1; attempt <= 2; attempt += 1) {
		try {
			const initialCapture = captureSubject(remainingRequest());
			options.hooks?.afterCapture?.(attempt);
			remainingRequest();
			const workspaceDiscovery = discoverWorkspaces(initialCapture);
			const projectDiscovery = discoverProjects(initialCapture, request, workspaceDiscovery.workspaces);
			remainingRequest();
			if (projectDiscovery.projects.length === 0 && request.expectEmpty !== true) {
				return { diagnostics: [{ code: 'EMPTY_SUBJECT', message: 'No TypeScript project was resolved for the requested subject.', path: null, phase: 'RESOLVE', severity: 'ERROR' }], outcome: 'incompatible' };
			}
			const closureReconciled = reconcileConfigurationClosure(initialCapture, projectDiscovery.projects);
			const generated = reconcileGeneratedContext(closureReconciled, projectDiscovery.projects, request);
			options.hooks?.beforeLiveRecheck?.(attempt);
			if (options.skipLiveRecheck !== true) {
				const currentCapture = captureSubject(remainingRequest());
				if (captureSignature(initialCapture) !== captureSignature(currentCapture)) {
					if (attempt < 2) continue;
					return { diagnostics: [changedDiagnostic()], outcome: 'unavailable' };
				}
			}
			const diagnostics = [...workspaceDiscovery.diagnostics, ...projectDiscovery.diagnostics, ...generated.diagnostics];
			remainingRequest();
			const subject = buildFrozenSubject({ capture: generated.capture, diagnostics, generatedContexts: generated.contexts, projects: projectDiscovery.projects, request, workspaces: workspaceDiscovery.workspaces });
			const completeness = projectDiscovery.projects.some((project) => project.status === 'PARTIAL') || diagnostics.some((item) => item.severity !== 'INFO') ? 'PARTIAL' : 'COMPLETE';
			return { completeness, diagnostics, outcome: 'resolved', subject };
		} catch (error) {
			if (error instanceof CaptureFailure) {
				if (error.diagnostic.code === 'SUBJECT_CHANGED_DURING_RESOLUTION' && attempt < 2) continue;
				return { diagnostics: [error.diagnostic], outcome: error.outcome };
			}
			if (error instanceof ProjectDiscoveryFailure) {
				if (error.diagnostic.code === 'SUBJECT_CHANGED_DURING_RESOLUTION' && attempt < 2) continue;
				return { diagnostics: [error.diagnostic], outcome: error.outcome };
			}
			if (error instanceof WorkspaceDiscoveryFailure) {
				const code = error.outcome === 'ambiguous' ? 'PROJECT_AMBIGUOUS' : error.outcome === 'not-found' ? 'CONFIG_REQUIRED_MISSING' : 'CONFIG_MALFORMED';
				return { diagnostics: [{ code, message: error.message, path: null, phase: 'RESOLVE', severity: 'ERROR' }], outcome: error.outcome };
			}
			return { diagnostics: [unexpectedDiagnostic(error, request.rootLocator)], outcome: 'unavailable' };
		}
	}
	return { diagnostics: [changedDiagnostic()], outcome: 'unavailable' };
}
