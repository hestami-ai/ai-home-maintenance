import type {
	ExcludedArtifactRecord,
	GeneratedContextRecord,
	ProjectSubjectRecord,
	ResolveSubjectRequest,
	SubjectDiagnostic
} from '../contracts/subject.js';
import type { SubjectCapture } from './capture-model.js';
import { canonicalPathKey } from './paths.js';

export interface GeneratedContextFreshnessEvidence {
	readonly generatorInputDigest: string;
	readonly recordedInputDigest: string;
	readonly source: string;
}

export interface GeneratedContextResolution {
	readonly capture: SubjectCapture;
	readonly contexts: readonly GeneratedContextRecord[];
	readonly diagnostics: readonly SubjectDiagnostic[];
}

export function assessGeneratedContextFreshness(evidence?: GeneratedContextFreshnessEvidence): Pick<GeneratedContextRecord, 'freshness' | 'freshnessBasis' | 'freshnessEvidence'> {
	if (evidence === undefined) return {
		freshness: 'UNKNOWN',
		freshnessBasis: 'No generator-input identity or governed generation record was captured.',
		freshnessEvidence: []
	};
	return evidence.generatorInputDigest === evidence.recordedInputDigest ? {
		freshness: 'CURRENT',
		freshnessBasis: 'Captured generator-input identity matches the governed generation record.',
		freshnessEvidence: [evidence.source, evidence.generatorInputDigest]
	} : {
		freshness: 'STALE',
		freshnessBasis: 'Captured generator-input identity differs from the governed generation record.',
		freshnessEvidence: [evidence.source, evidence.generatorInputDigest, evidence.recordedInputDigest]
	};
}

export function reconcileGeneratedContext(capture: SubjectCapture, projects: readonly ProjectSubjectRecord[], request: ResolveSubjectRequest): GeneratedContextResolution {
	const consumed = new Set(projects.flatMap((project) => project.fileNames.filter((path) => path.includes('/.svelte-kit/'))));
	const retainedArtifacts = capture.artifacts.filter((artifact) => artifact.primaryClass !== 'GENERATED_SOURCE' || !artifact.path.includes('/.svelte-kit/') || consumed.has(artifact.path));
	const removed = capture.artifacts.filter((artifact) => artifact.primaryClass === 'GENERATED_SOURCE' && artifact.path.includes('/.svelte-kit/') && !consumed.has(artifact.path));
	const extraExclusions: ExcludedArtifactRecord[] = removed.map((artifact) => ({
		canonicalPathKey: artifact.canonicalPathKey,
		disposition: 'EXCLUDED',
		path: artifact.path,
		physicalFileCount: 1,
		policyId: 'jan-csaa-exclude-build/1',
		primaryClass: 'BUILD_OUTPUT',
		reason: 'Generated framework declaration is not a compiler root of the captured project.',
		roles: ['GENERATED']
	}));
	const retainedPaths = new Set(retainedArtifacts.map((artifact) => artifact.path));
	const bytesByPath = new Map([...capture.bytesByPath].filter(([path]) => retainedPaths.has(path)));
	const fingerprints = new Map([...capture.fingerprints].filter(([path]) => retainedPaths.has(path)));
	const contexts: GeneratedContextRecord[] = [];
	const diagnostics: SubjectDiagnostic[] = [];
	for (const project of projects) {
		const generatedConfig = project.configClosure.find((record) => record.path.includes('/.svelte-kit/tsconfig.json'));
		if (generatedConfig !== undefined) {
			const generatedConfigKey = canonicalPathKey(generatedConfig.path);
			const evidence = request.generatedContextEvidence?.find((item) => canonicalPathKey(item.path) === generatedConfigKey);
			const freshness = assessGeneratedContextFreshness(evidence);
			contexts.push({ consumerProject: project.configPath, ...freshness, path: generatedConfig.path, selectedInput: true, sha256: generatedConfig.sha256 });
			if (freshness.freshness === 'UNKNOWN') diagnostics.push({ code: 'GENERATED_CONTEXT_FRESHNESS_UNKNOWN', message: `Generated context freshness is unknown for ${project.configPath}.`, path: generatedConfig.path, phase: 'FRESHNESS', severity: 'WARNING' });
			if (freshness.freshness === 'STALE') diagnostics.push({ code: 'TYPESCRIPT_PROJECT_PARTIAL', message: `Generated context is stale for ${project.configPath}.`, path: generatedConfig.path, phase: 'FRESHNESS', severity: 'WARNING' });
		} else if (project.frameworkCandidates.length > 0) {
			diagnostics.push({ code: 'GENERATED_CONTEXT_ABSENT', message: `Framework candidates have no captured generated TypeScript context in ${project.configPath}.`, path: project.configPath, phase: 'RESOLVE', severity: 'WARNING' });
		}
	}
	return {
		capture: {
			...capture,
			artifacts: retainedArtifacts,
			bytesByPath,
			excludedArtifacts: [...capture.excludedArtifacts, ...extraExclusions].sort((left, right) => left.path < right.path ? -1 : 1),
			fingerprints
		},
		contexts: contexts.sort((left, right) => left.consumerProject < right.consumerProject ? -1 : 1),
		diagnostics
	};
}
