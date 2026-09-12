import type {
	ArtifactDisposition,
	ArtifactPrimaryClass,
	ArtifactSemanticRole,
	ProjectSubjectRecord
} from '../contracts/subject.js';
import type { SubjectCapture } from './capture-model.js';

export interface ArtifactClassification {
	readonly disposition: ArtifactDisposition;
	readonly primaryClass: ArtifactPrimaryClass;
	readonly reason: string;
	readonly roles: readonly ArtifactSemanticRole[];
}

function hasSegment(path: string, segment: string): boolean {
	return path.split('/').includes(segment);
}

function isTest(path: string): boolean {
	return (
		/(^|\/)(test|tests|__tests__|e2e|e2e-live)(\/|$)/u.test(path) ||
		/\.(?:test|spec|e2e)\.[cm]?[jt]sx?$/u.test(path)
	);
}

function classifyManifest(path: string): ArtifactClassification | undefined {
	if (path === 'package.json' || path.endsWith('/package.json')) {
		return {
			disposition: 'ANALYZED',
			primaryClass: 'MANIFEST',
			reason: 'Package manifest defines workspace, export, command, and dependency context.',
			roles: ['ANALYSIS_INPUT', 'EXPORT_DECLARATION', 'MANIFEST']
		};
	}
	return undefined;
}

function classifyLockfile(path: string): ArtifactClassification | undefined {
	if (/^(?:bun\.lock|package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/u.test(path)) {
		return {
			disposition: 'ANALYZED',
			primaryClass: 'LOCKFILE',
			reason: 'Lockfile contributes dependency identity.',
			roles: ['ANALYSIS_INPUT', 'CONFIGURATION']
		};
	}
	return undefined;
}

function classifyRepositoryConfiguration(path: string): ArtifactClassification | undefined {
	if (
		path.startsWith('.github/') ||
		/^(?:\.gitignore|\.prettierignore|\.prettierrc(?:\.json)?|bunfig\.toml)$/u.test(path)
	) {
		return {
			disposition: 'ANALYZED',
			primaryClass: 'TOOL_CONFIGURATION',
			reason: 'Repository/tool configuration changes engineering and assurance behavior.',
			roles: ['ANALYSIS_INPUT', 'CONFIGURATION']
		};
	}
	return undefined;
}

function classifySvelteKitConfiguration(path: string): ArtifactClassification | undefined {
	if (/(^|\/)\.svelte-kit\/tsconfig\.json$/u.test(path)) {
		return {
			disposition: 'ANALYZED',
			primaryClass: 'GENERATED_CONFIGURATION',
			reason: 'Generated framework configuration is a required project-context input.',
			roles: ['ANALYSIS_INPUT', 'CONFIGURATION', 'GENERATED']
		};
	}
	return undefined;
}

function classifyProjectConfiguration(path: string): ArtifactClassification | undefined {
	if (/(^|\/)tsconfig(?:\.[^/]+)?\.json$/u.test(path)) {
		return {
			disposition: 'ANALYZED',
			primaryClass: 'PROJECT_CONFIGURATION',
			reason: 'TypeScript project configuration defines compiler roots and semantics.',
			roles: ['ANALYSIS_INPUT', 'CONFIGURATION']
		};
	}
	return undefined;
}

function classifyToolConfiguration(path: string): ArtifactClassification | undefined {
	if (
		/(^|\/)(?:(?:vite|playwright|svelte|eslint|prettier)(?:\.[^/]+)?\.config\.[cm]?[jt]s|vitest(?:\.[^/]+)?\.(?:config|projects)\.[cm]?[jt]s|turbo\.json|sonar-project\.properties)$/u.test(
			path
		) ||
		/^\.(?:dependency-cruiser|prettier|eslint)[^/]*$/u.test(path)
	) {
		const executableCompilerInput = /\.[cm]?[jt]sx?$/u.test(path);
		return {
			disposition: 'ANALYZED',
			primaryClass: 'TOOL_CONFIGURATION',
			reason: executableCompilerInput
				? 'Executable tool configuration changes repository behavior and remains a TypeScript compiler candidate.'
				: 'Tool configuration changes repository analysis and assurance behavior.',
			roles: executableCompilerInput
				? ['ANALYSIS_INPUT', 'COMPILER_CANDIDATE', 'CONFIGURATION']
				: ['ANALYSIS_INPUT', 'CONFIGURATION']
		};
	}
	return undefined;
}

function classifyGovernedVerificationArtifact(path: string): ArtifactClassification | undefined {
	if (/^verif\/csaa\/[^/]+\.evidence\.json$/u.test(path)) {
		return {
			disposition: 'ANALYZED',
			primaryClass: 'VERIFICATION',
			reason: 'Governed verification evidence is an explicit assurance input.',
			roles: ['ANALYSIS_INPUT', 'VERIFICATION']
		};
	}
	return undefined;
}

function classifySourceJson(path: string): ArtifactClassification | undefined {
	if (path.endsWith('.json') && hasSegment(path, 'src')) {
		const generated =
			hasSegment(path, 'gen') || hasSegment(path, 'generated') || path.endsWith('.generated.json');
		return {
			disposition: 'ANALYZED',
			primaryClass: generated ? 'GENERATED_SOURCE' : 'PRODUCTION_SOURCE',
			reason: generated
				? 'Generated source-bearing JSON remains a TypeScript compiler candidate.'
				: 'Source-bearing JSON remains a TypeScript compiler candidate.',
			roles: generated
				? ['ANALYSIS_INPUT', 'COMPILER_CANDIDATE', 'GENERATED']
				: ['ANALYSIS_INPUT', 'COMPILER_CANDIDATE', 'PRODUCTION']
		};
	}
	return undefined;
}

function classifySvelteSource(path: string): ArtifactClassification | undefined {
	if (path.endsWith('.svelte')) {
		return {
			disposition: 'INVENTORY_ONLY',
			primaryClass: isTest(path) ? 'TEST_SOURCE' : 'PRODUCTION_SOURCE',
			reason:
				'Svelte source is a framework candidate but not a TypeScript compiler root in DWP-002.',
			roles: isTest(path) ? ['FRAMEWORK_CANDIDATE', 'TEST'] : ['FRAMEWORK_CANDIDATE', 'PRODUCTION']
		};
	}
	return undefined;
}

function classifyScriptSource(path: string): ArtifactClassification | undefined {
	if (path.startsWith('scripts/') || hasSegment(path, 'scripts')) {
		const generator = /(?:^|[-_.])(gen|generate|generated|generator)(?:[-_.]|$)/u.test(path);
		return {
			disposition: 'ANALYZED',
			primaryClass: generator ? 'GENERATOR_SOURCE' : 'SCRIPT',
			reason: generator
				? 'Generator source produces governed artifacts.'
				: 'Repository script participates in engineering behavior.',
			roles: generator
				? ['ANALYSIS_INPUT', 'COMPILER_CANDIDATE', 'GENERATOR', 'SCRIPT']
				: ['ANALYSIS_INPUT', 'COMPILER_CANDIDATE', 'SCRIPT']
		};
	}
	return undefined;
}

function classifyCompilerSource(
	path: string,
	content: string | undefined
): ArtifactClassification | undefined {
	if (!/\.[cm]?[jt]sx?$/u.test(path)) return undefined;
	if (/(^|\/)\.svelte-kit\//u.test(path))
		return {
			disposition: 'ANALYZED',
			primaryClass: 'GENERATED_SOURCE',
			reason: 'Generated declaration is a consumed TypeScript project root.',
			roles: ['ANALYSIS_INPUT', 'COMPILER_CANDIDATE', 'GENERATED']
		};
	if (path.startsWith('verif/'))
		return {
			disposition: 'ANALYZED',
			primaryClass: 'VERIFICATION',
			reason: 'Verification code is an explicit assurance input.',
			roles: isTest(path)
				? ['ANALYSIS_INPUT', 'COMPILER_CANDIDATE', 'TEST', 'VERIFICATION']
				: ['ANALYSIS_INPUT', 'COMPILER_CANDIDATE', 'VERIFICATION']
		};
	if (isTest(path))
		return {
			disposition: 'ANALYZED',
			primaryClass: 'TEST_SOURCE',
			reason: 'Test source is an explicit compiler candidate.',
			roles: ['ANALYSIS_INPUT', 'COMPILER_CANDIDATE', 'TEST']
		};
	if (/(^|\/)src\/gen\//u.test(path))
		return {
			disposition: 'ANALYZED',
			primaryClass: 'GENERATOR_SOURCE',
			reason: 'Authored generator source produces governed artifacts.',
			roles: ['ANALYSIS_INPUT', 'COMPILER_CANDIDATE', 'GENERATOR']
		};
	const scriptSource = classifyScriptSource(path);
	if (scriptSource !== undefined) return scriptSource;
	if (content !== undefined && /^\uFEFF?\/\/ GENERATED FILE\b/u.test(content))
		return {
			disposition: 'ANALYZED',
			primaryClass: 'GENERATED_SOURCE',
			reason: 'Generated-file provenance marker identifies generated source.',
			roles: ['ANALYSIS_INPUT', 'COMPILER_CANDIDATE', 'GENERATED']
		};
	if (/(^|\/)(generated|gen)(\/|$)/u.test(path) || /\.generated\.[cm]?[jt]sx?$/u.test(path))
		return {
			disposition: 'ANALYZED',
			primaryClass: 'GENERATED_SOURCE',
			reason: 'Generated source remains a compiler input with explicit provenance class.',
			roles: ['ANALYSIS_INPUT', 'COMPILER_CANDIDATE', 'GENERATED']
		};
	return {
		disposition: 'ANALYZED',
		primaryClass: 'PRODUCTION_SOURCE',
		reason: 'Authored source is a TypeScript compiler candidate.',
		roles: ['ANALYSIS_INPUT', 'COMPILER_CANDIDATE', 'PRODUCTION']
	};
}

export function classifyArtifact(path: string, content?: string): ArtifactClassification {
	const manifest = classifyManifest(path);
	if (manifest !== undefined) return manifest;
	const lockfile = classifyLockfile(path);
	if (lockfile !== undefined) return lockfile;
	const repositoryConfiguration = classifyRepositoryConfiguration(path);
	if (repositoryConfiguration !== undefined) return repositoryConfiguration;
	const svelteKitConfiguration = classifySvelteKitConfiguration(path);
	if (svelteKitConfiguration !== undefined) return svelteKitConfiguration;
	const projectConfiguration = classifyProjectConfiguration(path);
	if (projectConfiguration !== undefined) return projectConfiguration;
	const toolConfiguration = classifyToolConfiguration(path);
	if (toolConfiguration !== undefined) return toolConfiguration;
	const governedVerificationArtifact = classifyGovernedVerificationArtifact(path);
	if (governedVerificationArtifact !== undefined) return governedVerificationArtifact;
	const sourceJson = classifySourceJson(path);
	if (sourceJson !== undefined) return sourceJson;
	const svelteSource = classifySvelteSource(path);
	if (svelteSource !== undefined) return svelteSource;
	const compilerSource = classifyCompilerSource(path, content);
	if (compilerSource !== undefined) return compilerSource;
	return {
		disposition: 'INVENTORY_ONLY',
		primaryClass: 'OTHER',
		reason: 'Artifact is retained for total inventory but is not a DWP-002 semantic input.',
		roles: []
	};
}

function reconcileProjectClassification(
	classification: ArtifactClassification,
	selectedInConfigurationClosure: boolean,
	selectedAsCompilerRoot: boolean
): ArtifactClassification {
	const reconciled =
		!selectedInConfigurationClosure ||
		classification.primaryClass === 'MANIFEST' ||
		classification.primaryClass === 'GENERATED_CONFIGURATION' ||
		classification.primaryClass === 'PROJECT_CONFIGURATION'
			? classification
			: {
					disposition: 'ANALYZED' as const,
					primaryClass: 'PROJECT_CONFIGURATION' as const,
					reason: 'Captured TypeScript configuration-closure input.',
					roles: ['ANALYSIS_INPUT', 'CONFIGURATION'] as const
				};
	if (!selectedAsCompilerRoot) return reconciled;
	const alreadyCandidate = reconciled.roles.includes('COMPILER_CANDIDATE');
	return {
		...reconciled,
		disposition: 'ANALYZED',
		reason: alreadyCandidate
			? reconciled.reason
			: `${reconciled.reason} TypeScript project discovery selected this artifact as a compiler root.`,
		roles: [
			...new Set([...reconciled.roles, 'ANALYSIS_INPUT' as const, 'COMPILER_CANDIDATE' as const])
		].sort((left, right) => Number(left > right) - Number(left < right))
	};
}

/** Reproduces the classification recorded after exact TypeScript project discovery. */
export function classifyArtifactForProjects(
	path: string,
	content: string | undefined,
	projects: readonly ProjectSubjectRecord[]
): ArtifactClassification {
	return reconcileProjectClassification(
		classifyArtifact(path, content),
		projects.some((project) => project.configClosure.some((record) => record.path === path)),
		projects.some((project) => project.fileNames.includes(path))
	);
}

export function reconcileConfigurationClosure(
	capture: SubjectCapture,
	projects: readonly ProjectSubjectRecord[]
): SubjectCapture {
	const closurePaths = new Set(
		projects.flatMap((project) => project.configClosure.map((record) => record.path))
	);
	const compilerRootPaths = new Set(projects.flatMap((project) => project.fileNames));
	return {
		...capture,
		artifacts: capture.artifacts.map((artifact) => {
			return {
				...artifact,
				...reconcileProjectClassification(
					artifact,
					closurePaths.has(artifact.path),
					compilerRootPaths.has(artifact.path)
				)
			};
		})
	};
}
