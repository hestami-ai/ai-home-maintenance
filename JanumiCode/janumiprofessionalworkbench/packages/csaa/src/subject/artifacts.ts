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
		/(^|\/)(test|tests|__tests__|e2e)(\/|$)/u.test(path) ||
		/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(path)
	);
}

export function classifyArtifact(path: string, content?: string): ArtifactClassification {
	if (path === 'package.json' || path.endsWith('/package.json')) {
		return {
			disposition: 'ANALYZED',
			primaryClass: 'MANIFEST',
			reason: 'Package manifest defines workspace, export, command, and dependency context.',
			roles: ['ANALYSIS_INPUT', 'EXPORT_DECLARATION', 'MANIFEST']
		};
	}
	if (/^(?:bun\.lock|package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/u.test(path)) {
		return {
			disposition: 'ANALYZED',
			primaryClass: 'LOCKFILE',
			reason: 'Lockfile contributes dependency identity.',
			roles: ['ANALYSIS_INPUT', 'CONFIGURATION']
		};
	}
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
	if (/(^|\/)\.svelte-kit\/tsconfig\.json$/u.test(path)) {
		return {
			disposition: 'ANALYZED',
			primaryClass: 'GENERATED_CONFIGURATION',
			reason: 'Generated framework configuration is a required project-context input.',
			roles: ['ANALYSIS_INPUT', 'CONFIGURATION', 'GENERATED']
		};
	}
	if (/(^|\/)tsconfig(?:\.[^/]+)?\.json$/u.test(path)) {
		return {
			disposition: 'ANALYZED',
			primaryClass: 'PROJECT_CONFIGURATION',
			reason: 'TypeScript project configuration defines compiler roots and semantics.',
			roles: ['ANALYSIS_INPUT', 'CONFIGURATION']
		};
	}
	if (
		/(^|\/)(?:vite|vitest|svelte|eslint|prettier|turbo|sonar-project|dependency-cruiser)[^/]*\.(?:[cm]?[jt]s|json|ya?ml|properties)$/u.test(
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
	if (path.endsWith('.svelte')) {
		return {
			disposition: 'INVENTORY_ONLY',
			primaryClass: isTest(path) ? 'TEST_SOURCE' : 'PRODUCTION_SOURCE',
			reason:
				'Svelte source is a framework candidate but not a TypeScript compiler root in DWP-002.',
			roles: isTest(path) ? ['FRAMEWORK_CANDIDATE', 'TEST'] : ['FRAMEWORK_CANDIDATE', 'PRODUCTION']
		};
	}
	if (/\.[cm]?[jt]sx?$/u.test(path)) {
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
				roles: ['ANALYSIS_INPUT', 'COMPILER_CANDIDATE', 'VERIFICATION']
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
		if (path.startsWith('scripts/') || hasSegment(path, 'scripts')) {
			const generator = /(?:^|[-_.])(gen|generate|generator)(?:[-_.]|$)/u.test(path);
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
	return {
		disposition: 'INVENTORY_ONLY',
		primaryClass: 'OTHER',
		reason: 'Artifact is retained for total inventory but is not a DWP-002 semantic input.',
		roles: []
	};
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
			const reconciled =
				!closurePaths.has(artifact.path) ||
				artifact.primaryClass === 'MANIFEST' ||
				artifact.primaryClass === 'GENERATED_CONFIGURATION' ||
				artifact.primaryClass === 'PROJECT_CONFIGURATION'
					? artifact
					: {
							...artifact,
							disposition: 'ANALYZED' as const,
							primaryClass: 'PROJECT_CONFIGURATION' as const,
							reason: 'Captured TypeScript configuration-closure input.',
							roles: ['ANALYSIS_INPUT', 'CONFIGURATION'] as const
						};
			if (!compilerRootPaths.has(artifact.path)) return reconciled;
			const alreadyCandidate = reconciled.roles.includes('COMPILER_CANDIDATE');
			return {
				...reconciled,
				disposition: 'ANALYZED',
				reason: alreadyCandidate
					? reconciled.reason
					: `${reconciled.reason} TypeScript project discovery selected this artifact as a compiler root.`,
				roles: [
					...new Set([
						...reconciled.roles,
						'ANALYSIS_INPUT' as const,
						'COMPILER_CANDIDATE' as const
					])
				].sort()
			};
		})
	};
}
