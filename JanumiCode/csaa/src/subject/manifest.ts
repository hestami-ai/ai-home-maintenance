import type {
	CapturedArtifactRecord,
	ExcludedArtifactRecord,
	FrozenSubject,
	GeneratedContextRecord,
	ProjectSubjectRecord,
	ResolveSubjectRequest,
	SubjectDescriptor,
	SubjectDiagnostic,
	TestPopulationRecord,
	WorkspaceSubjectRecord
} from '../contracts/subject.js';
import { SUBJECT_SCHEMA_VERSION } from '../contracts/subject.js';
import { canonicalJson, compareText, sha256 } from '../inventory/canonical.js';
import type { SubjectCapture } from './capture-model.js';
import { attachFrozenSubjectBytes } from './frozen-store.js';
import {
	SUBJECT_EXCLUSION_POLICY_IDS,
	subjectFilterPolicyId,
	subjectOutputPolicyId
} from './policy.js';
import { discoverTestPopulations } from './test-populations.js';
import { computeSubjectId } from './subject-identity.js';

function deepFreeze<T>(value: T): T {
	if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
	}
	return value;
}

export interface ManifestInputs {
	readonly capture: SubjectCapture;
	readonly diagnostics: readonly SubjectDiagnostic[];
	readonly generatedContexts: readonly GeneratedContextRecord[];
	readonly projects: readonly ProjectSubjectRecord[];
	readonly request: ResolveSubjectRequest;
	readonly workspaces: readonly WorkspaceSubjectRecord[];
}

export function subjectConfigurationPreimage(
	artifacts: readonly CapturedArtifactRecord[],
	generatedContexts: readonly GeneratedContextRecord[],
	projects: readonly ProjectSubjectRecord[],
	testPopulations: readonly TestPopulationRecord[],
	workspaces: readonly WorkspaceSubjectRecord[]
) {
	const configurationArtifacts = artifacts.filter((artifact) =>
		[
			'MANIFEST',
			'LOCKFILE',
			'TOOL_CONFIGURATION',
			'PROJECT_CONFIGURATION',
			'GENERATED_CONFIGURATION'
		].includes(artifact.primaryClass)
	);
	return {
		artifacts: configurationArtifacts.map((artifact) => ({
			artifactClass: artifact.primaryClass,
			bytes: artifact.bytes,
			path: artifact.path,
			sha256: artifact.sha256
		})),
		generatedContexts: generatedContexts.map(
			({
				consumerProject,
				generator,
				outputManifestDigest,
				outputPaths,
				path,
				selectedInput,
				sha256: digest
			}) => ({
				consumerProject,
				generator,
				outputManifestDigest,
				outputPaths,
				path,
				selectedInput,
				sha256: digest
			})
		),
		projects: projects.map((project) => project.programRecipe),
		testPopulations,
		workspaces
	};
}

function addProjectRequiredPaths(required: Set<string>, project: ProjectSubjectRecord): void {
	required.add(project.configPath);
	for (const path of project.fileNames) required.add(path);
	for (const path of project.frameworkCandidates) required.add(path);
	for (const closure of project.configClosure) required.add(closure.path);
}

function workspaceIsWithinRequiredPaths(
	workspace: WorkspaceSubjectRecord,
	required: ReadonlySet<string>
): boolean {
	return [...required].some(
		(path) => path === workspace.path || path.startsWith(`${workspace.path}/`)
	);
}

function artifactIsWithinExplicitScope(
	artifact: CapturedArtifactRecord,
	scopedWorkspaces: readonly WorkspaceSubjectRecord[]
): boolean {
	if (artifact.primaryClass === 'LOCKFILE') return true;
	if (
		artifact.roles.includes('TEST') &&
		scopedWorkspaces.some((workspace) => artifact.path.startsWith(`${workspace.path}/`))
	)
		return true;
	return (
		artifact.primaryClass === 'TOOL_CONFIGURATION' &&
		(!artifact.path.includes('/') ||
			scopedWorkspaces.some((workspace) => artifact.path.startsWith(`${workspace.path}/`)))
	);
}

function assertAdditionalArtifactsCaptured(
	capture: SubjectCapture,
	additionalArtifacts: readonly string[]
): void {
	for (const path of additionalArtifacts) {
		if (!capture.bytesByPath.has(path))
			throw new Error(`Requested additional artifact was not captured: ${path}.`);
	}
}

function applyExplicitScope(
	capture: SubjectCapture,
	request: ResolveSubjectRequest,
	projects: readonly ProjectSubjectRecord[],
	workspaces: readonly WorkspaceSubjectRecord[]
): { readonly capture: SubjectCapture; readonly workspaces: readonly WorkspaceSubjectRecord[] } {
	if (request.scope.kind !== 'EXPLICIT_PROJECTS') return { capture, workspaces };
	const additionalArtifacts = request.scope.additionalArtifacts ?? [];
	const required = new Set<string>();
	for (const path of additionalArtifacts) required.add(path);
	for (const project of projects) addProjectRequiredPaths(required, project);
	const scopedWorkspaces = workspaces.filter((workspace) =>
		workspaceIsWithinRequiredPaths(workspace, required)
	);
	const withinScopedWorkspace = (path: string) =>
		scopedWorkspaces.some((workspace) => path.startsWith(`${workspace.path}/`));
	const fullTestDiscovery = discoverTestPopulations(capture);
	for (const population of fullTestDiscovery.populations)
		for (const path of [...population.includedPaths, ...population.excludedPaths])
			if (withinScopedWorkspace(path)) required.add(path);
	required.add('package.json');
	for (const workspace of scopedWorkspaces) required.add(workspace.manifestPath);
	for (const artifact of capture.artifacts) {
		if (artifactIsWithinExplicitScope(artifact, scopedWorkspaces)) required.add(artifact.path);
	}
	assertAdditionalArtifactsCaptured(capture, additionalArtifacts);
	const artifacts = capture.artifacts.filter((artifact) => required.has(artifact.path));
	const removed = capture.artifacts.filter((artifact) => !required.has(artifact.path));
	const exclusions: ExcludedArtifactRecord[] = removed.map((artifact) => ({
		canonicalPathKey: artifact.canonicalPathKey,
		disposition: 'EXCLUDED',
		path: artifact.path,
		physicalFileCount: 1,
		policyId: subjectFilterPolicyId(request),
		primaryClass: artifact.primaryClass,
		reason: 'Artifact lies outside the explicit-project subject perimeter.',
		roles: artifact.roles
	}));
	const retained = new Set(artifacts.map((artifact) => artifact.path));
	return {
		capture: {
			...capture,
			artifacts,
			bytesByPath: new Map([...capture.bytesByPath].filter(([path]) => retained.has(path))),
			excludedArtifacts: [...capture.excludedArtifacts, ...exclusions].sort((left, right) =>
				left.path < right.path ? -1 : 1
			),
			fingerprints: new Map([...capture.fingerprints].filter(([path]) => retained.has(path)))
		},
		workspaces: scopedWorkspaces
	};
}

export function buildFrozenSubject(inputs: ManifestInputs): FrozenSubject {
	const scoped = applyExplicitScope(
		inputs.capture,
		inputs.request,
		inputs.projects,
		inputs.workspaces
	);
	const capture = scoped.capture;
	const testDiscovery = discoverTestPopulations(capture);
	const artifacts = [...capture.artifacts].sort((left, right) => (left.path < right.path ? -1 : 1));
	const excludedArtifacts = [...capture.excludedArtifacts].sort((left, right) =>
		left.path < right.path ? -1 : 1
	);
	const fileManifestDigest = sha256(
		canonicalJson(
			artifacts.map((artifact) => ({
				artifactClass: artifact.primaryClass,
				bytes: artifact.bytes,
				path: artifact.path,
				sha256: artifact.sha256
			}))
		)
	);
	const configurationDigest = sha256(
		canonicalJson(
			subjectConfigurationPreimage(
				artifacts,
				inputs.generatedContexts,
				inputs.projects,
				testDiscovery.populations,
				scoped.workspaces
			)
		)
	);
	const exclusionPolicyIds = [
		...new Set([
			...SUBJECT_EXCLUSION_POLICY_IDS.filter(
				(identity) => identity !== 'jan-csaa-exclude-output/1'
			),
			subjectOutputPolicyId(inputs.request.outputs),
			subjectFilterPolicyId(inputs.request)
		])
	].sort(compareText);
	const perimeter =
		inputs.request.scope.kind === 'REPOSITORY'
			? [
					...new Set(
						artifacts.map((artifact) =>
							artifact.path.includes('/') ? artifact.path.split('/')[0]! : artifact.path
						)
					)
				].sort(compareText)
			: [
					...inputs.projects.map((project) => project.configPath),
					...(inputs.request.scope.additionalArtifacts ?? [])
				].sort(compareText);
	const identityPreimage = {
		schemaVersion: SUBJECT_SCHEMA_VERSION,
		subjectKind: inputs.request.subjectKind,
		revision: null,
		parentRevision: null,
		perimeter,
		fileManifestDigest,
		configurationDigest,
		exclusionPolicyIds
	};
	const subjectId = computeSubjectId(identityPreimage);
	const classCounts = new Map<
		CapturedArtifactRecord['primaryClass'],
		{ physicalFileCount: number | 'UNKNOWN'; recordCount: number }
	>();
	for (const artifact of excludedArtifacts) {
		const current = classCounts.get(artifact.primaryClass) ?? {
			physicalFileCount: 0,
			recordCount: 0
		};
		classCounts.set(artifact.primaryClass, {
			physicalFileCount:
				current.physicalFileCount === 'UNKNOWN' || artifact.physicalFileCount === 'UNKNOWN'
					? 'UNKNOWN'
					: current.physicalFileCount + artifact.physicalFileCount,
			recordCount: current.recordCount + 1
		});
	}
	const descriptor: SubjectDescriptor = {
		configurationDigest,
		dirtyState: 'UNKNOWN',
		excludedClasses: [...classCounts]
			.map(([primaryClass, counts]) => ({ ...counts, primaryClass }))
			.sort((left, right) => (left.primaryClass < right.primaryClass ? -1 : 1)),
		exclusionPolicyIds,
		fileManifestDigest,
		operationVersion: inputs.request.operationVersion,
		parentRevision: null,
		perimeter,
		policyVersion: inputs.request.policyVersion,
		repositoryRoot: '.',
		revision: null,
		schemaVersion: SUBJECT_SCHEMA_VERSION,
		subjectId,
		subjectKind: inputs.request.subjectKind
	};
	const analyzed = artifacts.filter((artifact) => artifact.disposition === 'ANALYZED').length;
	const inventoryOnly = artifacts.filter(
		(artifact) => artifact.disposition === 'INVENTORY_ONLY'
	).length;
	const included = artifacts.length;
	const excluded = excludedArtifacts.reduce(
		(count, artifact) =>
			count + (typeof artifact.physicalFileCount === 'number' ? artifact.physicalFileCount : 0),
		0
	);
	const excludedPhysicalFiles = excludedArtifacts.some(
		(artifact) => artifact.physicalFileCount === 'UNKNOWN'
	)
		? ('UNKNOWN' as const)
		: excluded;
	const discovered = capture.discoveredArtifactCount;
	const includedPartitionReconciles = included === analyzed + inventoryOnly;
	const knownPhysicalLowerBoundReconciles = discovered === included + excluded;
	if (!knownPhysicalLowerBoundReconciles)
		throw new Error('Subject known physical population lower bound does not reconcile.');
	if (excludedPhysicalFiles !== 'UNKNOWN' && discovered !== included + excludedPhysicalFiles)
		throw new Error('Subject physical population does not reconcile.');
	const physicalPopulationReconciles =
		excludedPhysicalFiles === 'UNKNOWN' ? ('UNKNOWN' as const) : (true as const);
	const discoveredPhysicalFiles =
		excludedPhysicalFiles === 'UNKNOWN' ? ('UNKNOWN' as const) : discovered;
	const excludedRecords = excludedArtifacts.length;
	const capturedRecords = artifacts.length + excludedRecords;
	const population = {
		analyzed,
		capturedRecords,
		capturedRecordsReconcile: true as const,
		discovered,
		discoveredPhysicalFiles,
		excluded,
		excludedRecords,
		excludedPhysicalFiles,
		failed: 0,
		included,
		includedDispositionReconciles: true as const,
		inventoryOnly,
		knownPhysicalLowerBoundReconciles: true as const,
		physicalPopulationReconciles,
		reconciles: includedPartitionReconciles && knownPhysicalLowerBoundReconciles,
		reconciliationScope:
			excludedPhysicalFiles === 'UNKNOWN'
				? ('CAPTURED_RECORDS_ONLY' as const)
				: ('EXACT_PHYSICAL_POPULATION' as const)
	};
	if (!population.reconciles) throw new Error('Subject population does not reconcile.');
	const subject: FrozenSubject = {
		artifacts,
		descriptor,
		diagnostics: [...inputs.diagnostics, ...testDiscovery.diagnostics],
		excludedArtifacts,
		generatedContexts: [...inputs.generatedContexts],
		population,
		projects: [...inputs.projects],
		request: { ...inputs.request, rootLocator: '<runtime>' },
		testPopulations: [...testDiscovery.populations],
		workspaces: [...scoped.workspaces],
		workingChangeSet: null
	};
	deepFreeze(subject);
	attachFrozenSubjectBytes(subject, capture.bytesByPath);
	return subject;
}
